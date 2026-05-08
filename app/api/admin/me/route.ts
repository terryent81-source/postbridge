import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const admin = await requireAdmin()

  if (admin.error) {
    return admin.error
  }

  return NextResponse.json({
    userId: admin.user?.id,
    email: admin.user?.email ?? admin.adminUser?.email ?? null,
    role: admin.adminUser?.role,
  })
}
