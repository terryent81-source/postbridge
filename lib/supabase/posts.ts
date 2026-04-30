"use client"

import type { Platform, PostStatus } from "@/lib/db"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"

export type SupabasePostRow = {
  id: string
  user_id: string
  title: string
  content: string
  platforms: Platform[]
  status: PostStatus
  scheduled_at: string | null
  published_at: string | null
  fail_reason: string | null
  created_at: string
  updated_at: string
}

type CreateSupabasePostInput = {
  title: string
  content: string
  platforms: Platform[]
  status: Extract<PostStatus, "draft" | "scheduled">
  scheduledAt?: string | null
}

export async function createSupabasePost({
  title,
  content,
  platforms,
  status,
  scheduledAt = null,
}: CreateSupabasePostInput) {
  const supabase = createBrowserSupabaseClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new Error("로그인이 필요합니다.")
  }

  if (!title.trim()) {
    throw new Error("제목을 입력해 주세요.")
  }

  if (platforms.length === 0) {
    throw new Error("최소 1개 이상의 플랫폼을 선택해 주세요.")
  }

  if (status === "scheduled") {
    if (!scheduledAt) {
      throw new Error("예약 시간을 선택해 주세요.")
    }

    if (new Date(scheduledAt).getTime() < Date.now()) {
      throw new Error("예약 시간은 현재 이후여야 합니다.")
    }
  }

  const { data, error } = await supabase
    .from("posts")
    .insert({
      user_id: user.id,
      title: title.trim(),
      content,
      platforms,
      status,
      scheduled_at: status === "scheduled" ? scheduledAt : null,
    })
    .select("*")
    .single<SupabasePostRow>()

  if (error) {
    throw error
  }

  return data
}
