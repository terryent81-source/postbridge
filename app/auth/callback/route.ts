import { NextResponse, type NextRequest } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const error = requestUrl.searchParams.get("error")
  const next = getSafeNextPath(requestUrl.searchParams.get("next"))

  if (error || !code) {
    return NextResponse.redirect(new URL("/login?error=oauth", requestUrl.origin))
  }

  const supabase = await createServerSupabaseClient()

  if (!supabase) {
    return NextResponse.redirect(new URL("/login?error=oauth", requestUrl.origin))
  }

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    return NextResponse.redirect(new URL("/login?error=oauth", requestUrl.origin))
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin))
}

function getSafeNextPath(nextPath: string | null) {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/dashboard"
  }

  return nextPath
}
