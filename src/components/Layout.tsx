import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ApiUsageBadge from './ApiUsageBadge'

export default function Layout({ children }: { children: ReactNode }) {
  const { email, signOut } = useAuth()

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__left">
          <span className="brand">Lead Prospector</span>
          <nav className="nav">
            <NavLink to="/" end>
              Leads
            </NavLink>
            <NavLink to="/search">Run Search</NavLink>
          </nav>
        </div>
        <div className="topbar__right">
          <ApiUsageBadge />
          <span className="muted small">{email}</span>
          <button className="link-btn" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>
      <main className="content">{children}</main>
    </div>
  )
}
