import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

export type UsageCreditRow = {
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

export async function consumeUploadCredit(
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
