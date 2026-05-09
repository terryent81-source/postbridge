import "server-only"

import type { Platform } from "@/lib/db"

export type UploadMode = "mock" | "real"

export function getUploadMode(): UploadMode {
  return parseUploadMode(process.env.UPLOAD_MODE)
}

export function getPlatformUploadMode(
  platform: Platform,
  fallback: UploadMode = getUploadMode(),
): UploadMode {
  if (platform === "youtube") {
    return parseUploadMode(process.env.YOUTUBE_UPLOAD_MODE, fallback)
  }

  if (platform === "facebook" || platform === "instagram") {
    return parseUploadMode(process.env.META_UPLOAD_MODE, fallback)
  }

  if (platform === "tiktok") {
    return parseUploadMode(process.env.TIKTOK_UPLOAD_MODE, fallback)
  }

  return fallback
}

export function getMetaGraphApiVersion() {
  return process.env.META_GRAPH_API_VERSION || "v25.0"
}

function parseUploadMode(
  value: string | undefined,
  fallback: UploadMode = "mock",
): UploadMode {
  return value === "real" || value === "mock" ? value : fallback
}
