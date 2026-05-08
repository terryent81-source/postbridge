import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role"
import {
  failPostWithUploadLogs,
  publishPostWithUploader,
} from "@/lib/server/upload/publisher"
import { consumeUploadCredit } from "@/lib/server/upload/usage"
import type { PublishablePost } from "@/lib/server/upload/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type PublishRequestBody = {
  postId?: string
}

export async function POST(request: Request) {
  const serverSupabase = await createServerSupabaseClient()

  if (!serverSupabase) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 })
  }

  const {
    data: { user },
    error: userError,
  } = await serverSupabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as PublishRequestBody

  if (!body.postId) {
    return NextResponse.json({ error: "postId is required" }, { status: 400 })
  }

  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("posts")
    .select("id, user_id, title, content, platforms, status")
    .eq("id", body.postId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 })
  }

  if (!["draft", "failed"].includes(data.status)) {
    return NextResponse.json(
      { error: "Only draft or failed posts can be published immediately" },
      { status: 409 },
    )
  }

  const post = data as PublishablePost & { status: string }
  const attemptedAt = new Date()

  const usageCredit = await consumeUploadCredit(supabase, user.id)

  if (!usageCredit) {
    const result = await failPostWithUploadLogs(
      supabase,
      post,
      "Insufficient upload credits",
      attemptedAt,
    )
    return NextResponse.json(result, { status: 402 })
  }

  const result = await publishPostWithUploader(supabase, post, attemptedAt)

  return NextResponse.json(result)
}
