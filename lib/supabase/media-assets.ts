"use client"

import { createBrowserSupabaseClient } from "@/lib/supabase/client"

// Storage is temporary staging for SNS uploads, not permanent media storage.
// Clients only upload and mark cleanup intent; service_role workers perform
// actual Storage removal and then mark rows as deleted.

export type SupabaseMediaType = "image" | "video"
export type SupabaseMediaAssetStatus =
  | "uploading"
  | "ready"
  | "attached"
  | "upload_success"
  | "upload_failed"
  | "pending_delete"
  | "deleted"

export type SupabaseMediaAssetRow = {
  id: string
  user_id: string
  post_id: string | null
  storage_bucket: string
  storage_path: string
  file_name: string
  mime_type: string
  file_size: number
  media_type: SupabaseMediaType
  status: SupabaseMediaAssetStatus
  delete_after: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export type SupabaseMediaAssetPreview = SupabaseMediaAssetRow & {
  signedUrl?: string
}

export type UploadPostMediaInput = {
  postId: string
  files: File[]
  status?: Extract<SupabaseMediaAssetStatus, "attached" | "pending_delete">
  deleteAfter?: Date | null
}

const POST_MEDIA_BUCKET = "post-media"
const SIGNED_URL_EXPIRES_IN_SECONDS = 60 * 60
const IMAGE_MAX_BYTES = 10 * 1024 * 1024
const VIDEO_MAX_BYTES = 300 * 1024 * 1024

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm"])

export function validatePostMediaFile(file: File): SupabaseMediaType {
  if (file.size <= 0) {
    throw new Error(`${file.name}: 비어 있는 파일은 업로드할 수 없습니다.`)
  }

  if (ALLOWED_IMAGE_TYPES.has(file.type)) {
    if (file.size > IMAGE_MAX_BYTES) {
      throw new Error(`${file.name}: 이미지는 최대 10MB까지 업로드할 수 있습니다.`)
    }

    return "image"
  }

  if (ALLOWED_VIDEO_TYPES.has(file.type)) {
    if (file.size > VIDEO_MAX_BYTES) {
      throw new Error(`${file.name}: 영상은 최대 300MB까지 업로드할 수 있습니다.`)
    }

    return "video"
  }

  throw new Error(
    `${file.name}: 지원하지 않는 파일 형식입니다. JPG, PNG, WebP, MP4, MOV, WebM만 업로드할 수 있습니다.`,
  )
}

export async function uploadPostMediaAssets({
  postId,
  files,
  status = "attached",
  deleteAfter = null,
}: UploadPostMediaInput): Promise<SupabaseMediaAssetRow[]> {
  if (files.length === 0) {
    return []
  }

  const supabase = createBrowserSupabaseClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new Error("로그인이 필요합니다.")
  }

  const uploadedRows: SupabaseMediaAssetRow[] = []

  for (const file of files) {
    const mediaType = validatePostMediaFile(file)
    const storagePath = `${user.id}/${postId}/${buildStorageFileName(file.name)}`

    const { error: uploadError } = await supabase.storage
      .from(POST_MEDIA_BUCKET)
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      throw uploadError
    }

    const { data, error: insertError } = await supabase
      .from("media_assets")
      .insert({
        user_id: user.id,
        post_id: postId,
        storage_bucket: POST_MEDIA_BUCKET,
        storage_path: storagePath,
        file_name: file.name,
        mime_type: file.type,
        file_size: file.size,
        media_type: mediaType,
        status,
        delete_after: deleteAfter?.toISOString() ?? null,
      })
      .select("*")
      .single<SupabaseMediaAssetRow>()

    if (insertError) {
      throw insertError
    }

    uploadedRows.push(data)
  }

  return uploadedRows
}

export async function markMyPostMediaPendingDelete(
  postId: string,
  deleteAfter: Date = new Date(),
): Promise<SupabaseMediaAssetRow[]> {
  const supabase = createBrowserSupabaseClient()
  const { data, error } = await supabase.rpc("mark_my_post_media_pending_delete", {
    target_post_id: postId,
    delete_after_at: deleteAfter.toISOString(),
  })

  if (error) {
    throw error
  }

  return (data ?? []) as SupabaseMediaAssetRow[]
}

export async function listAttachedMediaAssetsForPosts(
  postIds: string[],
): Promise<Record<string, SupabaseMediaAssetPreview[]>> {
  const uniquePostIds = Array.from(new Set(postIds)).filter(Boolean)

  if (uniquePostIds.length === 0) {
    return {}
  }

  const supabase = createBrowserSupabaseClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return {}
  }

  const { data, error } = await supabase
    .from("media_assets")
    .select("*")
    .eq("user_id", user.id)
    .in("status", ["attached", "pending_delete"])
    .is("deleted_at", null)
    .in("post_id", uniquePostIds)
    .order("created_at", { ascending: true })

  if (error) {
    throw error
  }

  const rows = ((data ?? []) as SupabaseMediaAssetRow[]).filter(
    (asset): asset is SupabaseMediaAssetRow & { post_id: string } => Boolean(asset.post_id),
  )
  const rowsWithSignedUrls = await Promise.all(
    rows.map(async (asset) => ({
      ...asset,
      signedUrl:
        asset.media_type === "image"
          ? await createSignedImageUrl(asset.storage_bucket, asset.storage_path)
          : undefined,
    })),
  )

  return rowsWithSignedUrls.reduce<Record<string, SupabaseMediaAssetPreview[]>>(
    (grouped, asset) => {
      grouped[asset.post_id] ??= []
      grouped[asset.post_id].push(asset)

      return grouped
    },
    {},
  )
}

async function createSignedImageUrl(storageBucket: string, storagePath: string) {
  const supabase = createBrowserSupabaseClient()
  const { data, error } = await supabase.storage
    .from(storageBucket)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRES_IN_SECONDS)

  if (error) {
    return undefined
  }

  return data.signedUrl
}

function buildStorageFileName(fileName: string) {
  const safeName = fileName
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)

  return `${crypto.randomUUID()}-${safeName || "upload"}`
}
