import { NextResponse } from "next/server"
import type { User } from "@supabase/supabase-js"
import {
  type AdminRole,
  type AdminUser,
  requireSuperAdmin,
} from "@/lib/supabase/admin-auth"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const USER_NOT_FOUND_MESSAGE =
  "먼저 Google 로그인 후 다시 관리자 등록해 주세요"

type AdminUserInput = {
  email?: string
  role?: AdminRole
}

type AdminUserUpdateInput = {
  id?: string
  role?: AdminRole
  is_active?: boolean
}

export async function GET() {
  const admin = await requireSuperAdmin()

  if (admin.error) {
    return admin.error
  }

  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("admin_users")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    rows: (data ?? []) as AdminUser[],
    currentUserId: admin.user?.id,
  })
}

export async function POST(request: Request) {
  const admin = await requireSuperAdmin()

  if (admin.error) {
    return admin.error
  }

  const input = (await request.json().catch(() => ({}))) as AdminUserInput
  const role = input.role ?? "admin"
  const email = input.email?.trim().toLowerCase()

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 })
  }

  if (!isAdminRole(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 })
  }

  const supabase = createSupabaseServiceRoleClient()
  let targetUser: User | null

  try {
    targetUser = await findAuthUserByEmail(email)
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to find authenticated user",
      },
      { status: 500 },
    )
  }

  if (!targetUser) {
    return NextResponse.json({ error: USER_NOT_FOUND_MESSAGE }, { status: 404 })
  }

  const { data: existingAdmin, error: existingError } = await supabase
    .from("admin_users")
    .select("*")
    .eq("user_id", targetUser.id)
    .maybeSingle()

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 })
  }

  const oldRole = (existingAdmin as AdminUser | null)?.role ?? null
  const { data, error } = existingAdmin
    ? await supabase
        .from("admin_users")
        .update({
          email,
          role,
          is_active: true,
        })
        .eq("id", (existingAdmin as AdminUser).id)
        .select("*")
        .single()
    : await supabase
        .from("admin_users")
        .insert({
          user_id: targetUser.id,
          email,
          role,
          is_active: true,
          created_by: admin.user?.id ?? null,
        })
        .select("*")
        .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await recordAdminAuditLog({
    actorUserId: admin.user?.id ?? null,
    targetUserId: targetUser.id,
    action: existingAdmin ? "admin_user_updated" : "admin_user_added",
    oldRole,
    newRole: role,
  })

  return NextResponse.json({ row: data as AdminUser })
}

export async function PATCH(request: Request) {
  const admin = await requireSuperAdmin()

  if (admin.error) {
    return admin.error
  }

  const input = (await request.json().catch(() => ({}))) as AdminUserUpdateInput

  if (!input.id) {
    return NextResponse.json({ error: "Admin user id is required" }, { status: 400 })
  }

  if (input.role !== undefined && !isAdminRole(input.role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 })
  }

  const supabase = createSupabaseServiceRoleClient()
  const { data: target, error: targetError } = await supabase
    .from("admin_users")
    .select("*")
    .eq("id", input.id)
    .maybeSingle()

  if (targetError) {
    return NextResponse.json({ error: targetError.message }, { status: 500 })
  }

  if (!target) {
    return NextResponse.json({ error: "Admin user not found" }, { status: 404 })
  }

  const targetAdmin = target as AdminUser
  const removingOwnSuperAdmin =
    targetAdmin.user_id === admin.user?.id &&
    targetAdmin.role === "super_admin" &&
    ((input.role !== undefined && input.role !== "super_admin") ||
      input.is_active === false)

  if (removingOwnSuperAdmin) {
    return NextResponse.json(
      { error: "자기 자신의 super_admin 권한은 제거할 수 없습니다" },
      { status: 400 },
    )
  }

  const patch: Partial<Pick<AdminUser, "role" | "is_active">> = {}

  if (input.role !== undefined) {
    patch.role = input.role
  }

  if (input.is_active !== undefined) {
    patch.is_active = input.is_active
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ row: targetAdmin })
  }

  const { data, error } = await supabase
    .from("admin_users")
    .update(patch)
    .eq("id", targetAdmin.id)
    .select("*")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await recordAdminAuditLog({
    actorUserId: admin.user?.id ?? null,
    targetUserId: targetAdmin.user_id,
    action: getAuditAction(targetAdmin, patch),
    oldRole: targetAdmin.role,
    newRole: patch.role ?? targetAdmin.role,
  })

  return NextResponse.json({ row: data as AdminUser })
}

function isAdminRole(value: unknown): value is AdminRole {
  return value === "super_admin" || value === "admin"
}

async function findAuthUserByEmail(email: string) {
  const supabase = createSupabaseServiceRoleClient()
  const normalizedEmail = email.toLowerCase()
  let page = 1

  while (page <= 20) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    })

    if (error) {
      throw error
    }

    const users = data.users as User[]
    const matchedUser = users.find(
      (user) => user.email?.toLowerCase() === normalizedEmail,
    )

    if (matchedUser || users.length < 1000) {
      return matchedUser ?? null
    }

    page += 1
  }

  return null
}

async function recordAdminAuditLog({
  actorUserId,
  targetUserId,
  action,
  oldRole,
  newRole,
}: {
  actorUserId: string | null
  targetUserId: string | null
  action: string
  oldRole: AdminRole | null
  newRole: AdminRole | null
}) {
  const supabase = createSupabaseServiceRoleClient()
  const { error } = await supabase.from("admin_audit_logs").insert({
    actor_user_id: actorUserId,
    target_user_id: targetUserId,
    action,
    old_role: oldRole,
    new_role: newRole,
  })

  if (error) {
    console.error("[admin-users] Failed to record audit log", error)
  }
}

function getAuditAction(
  target: AdminUser,
  patch: Partial<Pick<AdminUser, "role" | "is_active">>,
) {
  if (patch.is_active === false && target.is_active) {
    return "admin_user_deactivated"
  }

  if (patch.is_active === true && !target.is_active) {
    return "admin_user_reactivated"
  }

  if (patch.role && patch.role !== target.role) {
    return "admin_role_updated"
  }

  return "admin_user_updated"
}
