import { NextResponse } from "next/server"
import { requireAdminUser } from "@/lib/supabase/admin-auth"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const admin = await requireAdminUser()

  if (admin.error) {
    return admin.error
  }

  let supabase
  try {
    supabase = createSupabaseServiceRoleClient()
  } catch {
    return NextResponse.json(
      { error: "Supabase service role is not configured" },
      { status: 500 },
    )
  }

  const { data, error } = await supabase
    .from("storage_cleanup_runs")
    .select("*")
    .order("ran_at", { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ rows: data ?? [] })
}
