import { randomBytes } from "crypto"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { getYouTubeOAuthConfig } from "@/lib/server/youtube/config"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const YOUTUBE_OAUTH_STATE_COOKIE = "postbridge_youtube_oauth_state"

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
    config = getYouTubeOAuthConfig(new URL(request.url).origin)
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "YouTube OAuth is not configured",
      },
      { status: 500 },
    )
  }

  const state = randomBytes(32).toString("hex")
  const cookieStore = await cookies()
  cookieStore.set(YOUTUBE_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  })

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth")
  url.searchParams.set("client_id", config.clientId)
  url.searchParams.set("redirect_uri", config.redirectUri)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("scope", config.scopes.join(" "))
  url.searchParams.set("state", state)
  url.searchParams.set("access_type", "offline")
  url.searchParams.set("include_granted_scopes", "true")
  url.searchParams.set("prompt", "consent")

  return NextResponse.redirect(url)
}
