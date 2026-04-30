import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { getSupabasePublicConfig } from "@/lib/supabase/config"

export async function createServerSupabaseClient() {
  const { supabaseUrl, supabaseAnonKey } = getSupabasePublicConfig()

  if (!supabaseUrl || !supabaseAnonKey) {
    return null
  }

  const cookieStore = await cookies()

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Server Components cannot always write cookies. Middleware keeps
          // auth cookies refreshed for protected routes.
        }
      },
    },
  })
}

export async function getCurrentUser() {
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
