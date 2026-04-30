"use client"

import type { User } from "@supabase/supabase-js"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"

export type ProfileRow = {
  id: string
  user_id: string
  display_name: string
  avatar_url: string | null
  locale: string
  plan_id: string
  referred_by_user_id: string | null
  is_admin: boolean
  created_at: string
  updated_at: string
}

export type CurrentUserProfile = {
  user: User
  profile: ProfileRow | null
  email: string
  displayName: string
  avatarUrl: string | null
  locale: string
}

type UpdateProfileInput = {
  displayName: string
  avatarUrl?: string | null
  locale: string
}

export const SUPABASE_PROFILE_CHANGED_EVENT = "postbridge:supabase-profile-changed"

export async function getCurrentUserWithProfile(): Promise<CurrentUserProfile | null> {
  const supabase = createBrowserSupabaseClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return null
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle<ProfileRow>()

  return mapCurrentUserProfile(user, profile ?? null)
}

export async function updateMyProfile({
  displayName,
  avatarUrl,
  locale,
}: UpdateProfileInput) {
  const supabase = createBrowserSupabaseClient()

  const { data, error } = await supabase.rpc("update_my_profile", {
    display_name: displayName,
    avatar_url: avatarUrl ?? null,
    locale,
  })

  if (error) {
    return { data: null, error }
  }

  return { data: data as ProfileRow, error: null }
}

export function mapCurrentUserProfile(
  user: User,
  profile: ProfileRow | null,
): CurrentUserProfile {
  const email = user.email ?? ""
  const displayName =
    profile?.display_name?.trim() ||
    String(user.user_metadata?.display_name ?? "").trim() ||
    getEmailName(email)

  return {
    user,
    profile,
    email,
    displayName,
    avatarUrl: profile?.avatar_url ?? null,
    locale: profile?.locale ?? "ko-KR",
  }
}

export function getProfileInitials(displayName: string, email: string) {
  const source = displayName || getEmailName(email)
  const compact = source.replace(/\s/g, "")

  if (!compact) {
    return "PB"
  }

  if (/^[a-z0-9]/i.test(compact)) {
    return compact.slice(0, 2).toUpperCase()
  }

  return compact.slice(0, 2)
}

export function notifySupabaseProfileChanged() {
  window.dispatchEvent(new Event(SUPABASE_PROFILE_CHANGED_EVENT))
}

function getEmailName(email: string) {
  return email.split("@")[0] || "PostBridge 사용자"
}
