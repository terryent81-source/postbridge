import "server-only"

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js"
import { sanitizeSensitiveText } from "@/lib/server/meta/accounts"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role"

export type TikTokTokenSet = {
  access_token: string
  refresh_token?: string | null
  expires_in?: number
  refresh_expires_in?: number
  token_type?: string
  scope?: string
  open_id?: string
}

export type TikTokProfile = {
  open_id: string | null
  union_id?: string | null
  display_name?: string | null
  avatar_url?: string | null
}

export type TikTokAccountRow = {
  id: string
  user_id: string
  platform: "tiktok"
  status: "connected" | "needs_connection" | "expired" | "token_missing"
  handle: string | null
  description: string | null
  page_id: string | null
  page_name: string | null
  token_expires_at: string | null
  connected_at: string | null
}

type TikTokSecretRpcRow = {
  access_token?: string | null
  refresh_token?: string | null
  scopes?: string[] | null
  provider_account_id?: string | null
  raw_provider_payload?: unknown
}

export class TikTokAccountError extends Error {
  constructor(
    readonly code: string,
    readonly step: string,
    message: string,
  ) {
    super(sanitizeSensitiveText(message))
    this.name = "TikTokAccountError"
  }
}

export async function fetchTikTokProfile(accessToken: string) {
  const url = new URL("https://open.tiktokapis.com/v2/user/info/")
  url.searchParams.set(
    "fields",
    "open_id,union_id,avatar_url,avatar_url_100,avatar_large_url,display_name",
  )

  let response: Response

  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
  } catch (error) {
    throw new TikTokAccountError(
      "TIKTOK_PROFILE_FETCH_FAILED",
      "profile_fetch",
      error instanceof Error ? error.message : "TikTok profile request failed",
    )
  }

  const payload = (await response.json().catch(() => ({}))) as {
    data?: {
      user?: {
        open_id?: string
        union_id?: string
        avatar_url?: string
        avatar_url_100?: string
        avatar_large_url?: string
        display_name?: string
      }
    }
    error?: { code?: string | number; message?: string; log_id?: string }
  }

  if (!response.ok || (payload.error?.code && payload.error.code !== "ok" && payload.error.code !== 0)) {
    throw new TikTokAccountError(
      "TIKTOK_PROFILE_FETCH_FAILED",
      "profile_fetch",
      [
        `status=${response.status}`,
        payload.error?.code ? `code=${payload.error.code}` : null,
        payload.error?.message,
      ]
        .filter(Boolean)
        .join("; "),
    )
  }

  const user = payload.data?.user

  return {
    open_id: user?.open_id ?? null,
    union_id: user?.union_id ?? null,
    display_name: user?.display_name ?? null,
    avatar_url: user?.avatar_url ?? user?.avatar_url_100 ?? user?.avatar_large_url ?? null,
  } satisfies TikTokProfile
}

export async function upsertTikTokConnection({
  userId,
  tokens,
  profile,
  profileWarning,
}: {
  userId: string
  tokens: TikTokTokenSet
  profile: TikTokProfile | null
  profileWarning?: string | null
}) {
  const supabase = createSupabaseServiceRoleClient()
  const tokenExpiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null
  const scopes = tokens.scope?.split(/[,\s]+/).filter(Boolean) ?? []
  const providerAccountId = profile?.open_id ?? tokens.open_id ?? null
  const account = await upsertTikTokAccount(supabase, {
    userId,
    profile,
    tokenExpiresAt,
    profileWarning,
  })

  await upsertSecret(supabase, {
    socialAccountId: account.id,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    scopes,
    providerAccountId,
    rawProviderPayload: {
      token_type: tokens.token_type ?? "Bearer",
      expires_at: tokenExpiresAt,
      refresh_expires_at: tokens.refresh_expires_in
        ? new Date(Date.now() + tokens.refresh_expires_in * 1000).toISOString()
        : null,
      scope: tokens.scope ?? null,
    },
  })

  return account
}

export async function getTikTokAccount(userId: string) {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("social_accounts")
    .select("id, user_id, platform, status, handle, description, page_id, page_name, token_expires_at, connected_at")
    .eq("user_id", userId)
    .eq("platform", "tiktok")
    .maybeSingle()

  if (error) {
    throwTikTokSupabaseError("tiktok_account_select", error)
  }

  return (data as TikTokAccountRow | null) ?? null
}

export async function refreshTikTokProfile(userId: string) {
  const supabase = createSupabaseServiceRoleClient()
  const account = await getTikTokAccount(userId)

  if (!account) {
    throw new TikTokAccountError(
      "TIKTOK_ACCOUNT_NOT_FOUND",
      "tiktok_account_select",
      "TikTok account is not connected.",
    )
  }

  const secret = await getTikTokSecret(supabase, account.id)

  if (!secret?.access_token) {
    throw new TikTokAccountError(
      "TIKTOK_TOKEN_NOT_FOUND",
      "tiktok_secret_select",
      "TikTok access token was not found.",
    )
  }

  const profile = await fetchTikTokProfile(secret.access_token)

  return upsertTikTokAccount(supabase, {
    userId,
    profile,
    tokenExpiresAt: account.token_expires_at,
    profileWarning: null,
  })
}

export async function disconnectTikTok(userId: string) {
  const supabase = createSupabaseServiceRoleClient()
  const account = await getTikTokAccount(userId)

  if (!account) {
    return null
  }

  const { error: secretError } = await supabase.rpc("delete_social_account_secret", {
    p_social_account_id: account.id,
  })

  if (secretError) {
    throwTikTokSupabaseError("tiktok_secret_delete", secretError)
  }

  const { data, error } = await supabase
    .from("social_accounts")
    .update({
      status: "needs_connection",
      handle: null,
      description: "TikTok 연결이 해제되었습니다.",
      page_id: null,
      page_name: null,
      token_expires_at: null,
      connected_at: null,
    })
    .eq("id", account.id)
    .select("*")
    .single()

  if (error) {
    throwTikTokSupabaseError("tiktok_account_disconnect", error)
  }

  return data as TikTokAccountRow
}

async function upsertTikTokAccount(
  supabase: SupabaseClient,
  input: {
    userId: string
    profile: TikTokProfile | null
    tokenExpiresAt: string | null
    profileWarning?: string | null
  },
) {
  const { data, error } = await supabase
    .from("social_accounts")
    .upsert(
      {
        user_id: input.userId,
        platform: "tiktok",
        status: "connected",
        handle: input.profile?.display_name ?? "TikTok 계정",
        description:
          input.profileWarning ??
          "TikTok 계정이 연결되었습니다. 현재 TikTok은 mock 업로드 모드입니다.",
        page_id: input.profile?.open_id ?? null,
        page_name: input.profile?.display_name ?? null,
        token_expires_at: input.tokenExpiresAt,
        connected_at: new Date().toISOString(),
      },
      { onConflict: "user_id,platform" },
    )
    .select("*")
    .single()

  if (error) {
    throwTikTokSupabaseError("tiktok_account_upsert", error)
  }

  return data as TikTokAccountRow
}

async function upsertSecret(
  supabase: SupabaseClient,
  input: {
    socialAccountId: string
    accessToken: string
    refreshToken: string | null
    scopes: string[]
    providerAccountId: string | null
    rawProviderPayload: Record<string, unknown> | null
  },
) {
  const { error } = await supabase.rpc("upsert_social_account_secret", {
    p_social_account_id: input.socialAccountId,
    p_access_token: input.accessToken,
    p_refresh_token: input.refreshToken,
    p_scopes: input.scopes,
    p_provider_account_id: input.providerAccountId,
    p_raw_provider_payload: input.rawProviderPayload,
  })

  if (error) {
    throwTikTokSupabaseError("tiktok_secret_upsert", error)
  }
}

async function getTikTokSecret(supabase: SupabaseClient, socialAccountId: string) {
  const { data, error } = await supabase
    .rpc("get_social_account_secret", {
      p_social_account_id: socialAccountId,
    })
    .maybeSingle()

  if (error) {
    throwTikTokSupabaseError("tiktok_secret_select", error)
  }

  return (data as TikTokSecretRpcRow | null) ?? null
}

function throwTikTokSupabaseError(step: string, error: PostgrestError): never {
  throw new TikTokAccountError(
    "TIKTOK_SUPABASE_ERROR",
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
