import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { requireSupabasePublicConfig } from "@/lib/supabase/config"

let browserClient: SupabaseClient | null = null

export function createBrowserSupabaseClient() {
  const { supabaseUrl, supabaseAnonKey } = requireSupabasePublicConfig()

  browserClient ??= createBrowserClient(supabaseUrl, supabaseAnonKey)

  return browserClient
}
