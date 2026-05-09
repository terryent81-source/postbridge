import type { Platform, Post, PostStatus, SocialAccount, UploadLog, UploadStatus } from "./types"

const DATE_FORMATTER = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})

export type UiPost = {
  id: string
  title: string
  platforms: Platform[]
  status: PostStatus
  scheduledAt?: string
  createdAt: string
  failReason?: string
}

export type UiSocialAccount = {
  platform: Platform
  status: SocialAccount["status"]
  handle?: string
  description: string
}

export type UiUploadLog = {
  id: string
  postId: string
  title: string
  platform: Platform
  platforms: Platform[]
  status: UploadStatus
  uploadMode?: UploadLog["upload_mode"]
  platformPostId?: string
  youtubeUrl?: string
  youtubeStudioUrl?: string
  postStatus: PostStatus
  attemptedAt: string
  errorMessage?: string
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return undefined
  return DATE_FORMATTER.format(new Date(value)).replace("T", " ")
}

export function mapPostToUi(post: Post): UiPost {
  return {
    id: post.id,
    title: post.title,
    platforms: post.platforms,
    status: post.status,
    scheduledAt: formatDateTime(post.scheduled_at),
    createdAt: formatDateTime(post.created_at) ?? post.created_at,
    failReason: post.fail_reason ?? undefined,
  }
}

export function mapSocialAccountToUi(account: SocialAccount): UiSocialAccount {
  return {
    platform: account.platform,
    status: account.status,
    handle: account.handle ?? undefined,
    description: account.description ?? "연결 정보를 확인해 주세요.",
  }
}

export function mapUploadLogToUi(log: UploadLog, post?: Post | null): UiUploadLog {
  return {
    id: log.id,
    postId: log.post_id,
    title: post?.title ?? "삭제되었거나 찾을 수 없는 게시물",
    platform: log.platform,
    platforms: post?.platforms ?? [log.platform],
    status: log.status,
    uploadMode: log.upload_mode,
    platformPostId: log.platform_post_id ?? undefined,
    youtubeUrl: getYouTubeMetadataValue(log, "youtubeUrl"),
    youtubeStudioUrl: getYouTubeMetadataValue(log, "youtubeStudioUrl"),
    postStatus: log.status === "success" ? "published" : log.status === "failed" ? "failed" : "scheduled",
    attemptedAt: formatDateTime(log.attempted_at) ?? log.attempted_at,
    errorMessage: log.error_message ?? undefined,
  }
}

function getYouTubeMetadataValue(
  log: UploadLog,
  key: "youtubeUrl" | "youtubeStudioUrl",
) {
  const youtube = log.platform_metadata?.youtube

  if (!youtube || typeof youtube !== "object" || !(key in youtube)) {
    return undefined
  }

  const value = (youtube as Record<string, unknown>)[key]
  return typeof value === "string" ? value : undefined
}
