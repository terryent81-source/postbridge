import "server-only"

import { NextResponse } from "next/server"
import type { User } from "@supabase/supabase-js"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role"

export type AdminRole = "super_admin" | "admin"

export type AdminUser = {
  id: string
  user_id: string
  email: string
  role: AdminRole
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

type AdminAuthResult = {
  user: User | null
  adminUser: AdminUser | null
  error: NextResponse | null
}

export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createServerSupabaseClient()

  if (!supabase) {
    return null
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error) {
    return null
  }

  return user
}

export async function isAdminUser(userId: string): Promise<AdminUser | null> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("admin_users")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .in("role", ["super_admin", "admin"])
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data as AdminUser | null) ?? null
}

export async function requireAdmin(): Promise<AdminAuthResult> {
  const user = await getCurrentUser()

  if (!user) {
    return {
      user: null,
      adminUser: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  let adminUser: AdminUser | null

  try {
    adminUser = await isAdminUser(user.id)
  } catch {
    return {
      user,
      adminUser: null,
      error: NextResponse.json(
        { error: "Admin authorization is not configured" },
        { status: 500 },
      ),
    }
  }

  if (!adminUser) {
    return {
      user,
      adminUser: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    }
  }

  return { user, adminUser, error: null }
}

export async function requireSuperAdmin(): Promise<AdminAuthResult> {
  const result = await requireAdmin()

  if (result.error) {
    return result
  }

  if (result.adminUser?.role !== "super_admin") {
    return {
      user: result.user,
      adminUser: result.adminUser,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    }
  }

  return result
}

export async function requireAdminUser() {
  const result = await requireAdmin()

  return {
    error: result.error,
    userId: result.user?.id ?? null,
    adminUser: result.adminUser,
  }
}
