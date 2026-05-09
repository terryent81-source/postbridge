import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import {
  YouTubeAccountError,
  refreshYouTubeChannel,
  updateYouTubeShortsSettings,
} from "@/lib/server/youtube/accounts"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const auth = await getAuthenticatedUser()

  if (auth.error) {
    return auth.error
  }

  try {
    const account = await refreshYouTubeChannel(auth.userId)
    return NextResponse.json({ ok: true, account })
  } catch (error) {
    return jsonError(error, "YOUTUBE_CHANNEL_FAILED")
  }
}

export async function PATCH(request: Request) {
  const auth = await getAuthenticatedUser()

  if (auth.error) {
    return auth.error
  }

  try {
    const body = (await request.json()) as {
      autoHashtag?: boolean
      hashtagLocation?: "title" | "description"
    }
    const account = await updateYouTubeShortsSettings({
      userId: auth.userId,
      autoHashtag: Boolean(body.autoHashtag),
      hashtagLocation:
        body.hashtagLocation === "title" ? "title" : "description",
    })

    return NextResponse.json({ ok: true, account })
  } catch (error) {
    return jsonError(error, "YOUTUBE_SETTINGS_FAILED")
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
