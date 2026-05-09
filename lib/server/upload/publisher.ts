import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Platform } from "@/lib/db"
import { getPlatformUploadMode, getUploadMode } from "@/lib/server/upload/mode"
import {
  uploadToFacebook,
  uploadToInstagram,
  uploadToYouTube,
  uploadUnsupportedPlatform,
} from "@/lib/server/upload/platform-uploaders"
import {
  YouTubeAccountError,
  ensureValidYouTubeUploadSecret,
} from "@/lib/server/youtube/accounts"
import type {
  MediaAssetForUpload,
  PlatformUploadContext,
  PlatformUploadResult,
  PublishablePost,
  SocialAccountForUpload,
  SocialAccountSecretForUpload,
} from "@/lib/server/upload/types"
import { getYouTubePrivacyStatusFromPost } from "@/lib/youtube/privacy"

export async function publishPostWithUploader(
  supabase: SupabaseClient,
  post: PublishablePost,
  attemptedAt = new Date(),
) {
  const defaultUploadMode = getUploadMode()
  const mediaAssets = await listPostMediaAssets(supabase, post)

  if (hasDeletedMedia(mediaAssets)) {
    return failPostWithUploadLogs(
      supabase,
      post,
      "missing_media_file",
      attemptedAt,
      defaultUploadMode,
    )
  }

  const liveMediaAssets = mediaAssets.filter((asset) => !isDeletedMedia(asset))
  const results: PlatformUploadResult[] = []

  for (const platform of post.platforms) {
    const uploadMode = getPlatformUploadMode(platform, defaultUploadMode)

    if (uploadMode === "mock") {
      results.push({
        platform,
        uploadMode,
        status: "success",
        platformPostId: `mock_${platform}_${post.id}`,
        platformMetadata: getUploadLogPlatformMetadata(post, platform),
      })
      continue
    }

    results.push(
      await uploadRealPlatform(supabase, post, platform, liveMediaAssets, uploadMode),
    )
  }

  await insertUploadLogs(supabase, post, results, attemptedAt, defaultUploadMode)

  const failedResults = results.filter((result) => result.status === "failed")
  const publishedAt = failedResults.length === 0 ? attemptedAt.toISOString() : null
  const status = failedResults.length === 0 ? "published" : "failed"
  const failReason =
    failedResults.length === 0
      ? null
      : failedResults
          .map((result) => `${result.platform}: ${result.errorMessage}`)
          .join("; ")

  const { error } = await supabase
    .from("posts")
    .update({
      status,
      published_at: publishedAt,
      fail_reason: failReason,
    })
    .eq("id", post.id)
    .eq("user_id", post.user_id)

  if (error) {
    throw error
  }

  await markPostMediaPendingDelete(
    supabase,
    post,
    status === "published"
      ? attemptedAt
      : new Date(attemptedAt.getTime() + 72 * 60 * 60 * 1000),
  )

  return {
    uploadMode: defaultUploadMode,
    status,
    results,
  }
}

export async function failPostWithUploadLogs(
  supabase: SupabaseClient,
  post: PublishablePost,
  reason: string,
  attemptedAt = new Date(),
  uploadMode = getUploadMode(),
) {
  const results = post.platforms.map<PlatformUploadResult>((platform) => {
    const platformUploadMode = getPlatformUploadMode(platform, uploadMode)

    return {
      platform,
      uploadMode: platformUploadMode,
      status: "failed",
      errorMessage: reason,
      platformMetadata: getUploadLogPlatformMetadata(post, platform),
    }
  })

  await insertUploadLogs(supabase, post, results, attemptedAt, uploadMode)

  const { error } = await supabase
    .from("posts")
    .update({
      status: "failed",
      published_at: null,
      fail_reason: reason,
    })
    .eq("id", post.id)
    .eq("user_id", post.user_id)

  if (error) {
    throw error
  }

  await markPostMediaPendingDelete(
    supabase,
    post,
    new Date(attemptedAt.getTime() + 72 * 60 * 60 * 1000),
  )

  return {
    uploadMode,
    status: "failed" as const,
    results,
  }
}

async function uploadRealPlatform(
  supabase: SupabaseClient,
  post: PublishablePost,
  platform: Platform,
  mediaAssets: MediaAssetForUpload[],
  uploadMode: "real",
) {
  try {
    const account = await getSocialAccount(supabase, post.user_id, platform)
    let secret = account ? await getSocialAccountSecret(supabase, account.id) : null

    if (platform === "youtube" && account) {
      secret = await ensureValidYouTubeUploadSecret({
        supabase,
        account,
        secret,
      })
    }
    const context: PlatformUploadContext = {
      supabase,
      post,
      platform,
      mediaAssets,
      account,
      secret,
      uploadMode,
    }

    if (!account) {
      return {
        platform,
        uploadMode,
        status: "failed" as const,
        errorMessage: "Connected social account is required",
      }
    }

    if (platform === "facebook" && !account.has_page_access_token) {
      return {
        platform,
        uploadMode,
        status: "failed" as const,
        errorMessage:
          "Facebook 게시 권한이 부족합니다. pages_manage_posts 권한과 Page access token이 필요합니다.",
      }
    }

    if (account.status !== "connected") {
      return {
        platform,
        uploadMode,
        status: "failed" as const,
        errorMessage: "Connected social account is required",
      }
    }

    if (platform === "facebook") {
      return withUploadMode(await uploadToFacebook(context), uploadMode)
    }

    if (platform === "instagram") {
      return withUploadMode(await uploadToInstagram(context), uploadMode)
    }

    if (platform === "youtube") {
      return withUploadMode(await uploadToYouTube(context), uploadMode)
    }

    return withUploadMode(await uploadUnsupportedPlatform(context), uploadMode)
  } catch (error) {
    return {
      platform,
      uploadMode,
      status: "failed" as const,
      errorMessage:
        error instanceof YouTubeAccountError
          ? error.code
          : error instanceof Error
            ? error.message
            : "Platform upload failed",
    }
  }
}

async function listPostMediaAssets(
  supabase: SupabaseClient,
  post: PublishablePost,
) {
  const { data, error } = await supabase
    .from("media_assets")
    .select(
      "id, storage_bucket, storage_path, file_name, mime_type, media_type, status, deleted_at",
    )
    .eq("post_id", post.id)
    .eq("user_id", post.user_id)
    .order("created_at", { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []) as MediaAssetForUpload[]
}

async function getSocialAccount(
  supabase: SupabaseClient,
  userId: string,
  platform: Platform,
) {
  const { data, error } = await supabase
    .from("social_accounts")
    .select(
      "id, user_id, platform, status, page_id, page_name, has_page_access_token, instagram_business_account_id, token_expires_at, youtube_shorts_auto_hashtag, youtube_shorts_hashtag_location",
    )
    .eq("user_id", userId)
    .eq("platform", platform)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data as SocialAccountForUpload | null) ?? null
}

async function getSocialAccountSecret(
  supabase: SupabaseClient,
  socialAccountId: string,
) {
  const { data, error } = await supabase
    .rpc("get_social_account_secret", {
      p_social_account_id: socialAccountId,
    })
    .maybeSingle()

  if (error) {
    throw error
  }

  return data
    ? ({
        social_account_id: socialAccountId,
        ...data,
      } as SocialAccountSecretForUpload)
    : null
}

async function insertUploadLogs(
  supabase: SupabaseClient,
  post: PublishablePost,
  results: PlatformUploadResult[],
  attemptedAt: Date,
  uploadMode: "mock" | "real",
) {
  const { error } = await supabase.from("upload_logs").insert(
    results.map((result) => ({
      post_id: post.id,
      user_id: post.user_id,
      platform: result.platform,
      status: result.status,
      upload_mode: result.uploadMode ?? uploadMode,
      platform_metadata:
        result.platformMetadata ?? getUploadLogPlatformMetadata(post, result.platform),
      platform_post_id: result.platformPostId ?? null,
      error_message: result.errorMessage ?? null,
      attempted_at: attemptedAt.toISOString(),
      completed_at:
        result.status === "success" ? attemptedAt.toISOString() : null,
    })),
  )

  if (error) {
    throw error
  }
}

function withUploadMode(
  result: PlatformUploadResult,
  uploadMode: "real",
): PlatformUploadResult {
  return {
    ...result,
    uploadMode,
  }
}

async function markPostMediaPendingDelete(
  supabase: SupabaseClient,
  post: PublishablePost,
  deleteAfter: Date,
) {
  const { error } = await supabase
    .from("media_assets")
    .update({
      status: "pending_delete",
      delete_after: deleteAfter.toISOString(),
    })
    .eq("post_id", post.id)
    .eq("user_id", post.user_id)
    .neq("status", "deleted")
    .is("deleted_at", null)

  if (error) {
    console.error("[uploader] Failed to mark media pending delete", {
      postId: post.id,
      error,
    })
  }
}

function hasDeletedMedia(mediaAssets: MediaAssetForUpload[]) {
  return mediaAssets.some(isDeletedMedia)
}

function isDeletedMedia(media: MediaAssetForUpload) {
  return media.status === "deleted" || Boolean(media.deleted_at)
}

function getUploadLogPlatformMetadata(
  post: PublishablePost,
  platform: Platform,
) {
  if (platform !== "youtube") {
    return {}
  }

  return {
    youtube: {
      privacyStatus: getYouTubePrivacyStatusFromPost(post),
    },
  }
}
