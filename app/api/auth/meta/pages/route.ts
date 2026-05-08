import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import {
  fetchMetaPages,
  getStoredMetaTokenExpiresAt,
  getStoredMetaUserToken,
  saveSelectedMetaPage,
  stripMetaPageToken,
} from "@/lib/server/meta/accounts"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const auth = await getAuthenticatedUser()

  if (auth.error) {
    return auth.error
  }

  try {
    const token = await getStoredMetaUserToken(auth.userId)

    if (!token) {
      return NextResponse.json(
        { error: "Meta account is not connected", pages: [] },
        { status: 409 },
      )
    }

    const pages = await fetchMetaPages(token)

    return NextResponse.json({
      pages: pages.map(stripMetaPageToken),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load Facebook Pages",
      },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  const auth = await getAuthenticatedUser()

  if (auth.error) {
    return auth.error
  }

  let pageId: string | undefined

  try {
    const body = (await request.json()) as { pageId?: string }
    pageId = body.pageId
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (!pageId) {
    return NextResponse.json({ error: "pageId is required" }, { status: 400 })
  }

  try {
    const token = await getStoredMetaUserToken(auth.userId)

    if (!token) {
      return NextResponse.json(
        { error: "Meta account is not connected" },
        { status: 409 },
      )
    }

    const pages = await fetchMetaPages(token)
    const selectedPage = pages.find((page) => page.id === pageId)

    if (!selectedPage) {
      return NextResponse.json(
        { error: "Selected Facebook Page was not found" },
        { status: 404 },
      )
    }

    const tokenExpiresAt = await getStoredMetaTokenExpiresAt(auth.userId)
    const accounts = await saveSelectedMetaPage({
      userId: auth.userId,
      page: selectedPage,
      tokenExpiresAt,
    })

    return NextResponse.json({ accounts })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to save Facebook Page",
      },
      { status: 500 },
    )
  }
}

async function getAuthenticatedUser() {
  const supabase = await createServerSupabaseClient()

  if (!supabase) {
    return {
      userId: "",
      error: NextResponse.json(
        { error: "Supabase is not configured" },
        { status: 500 },
      ),
    }
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      userId: "",
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  return { userId: user.id, error: null }
}
