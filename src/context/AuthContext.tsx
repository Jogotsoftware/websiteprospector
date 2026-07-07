import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthState {
  session: Session | null
  email: string | null
  loading: boolean
  /** True once we've confirmed the signed-in email is on the allowlist. */
  allowed: boolean
  signInWithPassword: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [allowed, setAllowed] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // Defense-in-depth client guard: confirm the session's email is allowlisted.
  // (The auth-layer trigger already blocks non-allowlisted signups; this is a
  // belt-and-suspenders check that signs out anything unexpected.)
  useEffect(() => {
    let cancelled = false
    async function verify() {
      if (!session?.user?.email) {
        setAllowed(false)
        return
      }
      const { data, error } = await supabase
        .from('allowed_emails')
        .select('email')
        .ilike('email', session.user.email)
        .maybeSingle()
      if (cancelled) return
      if (error || !data) {
        setAllowed(false)
        await supabase.auth.signOut()
      } else {
        setAllowed(true)
      }
    }
    verify()
    return () => {
      cancelled = true
    }
  }, [session])

  const value: AuthState = {
    session,
    email: session?.user?.email ?? null,
    loading,
    allowed,
    async signInWithPassword(email: string, password: string) {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      return { error: error?.message ?? null }
    },
    async signOut() {
      await supabase.auth.signOut()
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
