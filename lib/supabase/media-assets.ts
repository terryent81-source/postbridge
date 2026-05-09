"use client"

import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import {
  VIDEO_OPTIMIZATION_TARGET_BYTES,
  VIDEO_OPTIMIZER_UNAVAILABLE_ERROR,
  VIDEO_OPTIMIZER_UNAVAILABLE_MESSAGE,
  type PreparedMediaUpload,
  type VideoOptimizationDbStatus,
} from "@/lib/media/video-optimization"

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
  original_size?: number | null
  optimized_size?: number | null
  optimization_status?: VideoOptimizationDbStatus
  original_media_url?: string | null
  optimized_media_url?: string | null
  optimized_storage_bucket?: string | null
  optimized_storage_path?: string | null
  optimized_mime_type?: string | null
  optimization_error?: string | null
  optimization_attempts?: number
  optimization_settings?: Record<string, unknown>
  delete_after: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export type SupabaseMediaAssetPreview = SupabaseMediaAssetRow & {
  signedUrl?: string
}

export const MEDIA_EXPIRED_MESSAGE =
  "미디어 보관 기간이 만료되었습니다. 다시 업로드해 주세요."

export type UploadPostMediaInput = {
  postId: string
  files: Array<File | PreparedMediaUpload>
  status?: Extract<SupabaseMediaAssetStatus, "attached" | "pending_delete">
  deleteAfter?: Date | null
}

const POST_MEDIA_BUCKET = "post-media"
const SIGNED_URL_EXPIRES_IN_SECONDS = 60 * 60
const IMAGE_MAX_BYTES = 10 * 1024 * 1024
const VIDEO_MAX_BYTES = VIDEO_OPTIMIZATION_TARGET_BYTES

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

  for (const inputFile of files) {
    const upload = normalizePreparedUpload(inputFile)
    const file = upload.file
    const mediaType = validatePostMediaFile(file)

    if (upload.optimizationStatus === "failed") {
      await recordFailedOptimizationAndAbort({
        supabase,
        uploadedRows,
        userId: user.id,
        postId,
        upload,
        mediaType,
        deleteAfter,
      })
    }

    if (
      mediaType === "video" &&
      file.size > VIDEO_MAX_BYTES &&
      upload.optimizationStatus !== "completed"
    ) {
      await recordFailedOptimizationAndAbort({
        supabase,
        uploadedRows,
        userId: user.id,
        postId,
        upload: {
          ...upload,
          optimizationStatus: "failed",
          optimizationError: upload.optimizationError ?? VIDEO_OPTIMIZER_UNAVAILABLE_ERROR,
          optimizationAttempts: Math.max(1, upload.optimizationAttempts),
        },
        mediaType,
        deleteAfter,
      })
    }

    const originalStoragePath = `${user.id}/${postId}/original/${buildStorageFileName(upload.originalFile.name)}`
    const optimizedStoragePath =
      upload.optimizationStatus === "completed"
        ? `${user.id}/${postId}/optimized/${buildStorageFileName(file.name)}`
        : null
    const storagePath = optimizedStoragePath ?? originalStoragePath

    await uploadStorageObjectWithSizeGuard({
      supabase,
      uploadedRows,
      userId: user.id,
      postId,
      upload,
      mediaType,
      storagePath,
      deleteAfter,
    })

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
        original_size: upload.originalSize,
        optimized_size: upload.optimizedSize,
        optimization_status: upload.optimizationStatus,
        original_media_url:
          upload.optimizationStatus === "completed" ? null : originalStoragePath,
        optimized_media_url: optimizedStoragePath,
        optimized_storage_bucket: optimizedStoragePath ? POST_MEDIA_BUCKET : null,
        optimized_storage_path: optimizedStoragePath,
        optimized_mime_type: optimizedStoragePath ? file.type : null,
        optimization_error: upload.optimizationError ?? null,
        optimization_attempts: upload.optimizationAttempts,
        optimization_settings: upload.optimizationSettings ?? {},
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

async function uploadStorageObjectWithSizeGuard({
  supabase,
  uploadedRows,
  userId,
  postId,
  upload,
  mediaType,
  storagePath,
  deleteAfter,
}: {
  supabase: ReturnType<typeof createBrowserSupabaseClient>
  uploadedRows: SupabaseMediaAssetRow[]
  userId: string
  postId: string
  upload: PreparedMediaUpload
  mediaType: SupabaseMediaType
  storagePath: string
  deleteAfter: Date | null
}) {
  if (mediaType === "video" && upload.file.size > VIDEO_MAX_BYTES) {
    await recordFailedOptimizationAndAbort({
      supabase,
      uploadedRows,
      userId,
      postId,
      upload: {
        ...upload,
        optimizationStatus: "failed",
        optimizationError: upload.optimizationError ?? VIDEO_OPTIMIZER_UNAVAILABLE_ERROR,
        optimizationAttempts: Math.max(1, upload.optimizationAttempts),
      },
      mediaType,
      deleteAfter,
    })
  }

  const { error: uploadError } = await supabase.storage
    .from(POST_MEDIA_BUCKET)
    .upload(storagePath, upload.file, {
      contentType: upload.file.type,
      upsert: false,
    })

  if (uploadError) {
    throw uploadError
  }
}

async function recordFailedOptimizationAndAbort({
  supabase,
  uploadedRows,
  userId,
  postId,
  upload,
  mediaType,
  deleteAfter,
}: {
  supabase: ReturnType<typeof createBrowserSupabaseClient>
  uploadedRows: SupabaseMediaAssetRow[]
  userId: string
  postId: string
  upload: PreparedMediaUpload
  mediaType: SupabaseMediaType
  deleteAfter: Date | null
}): Promise<never> {
  console.warn("[media-upload] Supabase Storage upload skipped before upload", {
    fileName: upload.originalFile.name,
    fileSize: upload.originalSize,
  })

  const failedRow = await insertFailedOptimizationMediaAsset({
    supabase,
    userId,
    postId,
    upload: {
      ...upload,
      optimizationStatus: "failed",
      optimizationError: upload.optimizationError ?? VIDEO_OPTIMIZER_UNAVAILABLE_ERROR,
      optimizationAttempts: Math.max(1, upload.optimizationAttempts),
    },
    mediaType,
    deleteAfter,
  })
  uploadedRows.push(failedRow)

  throw new Error(formatOptimizationUploadError(upload.optimizationError))
}

export async function recordFailedVideoOptimizationMediaAssets({
  postId,
  files,
  deleteAfter = null,
}: {
  postId: string
  files: PreparedMediaUpload[]
  deleteAfter?: Date | null
}) {
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

  const rows: SupabaseMediaAssetRow[] = []

  for (const upload of files) {
    console.warn("[media-upload] Supabase Storage upload skipped before upload", {
      fileName: upload.originalFile.name,
      fileSize: upload.originalSize,
    })

    rows.push(
      await insertFailedOptimizationMediaAsset({
        supabase,
        userId: user.id,
        postId,
        upload: {
          ...upload,
          optimizationStatus: "failed",
          optimizationError: upload.optimizationError ?? VIDEO_OPTIMIZER_UNAVAILABLE_ERROR,
          optimizationAttempts: Math.max(1, upload.optimizationAttempts),
        },
        mediaType: validatePostMediaFile(upload.originalFile),
        deleteAfter,
      }),
    )
  }

  return rows
}

async function insertFailedOptimizationMediaAsset({
  supabase,
  userId,
  postId,
  upload,
  mediaType,
  deleteAfter,
}: {
  supabase: ReturnType<typeof createBrowserSupabaseClient>
  userId: string
  postId: string
  upload: PreparedMediaUpload
  mediaType: SupabaseMediaType
  deleteAfter: Date | null
}) {
  const failedStoragePath = `${userId}/${postId}/failed/${buildStorageFileName(upload.originalFile.name)}`
  const { data, error } = await supabase
    .from("media_assets")
    .insert({
      user_id: userId,
      post_id: postId,
      storage_bucket: POST_MEDIA_BUCKET,
      storage_path: failedStoragePath,
      file_name: upload.originalFile.name,
      mime_type: upload.originalFile.type,
      file_size: upload.originalSize,
      media_type: mediaType,
      original_size: upload.originalSize,
      optimized_size: null,
      optimization_status: "failed",
      original_media_url: null,
      optimized_media_url: null,
      optimized_storage_bucket: null,
      optimized_storage_path: null,
      optimized_mime_type: null,
      optimization_error: upload.optimizationError ?? VIDEO_OPTIMIZER_UNAVAILABLE_ERROR,
      optimization_attempts: Math.max(1, upload.optimizationAttempts),
      optimization_settings: upload.optimizationSettings ?? {},
      status: "upload_failed",
      delete_after: deleteAfter?.toISOString() ?? null,
    })
    .select("*")
    .single<SupabaseMediaAssetRow>()

  if (error) {
    throw error
  }

  return data
}

function formatOptimizationUploadError(error: string | null | undefined) {
  if (!error || error === VIDEO_OPTIMIZER_UNAVAILABLE_ERROR) {
    return VIDEO_OPTIMIZER_UNAVAILABLE_MESSAGE
  }

  return error
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
    .in("status", ["attached", "pending_delete", "deleted"])
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
        asset.status !== "deleted" && !asset.deleted_at && asset.media_type === "image"
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

function normalizePreparedUpload(input: File | PreparedMediaUpload): PreparedMediaUpload {
  if ("originalFile" in input) {
    return input
  }

  return {
    file: input,
    originalFile: input,
    originalSize: input.size,
    optimizedSize: null,
    optimizationStatus:
      input.type.startsWith("video/") && input.size > VIDEO_MAX_BYTES
        ? "pending"
        : "not_needed",
    optimizationAttempts: 0,
    optimizationSettings: null,
  }
}
