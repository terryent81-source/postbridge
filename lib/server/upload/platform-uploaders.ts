import "server-only"

import { getMetaGraphApiVersion } from "@/lib/server/upload/mode"
import type {
  MediaAssetForUpload,
  PlatformUploadContext,
  PlatformUploadResult,
} from "@/lib/server/upload/types"

const SIGNED_MEDIA_URL_EXPIRES_IN_SECONDS = 24 * 60 * 60

export async function uploadToFacebook(
  context: PlatformUploadContext,
): Promise<PlatformUploadResult> {
  if (!context.account?.page_id) {
    return fail(context, "Facebook Page ID is missing")
  }

  if (!context.secret?.access_token) {
    return fail(context, "Facebook page access token is missing")
  }

  const media = context.mediaAssets[0]
  const graphVersion = getMetaGraphApiVersion()

  if (!media) {
    const response = await postGraphRequest(
      `https://graph.facebook.com/${graphVersion}/${context.account.page_id}/feed`,
      {
        message: context.post.content,
        access_token: context.secret.access_token,
      },
    )

    return parseGraphResult(context, response)
  }

  const mediaUrl = await createSignedMediaUrl(context, media)
  const endpoint = media.media_type === "video" ? "videos" : "photos"
  const payload: Record<string, string> =
    media.media_type === "video"
      ? {
          file_url: mediaUrl,
          description: context.post.content,
          access_token: context.secret.access_token,
        }
      : {
          url: mediaUrl,
          caption: context.post.content,
          access_token: context.secret.access_token,
        }

  const response = await postGraphRequest(
    `https://graph.facebook.com/${graphVersion}/${context.account.page_id}/${endpoint}`,
    payload,
  )

  return parseGraphResult(context, response)
}

export async function uploadToInstagram(
  context: PlatformUploadContext,
): Promise<PlatformUploadResult> {
  if (!context.account?.instagram_business_account_id) {
    return fail(context, "Instagram Business Account ID is missing")
  }

  if (!context.secret?.access_token) {
    return fail(context, "Instagram access token is missing")
  }

  const media = context.mediaAssets[0]

  if (!media) {
    return fail(context, "Instagram publishing requires an image or video")
  }

  const mediaUrl = await createSignedMediaUrl(context, media)
  const graphVersion = getMetaGraphApiVersion()
  const mediaPayload: Record<string, string> =
    media.media_type === "video"
      ? {
          media_type: "REELS",
          video_url: mediaUrl,
          caption: context.post.content,
          access_token: context.secret.access_token,
        }
      : {
          image_url: mediaUrl,
          caption: context.post.content,
          access_token: context.secret.access_token,
        }

  const containerResponse = await postGraphRequest(
    `https://graph.facebook.com/${graphVersion}/${context.account.instagram_business_account_id}/media`,
    mediaPayload,
  )

  if (!containerResponse.ok || !containerResponse.body.id) {
    return parseGraphResult(context, containerResponse)
  }

  const publishResponse = await postGraphRequest(
    `https://graph.facebook.com/${graphVersion}/${context.account.instagram_business_account_id}/media_publish`,
    {
      creation_id: containerResponse.body.id,
      access_token: context.secret.access_token,
    },
  )

  return parseGraphResult(context, publishResponse)
}

export async function uploadToYouTube(
  context: PlatformUploadContext,
): Promise<PlatformUploadResult> {
  return fail(context, "YouTube real uploader is not implemented yet")
}

export async function uploadUnsupportedPlatform(
  context: PlatformUploadContext,
): Promise<PlatformUploadResult> {
  return fail(context, `${context.platform} real uploader is not implemented yet`)
}

async function createSignedMediaUrl(
  context: PlatformUploadContext,
  media: MediaAssetForUpload,
) {
  const { data, error } = await context.supabase.storage
    .from(media.storage_bucket)
    .createSignedUrl(media.storage_path, SIGNED_MEDIA_URL_EXPIRES_IN_SECONDS)

  if (error || !data?.signedUrl) {
    throw error ?? new Error("Could not create a signed media URL")
  }

  return data.signedUrl
}

async function postGraphRequest(url: string, payload: Record<string, string>) {
  const body = new URLSearchParams(payload)
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  })

  const responseBody = (await response.json().catch(() => ({}))) as {
    id?: string
    post_id?: string
    error?: { message?: string }
  }

  return {
    ok: response.ok,
    body: responseBody,
  }
}

function parseGraphResult(
  context: PlatformUploadContext,
  response: Awaited<ReturnType<typeof postGraphRequest>>,
): PlatformUploadResult {
  if (!response.ok) {
    return fail(
      context,
      response.body.error?.message ?? "Platform API upload failed",
    )
  }

  return {
    platform: context.platform,
    status: "success",
    platformPostId: response.body.id ?? response.body.post_id ?? null,
  }
}

function fail(context: PlatformUploadContext, message: string): PlatformUploadResult {
  return {
    platform: context.platform,
    status: "failed",
    errorMessage: message,
  }
}
