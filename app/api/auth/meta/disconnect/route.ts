import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { disconnectMetaPlatform } from "@/lib/server/meta/accounts"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type DisconnectPlatform = "facebook" | "instagram"

export async function DELETE(request: Request) {
  const supabase = await createServerSupabaseClient()

  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 500 },
    )
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let platform: DisconnectPlatform | undefined

  try {
    const body = (await request.json()) as { platform?: DisconnectPlatform }
    platform = body.platform
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (platform !== "facebook" && platform !== "instagram") {
    return NextResponse.json(
      { error: "platform must be facebook or instagram" },
      { status: 400 },
    )
  }

  try {
    const account = await disconnectMetaPlatform(user.id, platform)
    return NextResponse.json({ account })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to disconnect social account",
      },
      { status: 500 },
    )
  }
}
