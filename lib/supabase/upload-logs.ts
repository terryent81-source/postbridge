"use client"

import type { Platform, Post, UploadLog } from "@/lib/db"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"

export type RecordMockUploadResultInput = {
  title: string
  content: string
  platforms: Platform[]
  failedPlatforms?: Platform[]
  failReason?: string | null
}

export type SupabaseUploadLogWithPost = {
  log: UploadLog
  post: Post | null
}

const POSTS_SELECT =
  "id,user_id,title,content,platforms,status,scheduled_at,published_at,fail_reason,created_at,updated_at"

export const SUPABASE_UPLOAD_LOGS_CHANGED_EVENT =
  "postbridge:supabase-upload-logs-changed"

export async function recordMyMockUploadResult({
  title,
  content,
  platforms,
  failedPlatforms = [],
  failReason = null,
}: RecordMockUploadResultInput): Promise<UploadLog[] | null> {
  const supabase = createBrowserSupabaseClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return null
  }

  const { data, error } = await supabase.rpc("record_my_mock_upload_result", {
    post_title: title,
    post_content: content,
    target_platforms: platforms,
    failed_platforms: failedPlatforms,
    fail_reason: failReason,
  })

  if (error) {
    throw error
  }

  notifySupabaseUploadLogsChanged()

  return (data ?? []) as UploadLog[]
}

export async function listMySupabaseUploadLogsWithPosts(): Promise<
  SupabaseUploadLogWithPost[]
> {
  const supabase = createBrowserSupabaseClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return []
  }

  const { data: logs, error: logsError } = await supabase
    .from("upload_logs")
    .select("*")
    .eq("user_id", user.id)
    .order("attempted_at", { ascending: false })

  if (logsError) {
    throw logsError
  }

  const uploadLogs = (logs ?? []) as UploadLog[]
  const postIds = Array.from(new Set(uploadLogs.map((log) => log.post_id)))
  const postsById = await listMySupabasePostsByIds(postIds, user.id)

  return uploadLogs.map((log) => ({
    log,
    post: postsById[log.post_id] ?? null,
  }))
}

export function notifySupabaseUploadLogsChanged() {
  if (typeof window === "undefined") return

  window.dispatchEvent(new Event(SUPABASE_UPLOAD_LOGS_CHANGED_EVENT))
}

async function listMySupabasePostsByIds(postIds: string[], userId: string) {
  if (postIds.length === 0) {
    return {}
  }

  const supabase = createBrowserSupabaseClient()
  const { data, error } = await supabase
    .from("posts")
    .select(POSTS_SELECT)
    .eq("user_id", userId)
    .in("id", postIds)

  if (error) {
    throw error
  }

  return ((data ?? []) as Array<Omit<Post, "media_urls">>).reduce<Record<string, Post>>(
    (postsById, post) => {
      postsById[post.id] = {
        ...post,
        media_urls: [],
      }

      return postsById
    },
    {},
  )
}
