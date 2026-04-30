export function getSupabasePublicConfig() {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  }
}

export function hasSupabasePublicConfig() {
  const { supabaseUrl, supabaseAnonKey } = getSupabasePublicConfig()

  return Boolean(supabaseUrl && supabaseAnonKey)
}

export function requireSupabasePublicConfig() {
  const { supabaseUrl, supabaseAnonKey } = getSupabasePublicConfig()

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL")
  }

  if (!supabaseAnonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY")
  }

  return { supabaseUrl, supabaseAnonKey }
}
