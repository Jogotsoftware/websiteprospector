import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Leads from './pages/Leads'
import LeadDetail from './pages/LeadDetail'
import Search from './pages/Search'

export default function App() {
  const { session, allowed, loading } = useAuth()

  if (loading) {
    return <div className="centered muted">Loading…</div>
  }

  if (!session || !allowed) {
    return <Login />
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Leads />} />
        <Route path="/leads/:id" element={<LeadDetail />} />
        <Route path="/search" element={<Search />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
