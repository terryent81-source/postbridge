import { NextResponse } from "next/server"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const POST_MEDIA_BUCKET = "post-media"
const MEDIA_SCAN_LIMIT = 1000
const ORPHAN_SCAN_LIMIT = 500
const STORAGE_LIST_PAGE_SIZE = 100
const STORAGE_LIST_MAX_DEPTH = 6
const EXPIRE_AFTER_MS = 24 * 60 * 60 * 1000
const ORPHAN_EXPIRE_AFTER_MS = 60 * 60 * 1000

type PostStatus = "draft" | "scheduled" | "published" | "failed"
type MediaAssetStatus =
  | "uploading"
  | "ready"
  | "attached"
  | "upload_success"
  | "upload_failed"
  | "pending_delete"
  | "deleted"

type CleanupSkipReason =
  | "scheduled_keep"
  | "draft_not_expired"
  | "failed_not_expired"
  | "already_deleted"
  | "storage_delete_failed"
  | "missing_storage_path"
  | "orphan_not_expired"

type CleanupError = {
  id?: string
  storagePath: string
  stage: "media_fetch" | "storage_fetch" | "storage_remove" | "metadata_update"
  message: string
}

type LinkedPost = {
  id: string
  status: PostStatus
  created_at: string
  updated_at: string
}

type MediaAsset = {
  id: string
  post_id: string | null
  storage_bucket: string
  storage_path: string | null
  optimized_storage_bucket?: string | null
  optimized_storage_path?: string | null
  status: MediaAssetStatus
  created_at: string
  updated_at: string
  deleted_at: string | null
  posts: LinkedPost | LinkedPost[] | null
}

type StorageObject = {
  name: string
  bucket_id: string
  created_at: string | null
  updated_at: string | null
}

type ListedStorageObject = {
  name: string
  id?: string | null
  created_at?: string | null
  updated_at?: string | null
  metadata?: unknown
}

type CleanupSummary = {
  scanned: number
  deleted: number
  skipped: number
  errors: CleanupError[]
  deleted_files: string[]
  skipped_reasons: Record<CleanupSkipReason, number>
}

async function recordCleanupRun(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  summary: CleanupSummary,
  ranAt: Date,
) {
  const { error } = await supabase.from("storage_cleanup_runs").insert({
    scanned: summary.scanned,
    deleted: summary.deleted,
    skipped: summary.skipped,
    errors: summary.errors,
    skipped_reasons: summary.skipped_reasons,
    deleted_files: summary.deleted_files,
    ran_at: ranAt.toISOString(),
  })

  if (error) {
    console.error("[media-cleanup] Failed to record cleanup summary", error)
  }
}

function createSummary(): CleanupSummary {
  return {
    scanned: 0,
    deleted: 0,
    skipped: 0,
    errors: [],
    deleted_files: [],
    skipped_reasons: {
      scheduled_keep: 0,
      draft_not_expired: 0,
      failed_not_expired: 0,
      already_deleted: 0,
      storage_delete_failed: 0,
      missing_storage_path: 0,
      orphan_not_expired: 0,
    },
  }
}

function skip(summary: CleanupSummary, reason: CleanupSkipReason) {
  summary.skipped += 1
  summary.skipped_reasons[reason] += 1
}

function getLinkedPost(asset: MediaAsset) {
  if (Array.isArray(asset.posts)) {
    return asset.posts[0] ?? null
  }

  return asset.posts
}

function isAtOrBefore(value: string | null | undefined, cutoff: Date) {
  if (!value) {
    return false
  }

  const time = new Date(value).getTime()

  return Number.isFinite(time) && time <= cutoff.getTime()
}

async function deleteStorageFile(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  summary: CleanupSummary,
  storageBucket: string,
  storagePath: string,
  assetId?: string,
) {
  const { error } = await supabase.storage.from(storageBucket).remove([storagePath])

  if (error) {
    summary.errors.push({
      id: assetId,
      storagePath,
      stage: "storage_remove",
      message: error.message,
    })
    skip(summary, "storage_delete_failed")
    console.error("[media-cleanup] Storage remove failed", {
      id: assetId,
      storagePath,
      error,
    })

    return false
  }

  summary.deleted += 1
  summary.deleted_files.push(storagePath)

  return true
}

async function markMediaAssetDeleted(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  summary: CleanupSummary,
  asset: MediaAsset,
  deletedAt: string,
) {
  const { data, error } = await supabase
    .from("media_assets")
    .update({
      status: "deleted",
      deleted_at: deletedAt,
    })
    .eq("id", asset.id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle()

  if (error || !data) {
    summary.errors.push({
      id: asset.id,
      storagePath: asset.storage_path ?? "",
      stage: "metadata_update",
      message: error?.message ?? "No media_assets row was updated",
    })
    console.error("[media-cleanup] media_assets update failed", {
      id: asset.id,
      storagePath: asset.storage_path,
      error,
    })
  }
}

async function cleanupMediaAsset(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  summary: CleanupSummary,
  asset: MediaAsset,
  now: Date,
) {
  summary.scanned += 1

  if (asset.status === "deleted" || asset.deleted_at) {
    skip(summary, "already_deleted")
    return
  }

  if (!asset.storage_path) {
    skip(summary, "missing_storage_path")
    return
  }

  const post = getLinkedPost(asset)
  const postUpdatedCutoff = new Date(now.getTime() - EXPIRE_AFTER_MS)
  const orphanCutoff = new Date(now.getTime() - ORPHAN_EXPIRE_AFTER_MS)

  let shouldDelete = false
  let markMetadata = true

  if (!post) {
    shouldDelete = isAtOrBefore(asset.created_at, orphanCutoff)
    if (!shouldDelete) {
      skip(summary, "orphan_not_expired")
      return
    }
  } else if (post.status === "published") {
    shouldDelete = true
  } else if (post.status === "scheduled") {
    skip(summary, "scheduled_keep")
    return
  } else if (post.status === "draft") {
    shouldDelete = isAtOrBefore(post.updated_at, postUpdatedCutoff)
    if (!shouldDelete) {
      skip(summary, "draft_not_expired")
      return
    }
  } else if (post.status === "failed") {
    shouldDelete = isAtOrBefore(post.updated_at, postUpdatedCutoff)
    if (!shouldDelete) {
      skip(summary, "failed_not_expired")
      return
    }
  } else {
    markMetadata = false
  }

  if (!shouldDelete) {
    return
  }

  const deletedResults = await Promise.all(
    getStorageTargets(asset).map((target) =>
      deleteStorageFile(supabase, summary, target.bucket, target.path, asset.id),
    ),
  )
  const deleted = deletedResults.some(Boolean)

  if (deleted && markMetadata) {
    await markMediaAssetDeleted(supabase, summary, asset, now.toISOString())
  }
}

async function cleanupOrphanStorageFiles(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  summary: CleanupSummary,
  processedStoragePaths: Set<string>,
  now: Date,
) {
  const orphanCutoff = new Date(now.getTime() - ORPHAN_EXPIRE_AFTER_MS)
  const objects = await fetchExpiredStorageObjects(supabase, summary, orphanCutoff)

  const unprocessedObjects = objects.filter(
    (object) => object.name && !processedStoragePaths.has(object.name),
  )

  if (unprocessedObjects.length === 0) {
    return
  }

  const { data: linkedAssets, error: assetError } = await supabase
    .from("media_assets")
    .select("id, post_id, storage_bucket, storage_path, optimized_storage_bucket, optimized_storage_path, status, created_at, updated_at, deleted_at, posts(id, status, created_at, updated_at)")
    .eq("storage_bucket", POST_MEDIA_BUCKET)
    .in(
      "storage_path",
      unprocessedObjects.map((object) => object.name),
    )

  if (assetError) {
    summary.errors.push({
      storagePath: "",
      stage: "media_fetch",
      message: assetError.message,
    })
    console.error("[media-cleanup] Failed to fetch linked media assets", assetError)
    return
  }

  const assetsByPath = new Map(
    ((linkedAssets ?? []) as MediaAsset[])
      .filter((asset) => asset.storage_path)
      .map((asset) => [asset.storage_path as string, asset]),
  )

  for (const object of unprocessedObjects) {
    const linkedAsset = assetsByPath.get(object.name)
    const linkedPost = linkedAsset ? getLinkedPost(linkedAsset) : null

    if (linkedAsset && linkedAsset.status !== "deleted" && linkedPost) {
      continue
    }

    summary.scanned += 1
    const deleted = await deleteStorageFile(
      supabase,
      summary,
      POST_MEDIA_BUCKET,
      object.name,
      linkedAsset?.id,
    )

    if (deleted && linkedAsset && linkedAsset.status !== "deleted") {
      await markMediaAssetDeleted(supabase, summary, linkedAsset, now.toISOString())
    }
  }
}

function getStorageTargets(asset: MediaAsset) {
  const targets = new Map<string, { bucket: string; path: string }>()

  if (asset.storage_path) {
    targets.set(`${asset.storage_bucket}:${asset.storage_path}`, {
      bucket: asset.storage_bucket,
      path: asset.storage_path,
    })
  }

  if (asset.optimized_storage_path) {
    const bucket = asset.optimized_storage_bucket || asset.storage_bucket
    targets.set(`${bucket}:${asset.optimized_storage_path}`, {
      bucket,
      path: asset.optimized_storage_path,
    })
  }

  return Array.from(targets.values())
}

async function fetchExpiredStorageObjects(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  summary: CleanupSummary,
  orphanCutoff: Date,
) {
  const { data, error } = await supabase
    .schema("storage")
    .from("objects")
    .select("name, bucket_id, created_at, updated_at")
    .eq("bucket_id", POST_MEDIA_BUCKET)
    .lte("created_at", orphanCutoff.toISOString())
    .order("created_at", { ascending: true })
    .limit(ORPHAN_SCAN_LIMIT)

  if (!error) {
    return (data ?? []) as StorageObject[]
  }

  console.warn("[media-cleanup] storage.objects fetch failed; falling back to Storage list API", error)

  const fallbackObjects = await listExpiredStorageObjects(
    supabase,
    summary,
    "",
    orphanCutoff,
  )

  return fallbackObjects
}

async function listExpiredStorageObjects(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  summary: CleanupSummary,
  prefix: string,
  orphanCutoff: Date,
  depth = 0,
): Promise<StorageObject[]> {
  if (depth > STORAGE_LIST_MAX_DEPTH) {
    return []
  }

  const results: StorageObject[] = []
  let offset = 0

  while (results.length < ORPHAN_SCAN_LIMIT) {
    const { data, error } = await supabase.storage.from(POST_MEDIA_BUCKET).list(prefix, {
      limit: STORAGE_LIST_PAGE_SIZE,
      offset,
      sortBy: { column: "name", order: "asc" },
    })

    if (error) {
      summary.errors.push({
        storagePath: prefix,
        stage: "storage_fetch",
        message: error.message,
      })
      console.error("[media-cleanup] Storage list failed", { prefix, error })
      return results
    }

    const entries = (data ?? []) as ListedStorageObject[]

    if (entries.length === 0) {
      return results
    }

    for (const entry of entries) {
      const storagePath = prefix ? `${prefix}/${entry.name}` : entry.name

      if (isStorageFolder(entry)) {
        const childResults = await listExpiredStorageObjects(
          supabase,
          summary,
          storagePath,
          orphanCutoff,
          depth + 1,
        )
        results.push(...childResults)
      } else if (isAtOrBefore(entry.created_at ?? entry.updated_at, orphanCutoff)) {
        results.push({
          name: storagePath,
          bucket_id: POST_MEDIA_BUCKET,
          created_at: entry.created_at ?? null,
          updated_at: entry.updated_at ?? null,
        })
      }

      if (results.length >= ORPHAN_SCAN_LIMIT) {
        return results
      }
    }

    if (entries.length < STORAGE_LIST_PAGE_SIZE) {
      return results
    }

    offset += STORAGE_LIST_PAGE_SIZE
  }

  return results
}

function isStorageFolder(entry: ListedStorageObject) {
  return !entry.id && !entry.created_at && !entry.updated_at
}

export async function POST(request: Request) {
  const cleanupSecret = process.env.CLEANUP_SECRET
  const requestSecret = request.headers.get("x-cleanup-secret")

  if (!cleanupSecret || requestSecret !== cleanupSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let supabase
  try {
    supabase = createSupabaseServiceRoleClient()
  } catch (error) {
    console.error("[media-cleanup] Missing Supabase service role config", error)
    return NextResponse.json({ error: "Cleanup is not configured" }, { status: 500 })
  }

  const summary = createSummary()
  const now = new Date()
  const { data, error } = await supabase
    .from("media_assets")
    .select("id, post_id, storage_bucket, storage_path, optimized_storage_bucket, optimized_storage_path, status, created_at, updated_at, deleted_at, posts(id, status, created_at, updated_at)")
    .eq("storage_bucket", POST_MEDIA_BUCKET)
    .neq("status", "deleted")
    .is("deleted_at", null)
    .order("updated_at", { ascending: true })
    .limit(MEDIA_SCAN_LIMIT)

  if (error) {
    console.error("[media-cleanup] Failed to fetch media assets", error)
    return NextResponse.json({ error: "Failed to fetch cleanup targets" }, { status: 500 })
  }

  const assets = (data ?? []) as MediaAsset[]
  const processedStoragePaths = new Set<string>()

  for (const asset of assets) {
    if (asset.storage_path) {
      processedStoragePaths.add(asset.storage_path)
    }
    if (asset.optimized_storage_path) {
      processedStoragePaths.add(asset.optimized_storage_path)
    }

    await cleanupMediaAsset(supabase, summary, asset, now)
  }

  await cleanupOrphanStorageFiles(supabase, summary, processedStoragePaths, now)
  await recordCleanupRun(supabase, summary, now)

  return NextResponse.json(summary)
}
