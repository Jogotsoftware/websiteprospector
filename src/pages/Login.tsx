import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { signInWithMagicLink, session, allowed } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Signed in but not allowlisted → clear rejection message.
  const rejected = session && !allowed

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await signInWithMagicLink(email.trim())
    setBusy(false)
    if (error) setError(error)
    else setSent(true)
  }

  return (
    <div className="centered">
      <div className="card login-card">
        <h1>Lead Prospector</h1>
        <p className="muted">Internal tool — authorized users only.</p>

        {rejected && (
          <p className="error">
            This account isn’t authorized for this tool.
          </p>
        )}

        {sent ? (
          <p>
            Check <strong>{email}</strong> for a sign-in link.
          </p>
        ) : (
          <form onSubmit={submit}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            {error && <p className="error">{error}</p>}
            <button type="submit" disabled={busy || !email}>
              {busy ? 'Sending…' : 'Send magic link'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
