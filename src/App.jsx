import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import PlaceholderPage from './pages/PlaceholderPage'

function RequireAuth({ user, children }) {
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const { user, loading } = useAuth()

  if (loading) return null

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={<RequireAuth user={user}><HomePage /></RequireAuth>} />
      <Route path="/stats" element={<RequireAuth user={user}><PlaceholderPage title="Stats" /></RequireAuth>} />
      <Route path="/analyze" element={<RequireAuth user={user}><PlaceholderPage title="Analyze" /></RequireAuth>} />
      <Route path="/matt-cap" element={<RequireAuth user={user}><PlaceholderPage title="Matt Cap" /></RequireAuth>} />
    </Routes>
  )
}
