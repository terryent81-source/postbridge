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

type MetaTokenResponse = {
  access_token?: string
  token_type?: string
  expires_in?: number
  error?: { message?: string }
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const state = requestUrl.searchParams.get("state")
  const error = requestUrl.searchParams.get("error_description")

  if (error) {
    return redirectToAccounts(request.url, `Meta OAuth failed: ${error}`)
  }

  const cookieStore = await cookies()
  const expectedState = cookieStore.get(META_OAUTH_STATE_COOKIE)?.value
  cookieStore.delete(META_OAUTH_STATE_COOKIE)

  if (!state || !expectedState || state !== expectedState) {
    return redirectToAccounts(request.url, "Meta OAuth state validation failed")
  }

  if (!code) {
    return redirectToAccounts(request.url, "Meta OAuth authorization code is missing")
  }

  const supabase = await createServerSupabaseClient()

  if (!supabase) {
    return redirectToAccounts(request.url, "Supabase is not configured")
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  try {
    const origin = requestUrl.origin
    const shortLivedToken = await exchangeCodeForToken(code, origin)
    const longLivedToken = await exchangeLongLivedToken(
      shortLivedToken.access_token,
      origin,
    )

    await upsertMetaConnection({
      userId: user.id,
      userAccessToken: longLivedToken.access_token,
      expiresAt: getTokenExpiresAt(longLivedToken.expires_in),
    })

    return NextResponse.redirect(new URL("/dashboard/accounts?meta=connected", request.url))
  } catch (tokenError) {
    return redirectToAccounts(
      request.url,
      tokenError instanceof Error ? tokenError.message : "Meta OAuth failed",
    )
  }
}

async function exchangeCodeForToken(code: string, origin: string) {
  const config = getMetaOAuthConfig(origin)
  const url = new URL(`https://graph.facebook.com/${config.graphVersion}/oauth/access_token`)
  url.searchParams.set("client_id", config.clientId)
  url.searchParams.set("client_secret", config.clientSecret)
  url.searchParams.set("redirect_uri", config.redirectUri)
  url.searchParams.set("code", code)

  return fetchMetaToken(url)
}

async function exchangeLongLivedToken(
  shortLivedToken: string | undefined,
  origin: string,
) {
  if (!shortLivedToken) {
    throw new Error("Meta OAuth access token is missing")
  }

  const config = getMetaOAuthConfig(origin)
  const url = new URL(`https://graph.facebook.com/${config.graphVersion}/oauth/access_token`)
  url.searchParams.set("grant_type", "fb_exchange_token")
  url.searchParams.set("client_id", config.clientId)
  url.searchParams.set("client_secret", config.clientSecret)
  url.searchParams.set("fb_exchange_token", shortLivedToken)

  return fetchMetaToken(url)
}

async function fetchMetaToken(url: URL) {
  const response = await fetch(url)
  const payload = (await response.json().catch(() => ({}))) as MetaTokenResponse

  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error?.message ?? "Failed to exchange Meta OAuth token")
  }

  return {
    access_token: payload.access_token,
    expires_in: payload.expires_in,
  }
}

function redirectToAccounts(requestUrl: string, message: string) {
  const url = new URL("/dashboard/accounts", requestUrl)
  url.searchParams.set("error", message)
  return NextResponse.redirect(url)
}
