import "server-only"

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role"
import { sanitizeSensitiveText } from "@/lib/server/meta/accounts"

export type YouTubeChannel = {
  id: string
  title: string
  description?: string
  customUrl?: string
  thumbnails?: unknown
}

export type YouTubeTokenSet = {
  access_token: string
  refresh_token?: string | null
  expires_in?: number
  scope?: string
}

type SocialAccountSecretRpcRow = {
  access_token?: string | null
  refresh_token?: string | null
  scopes?: string[] | null
  provider_account_id?: string | null
}

export type YouTubeAccountRow = {
  id: string
  user_id: string
  platform: "youtube"
  status: "connected" | "needs_connection" | "expired" | "token_missing"
  handle: string | null
  description: string | null
  page_id: string | null
  page_name: string | null
  token_expires_at: string | null
  connected_at: string | null
  youtube_shorts_auto_hashtag?: boolean
  youtube_shorts_hashtag_location?: "title" | "description"
}

export class YouTubeAccountError extends Error {
  constructor(
    readonly code: string,
    readonly step: string,
    message: string,
  ) {
    super(sanitizeSensitiveText(message))
    this.name = "YouTubeAccountError"
  }
}

export async function fetchYouTubeChannel(accessToken: string) {
  let response: Response

  try {
    response = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    )
  } catch (error) {
    throw new YouTubeAccountError(
      "YOUTUBE_CHANNEL_FETCH_FAILED",
      "channel_fetch",
      error instanceof Error ? error.message : "YouTube channel request failed",
    )
  }

  const payload = (await response.json().catch(() => ({}))) as {
    items?: Array<{
      id?: string
      snippet?: {
        title?: string
        description?: string
        customUrl?: string
        thumbnails?: unknown
      }
    }>
    error?: { message?: string; code?: number; status?: string }
  }

  if (!response.ok) {
    throw new YouTubeAccountError(
      "YOUTUBE_CHANNEL_FETCH_FAILED",
      "channel_fetch",
      [
        `status=${response.status}`,
        payload.error?.status,
        payload.error?.code ? `code=${payload.error.code}` : null,
        payload.error?.message,
      ]
        .filter(Boolean)
        .join("; "),
    )
  }

  const item = payload.items?.[0]

  if (!item?.id || !item.snippet?.title) {
    throw new YouTubeAccountError(
      "YOUTUBE_CHANNEL_NOT_FOUND",
      "channel_parse",
      "No YouTube channel was found for this Google account.",
    )
  }

  return {
    id: item.id,
    title: item.snippet.title,
    description: item.snippet.description,
    customUrl: item.snippet.customUrl,
    thumbnails: item.snippet.thumbnails,
  } satisfies YouTubeChannel
}

export async function upsertYouTubeConnection({
  userId,
  tokens,
  channel,
}: {
  userId: string
  tokens: YouTubeTokenSet
  channel: YouTubeChannel
}) {
  const supabase = createSupabaseServiceRoleClient()
  const tokenExpiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null
  const scopes = tokens.scope?.split(/\s+/).filter(Boolean) ?? []

  const account = await upsertYouTubeAccount(supabase, {
    userId,
    channel,
    tokenExpiresAt,
  })

  await upsertSecret(supabase, {
    socialAccountId: account.id,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    scopes,
    providerAccountId: channel.id,
  })

  return account
}

export async function getYouTubeAccount(userId: string) {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("social_accounts")
    .select(
      "id, user_id, platform, status, handle, description, page_id, page_name, token_expires_at, connected_at, youtube_shorts_auto_hashtag, youtube_shorts_hashtag_location",
    )
    .eq("user_id", userId)
    .eq("platform", "youtube")
    .maybeSingle()

  if (error) {
    throwYouTubeSupabaseError("youtube_account_select", error)
  }

  return (data as YouTubeAccountRow | null) ?? null
}

export async function refreshYouTubeChannel(userId: string) {
  const supabase = createSupabaseServiceRoleClient()
  const account = await getYouTubeAccount(userId)

  if (!account) {
    throw new YouTubeAccountError(
      "YOUTUBE_ACCOUNT_NOT_FOUND",
      "youtube_account_select",
      "YouTube account is not connected.",
    )
  }

  const secret = await getYouTubeSecret(supabase, account.id)

  if (!secret?.access_token) {
    throw new YouTubeAccountError(
      "YOUTUBE_TOKEN_NOT_FOUND",
      "youtube_secret_select",
      "YouTube access token was not found.",
    )
  }

  const channel = await fetchYouTubeChannel(secret.access_token)

  return upsertYouTubeAccount(supabase, {
    userId,
    channel,
    tokenExpiresAt: account.token_expires_at,
  })
}

export async function disconnectYouTube(userId: string) {
  const supabase = createSupabaseServiceRoleClient()
  const account = await getYouTubeAccount(userId)

  if (!account) {
    return null
  }

  const { error: secretError } = await supabase.rpc("delete_social_account_secret", {
    p_social_account_id: account.id,
  })

  if (secretError) {
    throwYouTubeSupabaseError("youtube_secret_delete", secretError)
  }

  const { data, error } = await supabase
    .from("social_accounts")
    .update({
      status: "needs_connection",
      handle: null,
      description: "YouTube 연결이 해제되었습니다.",
      page_id: null,
      page_name: null,
      token_expires_at: null,
      connected_at: null,
    })
    .eq("id", account.id)
    .select("*")
    .single()

  if (error) {
    throwYouTubeSupabaseError("youtube_account_disconnect", error)
  }

  return data as YouTubeAccountRow
}

export async function updateYouTubeShortsSettings({
  userId,
  autoHashtag,
  hashtagLocation,
}: {
  userId: string
  autoHashtag: boolean
  hashtagLocation: "title" | "description"
}) {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("social_accounts")
    .update({
      youtube_shorts_auto_hashtag: autoHashtag,
      youtube_shorts_hashtag_location: hashtagLocation,
    })
    .eq("user_id", userId)
    .eq("platform", "youtube")
    .select("*")
    .single()

  if (error) {
    throwYouTubeSupabaseError("youtube_shorts_settings_update", error)
  }

  return data as YouTubeAccountRow
}

async function upsertYouTubeAccount(
  supabase: SupabaseClient,
  input: {
    userId: string
    channel: YouTubeChannel
    tokenExpiresAt: string | null
  },
) {
  const { data, error } = await supabase
    .from("social_accounts")
    .upsert(
      {
        user_id: input.userId,
        platform: "youtube",
        status: "connected",
        handle: input.channel.customUrl ?? input.channel.title,
        description: input.channel.description ?? "YouTube 채널이 연결되었습니다.",
        page_id: input.channel.id,
        page_name: input.channel.title,
        has_page_access_token: true,
        token_expires_at: input.tokenExpiresAt,
        connected_at: new Date().toISOString(),
      },
      { onConflict: "user_id,platform" },
    )
    .select("*")
    .single()

  if (error) {
    throwYouTubeSupabaseError("youtube_account_upsert", error)
  }

  return data as YouTubeAccountRow
}

async function upsertSecret(
  supabase: SupabaseClient,
  input: {
    socialAccountId: string
    accessToken: string
    refreshToken: string | null
    scopes: string[]
    providerAccountId: string
  },
) {
  const { error } = await supabase.rpc("upsert_social_account_secret", {
    p_social_account_id: input.socialAccountId,
    p_access_token: input.accessToken,
    p_refresh_token: input.refreshToken,
    p_scopes: input.scopes,
    p_provider_account_id: input.providerAccountId,
    p_raw_provider_payload: null,
  })

  if (error) {
    throwYouTubeSupabaseError("youtube_secret_upsert", error)
  }
}

async function getYouTubeSecret(
  supabase: SupabaseClient,
  socialAccountId: string,
) {
  const { data, error } = await supabase
    .rpc("get_social_account_secret", {
      p_social_account_id: socialAccountId,
    })
    .maybeSingle()

  if (error) {
    throwYouTubeSupabaseError("youtube_secret_select", error)
  }

  return (data as SocialAccountSecretRpcRow | null) ?? null
}

function throwYouTubeSupabaseError(step: string, error: PostgrestError): never {
  throw new YouTubeAccountError(
    "YOUTUBE_SUPABASE_ERROR",
    step,
    [
      error.code ? `code=${error.code}` : null,
      `message=${error.message}`,
      error.details ? `details=${error.details}` : null,
      error.hint ? `hint=${error.hint}` : null,
    ]
      .filter(Boolean)
      .join("; "),
  )
}
