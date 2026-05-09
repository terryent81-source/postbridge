import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import {
  MetaGraphRequestError,
  type MetaErrorDetails,
  fetchMetaPages,
  getStoredMetaTokenExpiresAt,
  getStoredMetaUserToken,
  sanitizeSensitiveText,
  saveSelectedMetaPage,
  stripMetaPageToken,
} from "@/lib/server/meta/accounts"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type JsonErrorDetails = MetaErrorDetails | { step: string; message: string }

export async function GET() {
  const auth = await getAuthenticatedUser()

  if (auth.error) {
    return auth.error
  }

  try {
    const token = await getStoredMetaUserToken(auth.userId)

    if (!token) {
      return jsonError({
        status: 409,
        error: "META_TOKEN_NOT_FOUND",
        message: "Meta 연결 토큰을 찾을 수 없습니다.",
        details: {
          step: "supabase_token_lookup",
          message: "Meta 계정을 다시 연결한 뒤 Page 목록을 새로고침해 주세요.",
        },
      })
    }

    const pages = await fetchMetaPages(token)

    return NextResponse.json({
      ok: true,
      pages: pages.map(stripMetaPageToken),
    })
  } catch (error) {
    return jsonError({
      status: 502,
      error: "META_PAGE_LIST_FAILED",
      message: "Facebook Page 목록 조회에 실패했습니다.",
      details: getSafeErrorDetails(error, "page_list_unknown"),
    })
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
    return jsonError({
      status: 400,
      error: "INVALID_REQUEST_BODY",
      message: "요청 본문이 올바르지 않습니다.",
      details: {
        step: "request_json_parse",
        message: "pageId를 JSON 본문으로 보내 주세요.",
      },
    })
  }

  if (!pageId) {
    return jsonError({
      status: 400,
      error: "PAGE_ID_REQUIRED",
      message: "Facebook Page를 선택해 주세요.",
      details: {
        step: "request_validation",
        message: "pageId is required.",
      },
    })
  }

  try {
    const token = await getStoredMetaUserToken(auth.userId)

    if (!token) {
      return jsonError({
        status: 409,
        error: "META_TOKEN_NOT_FOUND",
        message: "Meta 연결 토큰을 찾을 수 없습니다.",
        details: {
          step: "supabase_token_lookup",
          message: "Meta 계정을 다시 연결한 뒤 Page를 저장해 주세요.",
        },
      })
    }

    const pages = await fetchMetaPages(token)
    const selectedPage = pages.find((page) => page.id === pageId)

    if (!selectedPage) {
      return jsonError({
        status: 404,
        error: "META_PAGE_NOT_FOUND",
        message: "선택한 Facebook Page를 찾을 수 없습니다.",
        details: {
          step: "page_selection",
          message: "Page 목록을 새로고침한 뒤 다시 선택해 주세요.",
        },
      })
    }

    const tokenExpiresAt = await getStoredMetaTokenExpiresAt(auth.userId)
    const accounts = await saveSelectedMetaPage({
      userId: auth.userId,
      page: selectedPage,
      tokenExpiresAt,
    })

    return NextResponse.json({ ok: true, accounts })
  } catch (error) {
    return jsonError({
      status: 502,
      error: "META_PAGE_SAVE_FAILED",
      message: "Facebook Page 저장에 실패했습니다.",
      details: getSafeErrorDetails(error, "page_save_unknown"),
    })
  }
}

async function getAuthenticatedUser() {
  const supabase = await createServerSupabaseClient()

  if (!supabase) {
    return {
      userId: "",
      error: jsonError({
        status: 500,
        error: "SUPABASE_NOT_CONFIGURED",
        message: "Supabase 설정을 찾을 수 없습니다.",
        details: {
          step: "supabase_config",
          message: "Server Supabase configuration is missing.",
        },
      }),
    }
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      userId: "",
      error: jsonError({
        status: 401,
        error: "UNAUTHORIZED",
        message: "로그인이 필요합니다.",
        details: {
          step: "supabase_auth",
          message: sanitizeSensitiveText(error?.message ?? "User session is missing or expired."),
        },
      }),
    }
  }

  return { userId: user.id, error: null }
}

function jsonError({
  status,
  error,
  message,
  details,
}: {
  status: number
  error: string
  message: string
  details?: JsonErrorDetails
}) {
  return NextResponse.json(
    {
      ok: false,
      error,
      message,
      details: details ?? null,
    },
    { status },
  )
}

function getSafeErrorDetails(error: unknown, fallbackStep: string): JsonErrorDetails {
  if (error instanceof MetaGraphRequestError) {
    return error.details
  }

  return {
    step: fallbackStep,
    message: sanitizeSensitiveText(
      error instanceof Error ? error.message : "Unexpected Page request error",
    ),
  }
}
