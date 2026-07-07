import { createClient, SupabaseClient } from '@supabase/supabase-js'

let cached: SupabaseClient | null = null

/**
 * Service-role Supabase client for server-side function use only.
 * Bypasses RLS — never expose this key or client to the browser.
 */
export function getAdminClient(): SupabaseClient {
  if (cached) return cached
  // Accept the plain SUPABASE_URL or the VITE_-prefixed one the Supabase
  // Netlify extension provisions (functions can read either at runtime).
  // NOTE: SUPABASE_DATABASE_URL is a Postgres connection string, not the API
  // URL, so it is deliberately not used here.
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'Missing SUPABASE_URL (or VITE_SUPABASE_URL) / SUPABASE_SERVICE_ROLE_KEY env vars',
    )
  }
  cached = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return cached
}
