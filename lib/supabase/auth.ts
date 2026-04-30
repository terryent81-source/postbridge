"use client"

import type { Session, User } from "@supabase/supabase-js"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"

type SignUpInput = {
  email: string
  password: string
  displayName: string
  referralCode?: string
}

export async function signInWithEmailPassword(email: string, password: string) {
  const supabase = createBrowserSupabaseClient()

  return supabase.auth.signInWithPassword({
    email,
    password,
  })
}

export async function signUpWithEmailPassword({
  email,
  password,
  displayName,
  referralCode,
}: SignUpInput) {
  const supabase = createBrowserSupabaseClient()

  return supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
        referral_code: referralCode || null,
      },
    },
  })
}

export async function getCurrentSession(): Promise<Session | null> {
  const supabase = createBrowserSupabaseClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  return session
}

export async function getCurrentUser(): Promise<User | null> {
  const supabase = createBrowserSupabaseClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error) {
    return null
  }

  return user
}

export async function signOutCurrentUser() {
  const supabase = createBrowserSupabaseClient()

  return supabase.auth.signOut()
}
