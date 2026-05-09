import "server-only"

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role"
import { sanitizeSensitiveText } from "@/lib/server/meta/accounts"
import { getYouTubeOAuthConfig } from "@/lib/server/youtube/config"

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
  token_type?: string
  scope?: string
}

type SocialAccountSecretRpcRow = {
  access_token?: string | null
  refresh_token?: string | null
  scopes?: string[] | null
  provider_account_id?: string | null
  raw_provider_payload?: unknown
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

  const account = await upsertYouTubeAccount(supabase, {
    userId,
    channel,
    tokenExpiresAt,
  })
  const existingSecret = await getYouTubeSecret(supabase, account.id)
  const refreshToken = tokens.refresh_token ?? existingSecret?.refresh_token ?? null
  const scopes = tokens.scope?.split(/\s+/).filter(Boolean) ?? existingSecret?.scopes ?? []

  await upsertSecret(supabase, {
    socialAccountId: account.id,
    accessToken: tokens.access_token,
    refreshToken,
    scopes,
    providerAccountId: channel.id,
    rawProviderPayload: buildTokenRawPayload(tokens, tokenExpiresAt),
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

  const secret = await ensureValidYouTubeUploadSecret({
    supabase,
    account,
    secret: await getYouTubeSecret(supabase, account.id),
  })

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

export async function ensureValidYouTubeUploadSecret({
  supabase,
  account,
  secret,
}: {
  supabase: SupabaseClient
  account: {
    id: string
    user_id: string
    token_expires_at: string | null
    page_id?: string | null
  }
  secret: SocialAccountSecretRpcRow | null
}) {
  if (secret?.access_token && !isAccessTokenExpired(account.token_expires_at)) {
    return {
      social_account_id: account.id,
      access_token: secret.access_token,
      refresh_token: secret.refresh_token ?? null,
      scopes: secret.scopes ?? [],
      provider_account_id: secret.provider_account_id ?? account.page_id ?? null,
    }
  }

  if (!secret?.refresh_token) {
    throw new YouTubeAccountError(
      "YOUTUBE_RECONNECT_REQUIRED",
      "youtube_token_refresh",
      "YouTube 재연결이 필요합니다. 업로드 권한 토큰이 없습니다.",
    )
  }

  const refreshedToken = await refreshYouTubeAccessToken(secret.refresh_token)
  const tokenExpiresAt = refreshedToken.expires_in
    ? new Date(Date.now() + refreshedToken.expires_in * 1000).toISOString()
    : null
  const scopes =
    refreshedToken.scope?.split(/\s+/).filter(Boolean) ?? secret.scopes ?? []
  const refreshToken = refreshedToken.refresh_token ?? secret.refresh_token
  const providerAccountId = secret.provider_account_id ?? account.page_id ?? null

  const { error: accountError } = await supabase
    .from("social_accounts")
    .update({
      status: "connected",
      token_expires_at: tokenExpiresAt,
    })
    .eq("id", account.id)
    .eq("user_id", account.user_id)

  if (accountError) {
    throwYouTubeSupabaseError("youtube_token_expiry_update", accountError)
  }

  await upsertSecret(supabase, {
    socialAccountId: account.id,
    accessToken: refreshedToken.access_token,
    refreshToken,
    scopes,
    providerAccountId,
    rawProviderPayload: buildTokenRawPayload(refreshedToken, tokenExpiresAt),
  })

  return {
    social_account_id: account.id,
    access_token: refreshedToken.access_token,
    refresh_token: refreshToken,
    scopes,
    provider_account_id: providerAccountId,
  }
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
    providerAccountId: string | null
    rawProviderPayload?: Record<string, unknown> | null
  },
) {
  const { error } = await supabase.rpc("upsert_social_account_secret", {
    p_social_account_id: input.socialAccountId,
    p_access_token: input.accessToken,
    p_refresh_token: input.refreshToken,
    p_scopes: input.scopes,
    p_provider_account_id: input.providerAccountId,
    p_raw_provider_payload: input.rawProviderPayload ?? null,
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

async function refreshYouTubeAccessToken(refreshToken: string) {
  const config = getYouTubeOAuthConfig()
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  })
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  })
  const payload = (await response.json().catch(() => ({}))) as YouTubeTokenSet & {
    error?: string
    error_description?: string
  }

  if (!response.ok || !payload.access_token) {
    throw new YouTubeAccountError(
      "YOUTUBE_AUTH_TOKEN_INVALID",
      "youtube_token_refresh",
      payload.error_description ?? payload.error ?? "YouTube token refresh failed",
    )
  }

  return payload
}

function isAccessTokenExpired(expiresAt: string | null) {
  if (!expiresAt) {
    return false
  }

  return new Date(expiresAt).getTime() <= Date.now() + 60 * 1000
}

function buildTokenRawPayload(
  tokens: YouTubeTokenSet,
  expiresAt: string | null,
) {
  return {
    token_type: tokens.token_type ?? "Bearer",
    expires_at: expiresAt,
    scope: tokens.scope ?? null,
  }
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
