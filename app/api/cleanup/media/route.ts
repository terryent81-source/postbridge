import { NextResponse } from "next/server"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const POST_MEDIA_BUCKET = "post-media"
const CLEANUP_BATCH_LIMIT = 100

type PendingMediaAsset = {
  id: string
  storage_bucket: string
  storage_path: string
}

type CleanupFailure = {
  id: string
  storagePath: string
  stage: "storage_remove" | "metadata_update"
  message: string
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

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from("media_assets")
    .select("id, storage_bucket, storage_path")
    .eq("status", "pending_delete")
    .eq("storage_bucket", POST_MEDIA_BUCKET)
    .not("delete_after", "is", null)
    .lte("delete_after", now)
    .is("deleted_at", null)
    .limit(CLEANUP_BATCH_LIMIT)

  if (error) {
    console.error("[media-cleanup] Failed to fetch pending media assets", error)
    return NextResponse.json({ error: "Failed to fetch cleanup targets" }, { status: 500 })
  }

  const targets = (data ?? []) as PendingMediaAsset[]
  const failures: CleanupFailure[] = []
  let deletedCount = 0

  for (const target of targets) {
    const { error: removeError } = await supabase.storage
      .from(target.storage_bucket)
      .remove([target.storage_path])

    if (removeError) {
      failures.push({
        id: target.id,
        storagePath: target.storage_path,
        stage: "storage_remove",
        message: removeError.message,
      })
      console.error("[media-cleanup] Storage remove failed", {
        id: target.id,
        storagePath: target.storage_path,
        error: removeError,
      })
      continue
    }

    const { data: updatedRow, error: updateError } = await supabase
      .from("media_assets")
      .update({
        status: "deleted",
        deleted_at: new Date().toISOString(),
      })
      .eq("id", target.id)
      .eq("status", "pending_delete")
      .is("deleted_at", null)
      .select("id")
      .maybeSingle()

    if (updateError || !updatedRow) {
      failures.push({
        id: target.id,
        storagePath: target.storage_path,
        stage: "metadata_update",
        message: updateError?.message ?? "No pending media_assets row was updated",
      })
      console.error("[media-cleanup] media_assets update failed", {
        id: target.id,
        storagePath: target.storage_path,
        error: updateError,
      })
      continue
    }

    deletedCount += 1
  }

  return NextResponse.json({
    scanned: targets.length,
    deleted: deletedCount,
    failed: failures.length,
    failures,
  })
}
