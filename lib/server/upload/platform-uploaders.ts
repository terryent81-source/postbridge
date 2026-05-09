import "server-only"

import { getMetaGraphApiVersion } from "@/lib/server/upload/mode"
import type {
  MediaAssetForUpload,
  PlatformUploadContext,
  PlatformUploadResult,
} from "@/lib/server/upload/types"
import { getYouTubePrivacyStatusFromPost } from "@/lib/youtube/privacy"

const SIGNED_MEDIA_URL_EXPIRES_IN_SECONDS = 24 * 60 * 60

export async function uploadToFacebook(
  context: PlatformUploadContext,
): Promise<PlatformUploadResult> {
  if (!context.account?.page_id) {
    return fail(context, "Facebook Page ID is missing")
  }

  if (!context.secret?.access_token) {
    return fail(
      context,
      "Facebook 게시 권한이 부족합니다. pages_manage_posts 권한과 Page access token이 필요합니다.",
    )
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
  if (!context.secret?.access_token) {
    return fail(context, "YouTube access token is missing")
  }

  const media = context.mediaAssets.find((asset) => asset.media_type === "video")

  if (!media) {
    return fail(context, "YouTube upload requires a video file")
  }

  const mediaUrl = await createSignedMediaUrl(context, media)
  const mediaResponse = await fetch(mediaUrl)

  if (!mediaResponse.ok) {
    return fail(context, "Could not read the video file for YouTube upload")
  }

  const metadata = buildYouTubeVideoMetadata(context)
  const boundary = `postbridge_${crypto.randomUUID().replace(/-/g, "")}`
  const mediaBytes = new Uint8Array(await mediaResponse.arrayBuffer())
  const body = new Blob(
    [
      `--${boundary}\r\n`,
      "Content-Type: application/json; charset=UTF-8\r\n\r\n",
      JSON.stringify(metadata),
      "\r\n",
      `--${boundary}\r\n`,
      `Content-Type: ${media.mime_type || "video/mp4"}\r\n\r\n`,
      mediaBytes,
      "\r\n",
      `--${boundary}--\r\n`,
    ],
    { type: `multipart/related; boundary=${boundary}` },
  )

  const response = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${context.secret.access_token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  )
  const payload = (await response.json().catch(() => ({}))) as {
    id?: string
    error?: { message?: string }
  }

  if (!response.ok) {
    return fail(context, payload.error?.message ?? "YouTube upload failed")
  }

  return {
    platform: context.platform,
    status: "success",
    platformPostId: payload.id ?? null,
    platformMetadata: {
      youtube: {
        privacyStatus: getYouTubePrivacyStatusFromPost(context.post),
      },
    },
  }
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

function buildYouTubeVideoMetadata(context: PlatformUploadContext) {
  const title = withOptionalShortsHashtag(
    context.post.title.trim() || "PostBridge Upload",
    "title",
    context,
  )
  const description = withOptionalShortsHashtag(
    context.post.content.trim(),
    "description",
    context,
  )

  return {
    snippet: {
      title: truncateYouTubeTitle(title),
      description,
      categoryId: "22",
    },
    status: {
      privacyStatus: getYouTubePrivacyStatusFromPost(context.post),
      selfDeclaredMadeForKids: false,
    },
  }
}

function withOptionalShortsHashtag(
  value: string,
  field: "title" | "description",
  context: PlatformUploadContext,
) {
  if (!context.account?.youtube_shorts_auto_hashtag) {
    return value
  }

  if (context.account.youtube_shorts_hashtag_location !== field) {
    return value
  }

  if (/#shorts\b/i.test(value)) {
    return value
  }

  return field === "title"
    ? `${value} #Shorts`
    : [value, "#Shorts"].filter(Boolean).join("\n\n")
}

function truncateYouTubeTitle(value: string) {
  if (value.length <= 100) {
    return value
  }

  if (/#shorts\b/i.test(value)) {
    const suffix = " #Shorts"
    return `${value.slice(0, 100 - suffix.length).trimEnd()}${suffix}`
  }

  return value.slice(0, 100)
}

function fail(context: PlatformUploadContext, message: string): PlatformUploadResult {
  return {
    platform: context.platform,
    status: "failed",
    errorMessage: message,
    platformMetadata:
      context.platform === "youtube"
        ? {
            youtube: {
              privacyStatus: getYouTubePrivacyStatusFromPost(context.post),
            },
          }
        : null,
  }
}
