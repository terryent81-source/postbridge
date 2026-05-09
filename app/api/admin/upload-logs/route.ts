import { NextResponse } from "next/server"
import { requireAdminUser } from "@/lib/supabase/admin-auth"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type UploadLogRow = {
  id: string
  post_id: string
  user_id: string
  platform: string
  status: string
  platform_metadata?: Record<string, unknown>
  error_message: string | null
  attempted_at: string
  completed_at: string | null
}

type PostRow = {
  id: string
  title: string
  status: string
  platforms: string[]
}

type ProfileRow = {
  user_id: string
  display_name: string
}

export async function GET() {
  const admin = await requireAdminUser()

  if (admin.error) {
    return admin.error
  }

  let supabase
  try {
    supabase = createSupabaseServiceRoleClient()
  } catch {
    return NextResponse.json(
      { error: "Supabase service role is not configured" },
      { status: 500 },
    )
  }

  const { data: logs, error } = await supabase
    .from("upload_logs")
    .select("*")
    .order("attempted_at", { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const uploadLogs = (logs ?? []) as UploadLogRow[]
  const postIds = Array.from(new Set(uploadLogs.map((log) => log.post_id)))
  const userIds = Array.from(new Set(uploadLogs.map((log) => log.user_id)))

  const [{ data: posts }, { data: profiles }] = await Promise.all([
    postIds.length > 0
      ? supabase
          .from("posts")
          .select("id,title,status,platforms")
          .in("id", postIds)
      : Promise.resolve({ data: [] }),
    userIds.length > 0
      ? supabase
          .from("profiles")
          .select("user_id,display_name")
          .in("user_id", userIds)
      : Promise.resolve({ data: [] }),
  ])

  const postsById = new Map((posts ?? []).map((post: PostRow) => [post.id, post]))
  const profilesByUserId = new Map(
    (profiles ?? []).map((profile: ProfileRow) => [profile.user_id, profile]),
  )

  return NextResponse.json({
    rows: uploadLogs.map((log) => ({
      log,
      post: postsById.get(log.post_id) ?? null,
      profile: profilesByUserId.get(log.user_id) ?? null,
    })),
  })
}
