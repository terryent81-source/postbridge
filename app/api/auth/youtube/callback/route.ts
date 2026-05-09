import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { getYouTubeOAuthConfig } from "@/lib/server/youtube/config"
import {
  YouTubeAccountError,
  fetchYouTubeChannel,
  upsertYouTubeConnection,
} from "@/lib/server/youtube/accounts"
import { sanitizeSensitiveText } from "@/lib/server/meta/accounts"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const YOUTUBE_OAUTH_STATE_COOKIE = "postbridge_youtube_oauth_state"

type YouTubeTokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  scope?: string
  error?: string
  error_description?: string
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
      throw new YouTubeAccountError(
        "YOUTUBE_PROVIDER_ERROR",
        "provider_redirect",
        providerError,
      )
    }

    const cookieStore = await cookies()
    const expectedState = cookieStore.get(YOUTUBE_OAUTH_STATE_COOKIE)?.value
    cookieStore.delete(YOUTUBE_OAUTH_STATE_COOKIE)

    if (!state || !expectedState || state !== expectedState) {
      throw new YouTubeAccountError(
        "YOUTUBE_STATE_MISMATCH",
        "state_validation",
        "YouTube OAuth state validation failed",
      )
    }

    if (!code) {
      throw new YouTubeAccountError(
        "YOUTUBE_MISSING_CODE",
        "callback_params",
        "YouTube authorization code is missing",
      )
    }

    const supabase = await createServerSupabaseClient()

    if (!supabase) {
      throw new YouTubeAccountError(
        "YOUTUBE_SUPABASE_USER_NOT_FOUND",
        "supabase_user",
        "Supabase is not configured",
      )
    }

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      throw new YouTubeAccountError(
        "YOUTUBE_SUPABASE_USER_NOT_FOUND",
        "supabase_user",
        error?.message ?? "Supabase user was not found",
      )
    }

    const tokens = await exchangeCodeForToken(code, requestUrl.origin)
    const channel = await fetchYouTubeChannel(tokens.access_token)

    await upsertYouTubeConnection({
      userId: user.id,
      tokens,
      channel,
    })

    return NextResponse.redirect(
      new URL("/dashboard/accounts?youtube=connected", request.url),
    )
  } catch (error) {
    const safeError = normalizeError(error)
    console.error("[YouTube OAuth Callback]", {
      step: safeError.step,
      errorCode: safeError.code,
      safeMessage: safeError.message,
    })

    return redirectToAccounts(request.url, safeError)
  }
}

async function exchangeCodeForToken(code: string, origin: string) {
  const config = getYouTubeOAuthConfig(origin)
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: config.redirectUri,
  })
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  })
  const payload = (await response.json().catch(() => ({}))) as YouTubeTokenResponse

  if (!response.ok || !payload.access_token) {
    throw new YouTubeAccountError(
      "YOUTUBE_TOKEN_EXCHANGE_FAILED",
      "token_exchange",
      payload.error_description ?? payload.error ?? "YouTube token exchange failed",
    )
  }

  return {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token ?? null,
    expires_in: payload.expires_in,
    scope: payload.scope,
  }
}

function normalizeError(error: unknown) {
  if (error instanceof YouTubeAccountError) {
    return error
  }

  return new YouTubeAccountError(
    "YOUTUBE_CALLBACK_UNKNOWN_ERROR",
    "unknown",
    error instanceof Error ? error.message : "Unknown YouTube OAuth error",
  )
}

function redirectToAccounts(requestUrl: string, error: YouTubeAccountError) {
  const url = new URL("/dashboard/accounts", requestUrl)
  url.searchParams.set("error", "YouTube OAuth failed")
  url.searchParams.set("error_code", error.code)
  url.searchParams.set("message", sanitizeSensitiveText(error.message))
  return NextResponse.redirect(url)
}
