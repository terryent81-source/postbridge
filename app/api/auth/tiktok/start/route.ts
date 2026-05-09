import { randomBytes } from "crypto"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { getTikTokOAuthConfig } from "@/lib/server/tiktok/config"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const TIKTOK_OAUTH_STATE_COOKIE = "postbridge_tiktok_oauth_state"

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient()

  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 })
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  let config

  try {
    config = getTikTokOAuthConfig(new URL(request.url).origin)
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "TikTok OAuth is not configured",
      },
      { status: 500 },
    )
  }

  const state = randomBytes(32).toString("hex")
  const cookieStore = await cookies()
  cookieStore.set(TIKTOK_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  })

  const url = new URL("https://www.tiktok.com/v2/auth/authorize/")
  url.searchParams.set("client_key", config.clientKey)
  url.searchParams.set("redirect_uri", config.redirectUri)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("scope", config.scopes.join(","))
  url.searchParams.set("state", state)

  return NextResponse.redirect(url)
}
