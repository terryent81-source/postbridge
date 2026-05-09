import { NextResponse } from "next/server"
import {
  TikTokAccountError,
  disconnectTikTok,
} from "@/lib/server/tiktok/accounts"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function DELETE() {
  const auth = await getAuthenticatedUser()

  if (auth.error) {
    return auth.error
  }

  try {
    const account = await disconnectTikTok(auth.userId)
    return NextResponse.json({ ok: true, account })
  } catch (error) {
    return jsonError(error, "TIKTOK_DISCONNECT_FAILED")
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
  return NextResponse.json(
    {
      ok: false,
      error: error instanceof TikTokAccountError ? error.code : fallback,
      message: error instanceof Error ? error.message : "TikTok request failed",
    },
    { status: 500 },
  )
}
