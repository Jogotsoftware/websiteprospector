import { getAdminClient } from './supabaseAdmin.js'

export interface AuthedUser {
  id: string
  email: string
}

/**
 * Verify the caller's Supabase access token AND that their email is on the
 * allowlist. Returns the user on success, or null if unauthenticated /
 * unauthorized. This is the server-side gate for the search pipeline —
 * defense in depth alongside RLS and the signup trigger.
 */
export async function requireAllowedUser(
  authHeader: string | undefined,
): Promise<AuthedUser | null> {
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null

  const admin = getAdminClient()
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data?.user?.email) return null

  const email = data.user.email
  const { data: allowed } = await admin
    .from('allowed_emails')
    .select('email')
    .ilike('email', email)
    .maybeSingle()

  if (!allowed) return null
  return { id: data.user.id, email }
}
