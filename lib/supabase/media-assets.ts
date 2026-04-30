"use client"

import { createBrowserSupabaseClient } from "@/lib/supabase/client"

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

export type UploadPostMediaInput = {
  postId: string
  files: File[]
}

const POST_MEDIA_BUCKET = "post-media"
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
        status: "attached",
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

function buildStorageFileName(fileName: string) {
  const safeName = fileName
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)

  return `${crypto.randomUUID()}-${safeName || "upload"}`
}
