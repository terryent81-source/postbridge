import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { getMetaOAuthConfig } from "@/lib/server/meta/config"
import {
  getTokenExpiresAt,
  upsertMetaConnection,
} from "@/lib/server/meta/accounts"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const META_OAUTH_STATE_COOKIE = "postbridge_meta_oauth_state"

type MetaCallbackErrorCode =
  | "META_CALLBACK_MISSING_CODE"
  | "META_CALLBACK_STATE_MISMATCH"
  | "META_TOKEN_EXCHANGE_FAILED"
  | "META_TOKEN_RESPONSE_INVALID"
  | "META_USER_INFO_FAILED"
  | "META_SUPABASE_USER_NOT_FOUND"
  | "META_SUPABASE_SAVE_FAILED"
  | "META_CALLBACK_UNKNOWN_ERROR"

type MetaTokenResponse = {
  access_token?: string
  token_type?: string
  expires_in?: number
  error?: MetaSafeError
}

type MetaSafeError = {
  message?: string
  type?: string
  code?: number
}

class MetaOAuthCallbackError extends Error {
  constructor(
    readonly errorCode: MetaCallbackErrorCode,
    readonly step: string,
    message: string,
    readonly meta?: {
      status?: number
      errorType?: string
      metaErrorCode?: number
    },
  ) {
    super(sanitizeSensitiveText(message))
    this.name = "MetaOAuthCallbackError"
  }
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
      throw new MetaOAuthCallbackError(
        "META_CALLBACK_UNKNOWN_ERROR",
        "provider_redirect",
        providerError,
      )
    }

    const cookieStore = await cookies()
    const expectedState = cookieStore.get(META_OAUTH_STATE_COOKIE)?.value
    cookieStore.delete(META_OAUTH_STATE_COOKIE)

    if (!state || !expectedState || state !== expectedState) {
      throw new MetaOAuthCallbackError(
        "META_CALLBACK_STATE_MISMATCH",
        "state_validation",
        "Meta OAuth state validation failed",
      )
    }

    if (!code) {
      throw new MetaOAuthCallbackError(
        "META_CALLBACK_MISSING_CODE",
        "callback_params",
        "Meta OAuth authorization code is missing",
      )
    }

    const supabase = await createServerSupabaseClient()

    if (!supabase) {
      throw new MetaOAuthCallbackError(
        "META_SUPABASE_USER_NOT_FOUND",
        "supabase_user",
        "Supabase is not configured",
      )
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      throw new MetaOAuthCallbackError(
        "META_SUPABASE_USER_NOT_FOUND",
        "supabase_user",
        userError?.message ?? "Supabase user was not found",
      )
    }

    const origin = requestUrl.origin
    const shortLivedToken = await exchangeCodeForToken(code, origin)
    const longLivedToken = await exchangeLongLivedToken(
      shortLivedToken.access_token,
      origin,
    )

    await fetchMetaUserInfo(longLivedToken.access_token)

    try {
      await upsertMetaConnection({
        userId: user.id,
        userAccessToken: longLivedToken.access_token,
        expiresAt: getTokenExpiresAt(longLivedToken.expires_in),
      })
    } catch (error) {
      throw new MetaOAuthCallbackError(
        "META_SUPABASE_SAVE_FAILED",
        "supabase_save",
        getSafeErrorMessage(error),
      )
    }

    return NextResponse.redirect(new URL("/dashboard/accounts?meta=connected", request.url))
  } catch (error) {
    const callbackError = normalizeCallbackError(error)
    logMetaCallbackError(callbackError)

    return redirectToAccounts(request.url, {
      errorCode: callbackError.errorCode,
      message: callbackError.message,
    })
  }
}

async function exchangeCodeForToken(code: string, origin: string) {
  const config = getMetaOAuthConfig(origin)
  const url = new URL(`https://graph.facebook.com/${config.graphVersion}/oauth/access_token`)
  url.searchParams.set("client_id", config.clientId)
  url.searchParams.set("client_secret", config.clientSecret)
  url.searchParams.set("redirect_uri", config.redirectUri)
  url.searchParams.set("code", code)

  return fetchMetaToken(url, "token_exchange")
}

async function exchangeLongLivedToken(
  shortLivedToken: string | undefined,
  origin: string,
) {
  if (!shortLivedToken) {
    throw new MetaOAuthCallbackError(
      "META_TOKEN_RESPONSE_INVALID",
      "long_lived_token_input",
      "Short-lived Meta access token is missing",
    )
  }

  const config = getMetaOAuthConfig(origin)
  const url = new URL(`https://graph.facebook.com/${config.graphVersion}/oauth/access_token`)
  url.searchParams.set("grant_type", "fb_exchange_token")
  url.searchParams.set("client_id", config.clientId)
  url.searchParams.set("client_secret", config.clientSecret)
  url.searchParams.set("fb_exchange_token", shortLivedToken)

  return fetchMetaToken(url, "long_lived_token_exchange")
}

async function fetchMetaToken(url: URL, step: string) {
  const response = await fetch(url)
  const payload = (await response.json().catch(() => ({}))) as MetaTokenResponse

  if (!response.ok) {
    throw new MetaOAuthCallbackError(
      "META_TOKEN_EXCHANGE_FAILED",
      step,
      payload.error?.message ?? "Token exchange failed",
      {
        status: response.status,
        errorType: payload.error?.type,
        metaErrorCode: payload.error?.code,
      },
    )
  }

  if (!payload.access_token) {
    throw new MetaOAuthCallbackError(
      "META_TOKEN_RESPONSE_INVALID",
      step,
      "Meta token response did not include an access token",
      {
        status: response.status,
        errorType: payload.error?.type,
        metaErrorCode: payload.error?.code,
      },
    )
  }

  return {
    access_token: payload.access_token,
    expires_in: payload.expires_in,
  }
}

async function fetchMetaUserInfo(accessToken: string) {
  const graphVersion = process.env.META_GRAPH_API_VERSION || "v25.0"
  const url = new URL(`https://graph.facebook.com/${graphVersion}/me`)
  url.searchParams.set("fields", "id,name")
  url.searchParams.set("access_token", accessToken)

  const response = await fetch(url)
  const payload = (await response.json().catch(() => ({}))) as {
    id?: string
    error?: MetaSafeError
  }

  if (!response.ok || !payload.id) {
    throw new MetaOAuthCallbackError(
      "META_USER_INFO_FAILED",
      "user_info",
      payload.error?.message ?? "Meta user info request failed",
      {
        status: response.status,
        errorType: payload.error?.type,
        metaErrorCode: payload.error?.code,
      },
    )
  }
}

function redirectToAccounts(
  requestUrl: string,
  input: { errorCode: MetaCallbackErrorCode; message: string },
) {
  const url = new URL("/dashboard/accounts", requestUrl)
  url.searchParams.set("error", "Meta OAuth failed")
  url.searchParams.set("error_code", input.errorCode)
  url.searchParams.set("message", sanitizeSensitiveText(input.message))
  return NextResponse.redirect(url)
}

function normalizeCallbackError(error: unknown) {
  if (error instanceof MetaOAuthCallbackError) {
    return error
  }

  return new MetaOAuthCallbackError(
    "META_CALLBACK_UNKNOWN_ERROR",
    "unknown",
    getSafeErrorMessage(error),
  )
}

function logMetaCallbackError(error: MetaOAuthCallbackError) {
  console.error("[Meta OAuth Callback]", {
    step: error.step,
    status: error.meta?.status,
    errorCode: error.errorCode,
    errorType: sanitizeSensitiveText(error.meta?.errorType ?? ""),
    metaErrorCode: error.meta?.metaErrorCode,
    safeMessage: error.message,
  })
}

function getSafeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return sanitizeSensitiveText(error.message)
  }

  if (typeof error === "string") {
    return sanitizeSensitiveText(error)
  }

  return "Unknown error"
}

function sanitizeSensitiveText(value: string) {
  return value
    .replace(/access_token=([^&\s]+)/gi, "access_token=[REDACTED]")
    .replace(/fb_exchange_token=([^&\s]+)/gi, "fb_exchange_token=[REDACTED]")
    .replace(/client_secret=([^&\s]+)/gi, "client_secret=[REDACTED]")
    .replace(/refresh_token=([^&\s]+)/gi, "refresh_token=[REDACTED]")
    .replace(/code=([^&\s]+)/gi, "code=[REDACTED]")
    .replace(/"access_token"\s*:\s*"[^"]+"/gi, '"access_token":"[REDACTED]"')
    .replace(/"client_secret"\s*:\s*"[^"]+"/gi, '"client_secret":"[REDACTED]"')
    .replace(/"refresh_token"\s*:\s*"[^"]+"/gi, '"refresh_token":"[REDACTED]"')
    .replace(/"code"\s*:\s*"[^"]+"/gi, '"code":"[REDACTED]"')
}
