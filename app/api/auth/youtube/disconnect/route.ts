import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import {
  YouTubeAccountError,
  disconnectYouTube,
} from "@/lib/server/youtube/accounts"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function DELETE() {
  const auth = await getAuthenticatedUser()

  if (auth.error) {
    return auth.error
  }

  try {
    const account = await disconnectYouTube(auth.userId)
    return NextResponse.json({ ok: true, account })
  } catch (error) {
    return jsonError(error, "YOUTUBE_DISCONNECT_FAILED")
  }
}

async function getAuthenticatedUser() {
  const supabase = await createServerSupabaseClient()

  if (!supabase) {
    return {
      userId: "",
      error: NextResponse.json(
        { ok: false, error: "SUPABASE_NOT_CONFIGURED" },
        { status: 500 },
      ),
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      userId: "",
      error: NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 }),
    }
  }

  return { userId: user.id, error: null }
}

function jsonError(error: unknown, fallback: string) {
  const message =
    error instanceof Error ? error.message : "YouTube request failed"
  return NextResponse.json(
    {
      ok: false,
      error: error instanceof YouTubeAccountError ? error.code : fallback,
      message,
    },
    { status: 500 },
  )
}
