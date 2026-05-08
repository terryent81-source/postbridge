"use client"

import { notifySupabaseUploadLogsChanged } from "@/lib/supabase/upload-logs"
import { notifySupabaseUsageCreditsChanged } from "@/lib/supabase/usage-credits"

export type PublishNowResult = {
  uploadMode: "mock" | "real"
  status: "published" | "failed"
  results: Array<{
    platform: string
    status: "success" | "failed"
    platformPostId?: string | null
    errorMessage?: string | null
  }>
}

export async function publishMySupabasePostNow(postId: string) {
  const response = await fetch("/api/uploads/publish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ postId }),
  })
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to publish post")
  }

  notifySupabaseUploadLogsChanged()
  notifySupabaseUsageCreditsChanged()

  return payload as PublishNowResult
}
