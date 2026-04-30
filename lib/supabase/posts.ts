"use client"

import type { Platform, Post, PostStatus } from "@/lib/db"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import {
  listAttachedMediaAssetsForPosts,
  type SupabaseMediaAssetPreview,
} from "@/lib/supabase/media-assets"

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

type ListSupabasePostsInput = {
  status?: PostStatus
  limit?: number
  offset?: number
  orderBy?: "created_at" | "scheduled_at"
  ascending?: boolean
}

export type SupabasePostWithMedia = {
  post: Post
  mediaAssets: SupabaseMediaAssetPreview[]
}

const POSTS_SELECT =
  "id,user_id,title,content,platforms,status,scheduled_at,published_at,fail_reason,created_at,updated_at"

export async function listMySupabasePosts({
  status,
  limit,
  offset = 0,
  orderBy = "created_at",
  ascending = false,
}: ListSupabasePostsInput = {}): Promise<Post[]> {
  const supabase = createBrowserSupabaseClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return []
  }

  let query = supabase
    .from("posts")
    .select(POSTS_SELECT)
    .eq("user_id", user.id)

  if (status) {
    query = query.eq("status", status)
  }

  query = query.order(orderBy, { ascending })

  if (typeof limit === "number") {
    query = query.range(offset, offset + limit - 1)
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  return ((data ?? []) as SupabasePostRow[]).map(mapSupabasePostToPost)
}

export async function listMySupabasePostsWithMedia(
  input: ListSupabasePostsInput = {},
): Promise<SupabasePostWithMedia[]> {
  const posts = await listMySupabasePosts(input)
  const mediaAssetsByPostId = await listAttachedMediaAssetsForPosts(
    posts.map((post) => post.id),
  )

  return posts.map((post) => ({
    post,
    mediaAssets: mediaAssetsByPostId[post.id] ?? [],
  }))
}

export async function listMyRecentSupabasePosts(limit = 6): Promise<Post[]> {
  return listMySupabasePosts({ limit, orderBy: "created_at", ascending: false })
}

export async function listMyRecentSupabasePostsWithMedia(
  limit = 6,
): Promise<SupabasePostWithMedia[]> {
  return listMySupabasePostsWithMedia({
    limit,
    orderBy: "created_at",
    ascending: false,
  })
}

export async function listMyScheduledSupabasePosts(): Promise<Post[]> {
  return listMySupabasePosts({
    status: "scheduled",
    orderBy: "scheduled_at",
    ascending: true,
  })
}

export async function listMyScheduledSupabasePostsWithMedia(): Promise<SupabasePostWithMedia[]> {
  return listMySupabasePostsWithMedia({
    status: "scheduled",
    orderBy: "scheduled_at",
    ascending: true,
  })
}

export async function hasMySupabasePosts(): Promise<boolean> {
  const rows = await listMySupabasePosts({ limit: 1 })

  return rows.length > 0
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

function mapSupabasePostToPost(row: SupabasePostRow): Post {
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    content: row.content,
    platforms: row.platforms,
    media_urls: [],
    status: row.status,
    scheduled_at: row.scheduled_at,
    published_at: row.published_at,
    fail_reason: row.fail_reason,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}
