import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { sanitizeSensitiveText } from "@/lib/server/meta/accounts"
import {
  TikTokAccountError,
  fetchTikTokProfile,
  upsertTikTokConnection,
} from "@/lib/server/tiktok/accounts"
import { getTikTokOAuthConfig } from "@/lib/server/tiktok/config"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const TIKTOK_OAUTH_STATE_COOKIE = "postbridge_tiktok_oauth_state"

type TikTokTokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  refresh_expires_in?: number
  token_type?: string
  scope?: string
  open_id?: string
  error?: string
  error_description?: string
  message?: string
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const state = requestUrl.searchParams.get("state")
  const providerError =
    requestUrl.searchParams.get("error_description") ??
    requestUrl.searchParams.get("error")

  try {
    if (providerError) {
      throw new TikTokAccountError(
        "TIKTOK_PROVIDER_ERROR",
        "provider_redirect",
        providerError,
      )
    }

    const cookieStore = await cookies()
    const expectedState = cookieStore.get(TIKTOK_OAUTH_STATE_COOKIE)?.value
    cookieStore.delete(TIKTOK_OAUTH_STATE_COOKIE)

    if (!state || !expectedState || state !== expectedState) {
      throw new TikTokAccountError(
        "TIKTOK_STATE_MISMATCH",
        "state_validation",
        "TikTok OAuth state validation failed",
      )
    }

    if (!code) {
      throw new TikTokAccountError(
        "TIKTOK_MISSING_CODE",
        "callback_params",
        "TikTok authorization code is missing",
      )
    }

    const supabase = await createServerSupabaseClient()

    if (!supabase) {
      throw new TikTokAccountError(
        "TIKTOK_SUPABASE_USER_NOT_FOUND",
        "supabase_user",
        "Supabase is not configured",
      )
    }

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      throw new TikTokAccountError(
        "TIKTOK_SUPABASE_USER_NOT_FOUND",
        "supabase_user",
        error?.message ?? "Supabase user was not found",
      )
    }

    const tokens = await exchangeCodeForToken(code, requestUrl.origin)
    let profile = null
    let profileWarning: string | null = null

    try {
      profile = await fetchTikTokProfile(tokens.access_token)
    } catch (error) {
      profile = {
        open_id: tokens.open_id ?? null,
        display_name: null,
        avatar_url: null,
      }
      profileWarning =
        error instanceof TikTokAccountError
          ? "TikTok 계정은 연결되었지만 기본 프로필 권한 확인이 필요합니다."
          : "TikTok 계정은 연결되었지만 프로필 정보를 불러오지 못했습니다."
    }

    await upsertTikTokConnection({
      userId: user.id,
      tokens,
      profile,
      profileWarning,
    })

    return NextResponse.redirect(
      new URL("/dashboard/accounts?tiktok=connected", request.url),
    )
  } catch (error) {
    const safeError = normalizeError(error)
    console.error("[TikTok OAuth Callback]", {
      step: safeError.step,
      errorCode: safeError.code,
      safeMessage: safeError.message,
    })

    return redirectToAccounts(request.url, safeError)
  }
}

async function exchangeCodeForToken(code: string, origin: string) {
  const config = getTikTokOAuthConfig(origin)
  const body = new URLSearchParams({
    client_key: config.clientKey,
    client_secret: config.clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: config.redirectUri,
  })
  const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  })
  const payload = (await response.json().catch(() => ({}))) as TikTokTokenResponse

  if (!response.ok || !payload.access_token) {
    throw new TikTokAccountError(
      "TIKTOK_TOKEN_EXCHANGE_FAILED",
      "token_exchange",
      payload.error_description ??
        payload.message ??
        payload.error ??
        "TikTok token exchange failed",
    )
  }

  return {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token ?? null,
    expires_in: payload.expires_in,
    refresh_expires_in: payload.refresh_expires_in,
    token_type: payload.token_type,
    scope: payload.scope,
    open_id: payload.open_id,
  }
}

function normalizeError(error: unknown) {
  if (error instanceof TikTokAccountError) {
    return error
  }

  return new TikTokAccountError(
    "TIKTOK_CALLBACK_UNKNOWN_ERROR",
    "unknown",
    error instanceof Error ? error.message : "Unknown TikTok OAuth error",
  )
}

function redirectToAccounts(requestUrl: string, error: TikTokAccountError) {
  const url = new URL("/dashboard/accounts", requestUrl)
  url.searchParams.set("error", "TikTok OAuth failed")
  url.searchParams.set("error_code", error.code)
  url.searchParams.set("message", sanitizeSensitiveText(error.message))
  return NextResponse.redirect(url)
}
