import { randomBytes } from "crypto"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { getMetaOAuthConfig } from "@/lib/server/meta/config"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const META_OAUTH_STATE_COOKIE = "postbridge_meta_oauth_state"

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
    config = getMetaOAuthConfig(new URL(request.url).origin)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Meta OAuth is not configured" },
      { status: 500 },
    )
  }

  if (!config.configId) {
    return NextResponse.json({ error: "Missing META_CONFIG_ID" }, { status: 500 })
  }

  const state = randomBytes(32).toString("hex")
  const cookieStore = await cookies()
  cookieStore.set(META_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  })

  const url = new URL(`https://www.facebook.com/${config.graphVersion}/dialog/oauth`)
  url.searchParams.set("client_id", config.clientId)
  url.searchParams.set("redirect_uri", config.redirectUri)
  url.searchParams.set("state", state)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("override_default_response_type", "true")
  url.searchParams.set("config_id", config.configId)

  return NextResponse.redirect(url)
}
