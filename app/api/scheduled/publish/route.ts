import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Platform } from "@/lib/db"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role"
import {
  failPostWithUploadLogs,
  publishPostWithUploader,
} from "@/lib/server/upload/publisher"
import { consumeUploadCredit } from "@/lib/server/upload/usage"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SCHEDULED_BATCH_LIMIT = 10
const INSUFFICIENT_CREDITS_MESSAGE = "Insufficient upload credits"
const MISSING_MEDIA_FILE_MESSAGE = "missing_media_file"
const MOCK_UPLOAD_FAILURE_MESSAGE = "Mock scheduled upload failed"

type ScheduledPost = {
  id: string
  user_id: string
  title: string
  content: string
  platforms: Platform[]
  platform_settings?: Record<string, unknown>
  status: "scheduled"
  scheduled_at: string
}

type UsageCreditRow = {
  id: string
  user_id: string
  plan_id: string
  week_start: string
  used_count: number
  bonus_count: number
  plan_limit: number
}

type SubscriptionPlanRow = {
  id: string
  weekly_upload_limit: number
}

type PublishResult = {
  postId: string
  status: "published" | "failed" | "skipped"
  reason?: string
}

export async function POST(request: Request) {
  const scheduledPublishSecret = process.env.SCHEDULED_PUBLISH_SECRET
  const requestSecret = request.headers.get("x-scheduled-publish-secret")

  if (!scheduledPublishSecret || requestSecret !== scheduledPublishSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let supabase
  try {
    supabase = createSupabaseServiceRoleClient()
  } catch (error) {
    console.error("[scheduled-publish] Missing Supabase service role config", error)
    return NextResponse.json(
      { error: "Scheduled publishing is not configured" },
      { status: 500 },
    )
  }

  const now = new Date()
  const { data, error } = await supabase
    .from("posts")
    .select("id, user_id, title, content, platforms, platform_settings, status, scheduled_at")
    .eq("status", "scheduled")
    .not("scheduled_at", "is", null)
    .lte("scheduled_at", now.toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(SCHEDULED_BATCH_LIMIT)

  if (error) {
    console.error("[scheduled-publish] Failed to fetch scheduled posts", error)
    return NextResponse.json(
      { error: "Failed to fetch scheduled posts" },
      { status: 500 },
    )
  }

  const posts = (data ?? []) as ScheduledPost[]
  const results: PublishResult[] = []

  for (const post of posts) {
    results.push(await publishScheduledPost(supabase, post))
  }

  return NextResponse.json({
    scanned: posts.length,
    published: results.filter((result) => result.status === "published").length,
    failed: results.filter((result) => result.status === "failed").length,
    skipped: results.filter((result) => result.status === "skipped").length,
    results,
  })
}

async function publishScheduledPost(
  supabase: SupabaseClient,
  post: ScheduledPost,
): Promise<PublishResult> {
  const attemptedAt = new Date()

  if (!post.platforms.length) {
    return failScheduledPost(
      supabase,
      post,
      "At least one platform is required",
      attemptedAt,
    )
  }

  try {
    const stillScheduled = await assertPostIsStillScheduled(supabase, post.id)
    if (!stillScheduled) {
      return {
        postId: post.id,
        status: "skipped",
        reason: "Post is no longer scheduled",
      }
    }

    if (await hasDeletedMediaFile(supabase, post)) {
      return failScheduledPost(
        supabase,
        post,
        MISSING_MEDIA_FILE_MESSAGE,
        attemptedAt,
      )
    }

    const usageCredit = await consumeUploadCredit(supabase, post.user_id)

    if (!usageCredit) {
      return failScheduledPost(
        supabase,
        post,
        INSUFFICIENT_CREDITS_MESSAGE,
        attemptedAt,
      )
    }

    const publishResult = await publishPostWithUploader(supabase, post, attemptedAt)

    return {
      postId: post.id,
      status: publishResult.status === "published" ? "published" : "failed",
      reason:
        publishResult.status === "failed"
          ? publishResult.results
              .filter((result) => result.status === "failed")
              .map((result) => `${result.platform}: ${result.errorMessage}`)
              .join("; ")
          : undefined,
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : MOCK_UPLOAD_FAILURE_MESSAGE
    console.error("[scheduled-publish] Failed to publish scheduled post", {
      postId: post.id,
      error,
    })

    return failScheduledPost(supabase, post, message, attemptedAt)
  }
}

async function assertPostIsStillScheduled(supabase: SupabaseClient, postId: string) {
  const { data, error } = await supabase
    .from("posts")
    .select("id")
    .eq("id", postId)
    .eq("status", "scheduled")
    .maybeSingle()

  if (error) {
    throw error
  }

  return Boolean(data)
}

async function hasDeletedMediaFile(supabase: SupabaseClient, post: ScheduledPost) {
  const { data, error } = await supabase
    .from("media_assets")
    .select("id")
    .eq("post_id", post.id)
    .eq("user_id", post.user_id)
    .or("status.eq.deleted,deleted_at.not.is.null")
    .limit(1)

  if (error) {
    throw error
  }

  return (data ?? []).length > 0
}

async function failScheduledPost(
  supabase: SupabaseClient,
  post: ScheduledPost,
  reason: string,
  attemptedAt: Date,
): Promise<PublishResult> {
  await failPostWithUploadLogs(supabase, post, reason, attemptedAt)

  return {
    postId: post.id,
    status: "failed",
    reason,
  }
}

async function consumeScheduledUploadCredit(
  supabase: SupabaseClient,
  userId: string,
): Promise<UsageCreditRow | null> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const usageCredit = await getOrCreateCurrentUsageCredit(supabase, userId)
    const availableCount = usageCredit.plan_limit + usageCredit.bonus_count

    if (usageCredit.plan_limit >= 0 && usageCredit.used_count >= availableCount) {
      return null
    }

    const { data, error } = await supabase
      .from("usage_credits")
      .update({ used_count: usageCredit.used_count + 1 })
      .eq("id", usageCredit.id)
      .eq("used_count", usageCredit.used_count)
      .select("*")
      .maybeSingle()

    if (error) {
      throw error
    }

    if (data) {
      return data as UsageCreditRow
    }
  }

  throw new Error("Could not consume upload credit")
}

async function getOrCreateCurrentUsageCredit(
  supabase: SupabaseClient,
  userId: string,
): Promise<UsageCreditRow> {
  const weekStart = getCurrentUtcWeekStart()
  const { data: existingRow, error: existingError } = await supabase
    .from("usage_credits")
    .select("*")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle()

  if (existingError) {
    throw existingError
  }

  if (existingRow) {
    return existingRow as UsageCreditRow
  }

  const plan = await getUserPlan(supabase, userId)
  const { data: createdRow, error: createError } = await supabase
    .from("usage_credits")
    .upsert(
      {
        user_id: userId,
        plan_id: plan.id,
        week_start: weekStart,
        used_count: 0,
        bonus_count: 0,
        plan_limit: plan.weekly_upload_limit,
      },
      { onConflict: "user_id,week_start" },
    )
    .select("*")
    .single()

  if (createError) {
    throw createError
  }

  return createdRow as UsageCreditRow
}

async function getUserPlan(
  supabase: SupabaseClient,
  userId: string,
): Promise<SubscriptionPlanRow> {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("plan_id")
    .eq("user_id", userId)
    .maybeSingle()

  if (profileError) {
    throw profileError
  }

  if (profile?.plan_id) {
    const { data: plan, error: planError } = await supabase
      .from("subscription_plans")
      .select("id, weekly_upload_limit")
      .eq("id", profile.plan_id)
      .single()

    if (planError) {
      throw planError
    }

    return plan as SubscriptionPlanRow
  }

  const { data: defaultPlan, error: defaultPlanError } = await supabase
    .from("subscription_plans")
    .select("id, weekly_upload_limit")
    .eq("is_default", true)
    .order("sort_order", { ascending: true })
    .limit(1)
    .single()

  if (defaultPlanError) {
    throw defaultPlanError
  }

  return defaultPlan as SubscriptionPlanRow
}

async function markPostMediaPendingDelete(
  supabase: SupabaseClient,
  post: ScheduledPost,
  deleteAfter: Date,
) {
  const { error } = await supabase
    .from("media_assets")
    .update({
      status: "pending_delete",
      delete_after: deleteAfter.toISOString(),
    })
    .eq("post_id", post.id)
    .eq("user_id", post.user_id)
    .neq("status", "deleted")
    .is("deleted_at", null)

  if (error) {
    console.error("[scheduled-publish] Failed to mark media pending delete", {
      postId: post.id,
      error,
    })
  }
}

function getCurrentUtcWeekStart() {
  const now = new Date()
  const day = now.getUTCDay()
  const daysSinceMonday = day === 0 ? 6 : day - 1
  const weekStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  )
  weekStart.setUTCDate(weekStart.getUTCDate() - daysSinceMonday)

  return weekStart.toISOString().slice(0, 10)
}
