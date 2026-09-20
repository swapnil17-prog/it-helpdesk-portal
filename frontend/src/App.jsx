import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import EmployeeHome from './pages/EmployeeHome'
import ITQueue from './pages/ITQueue'
import TicketDetail from './pages/TicketDetail'
import Dashboard from './pages/Dashboard'
import Admin from './pages/Admin'

function HomeRedirect() {
  const { user } = useAuth()
  if (user.role === 'employee') return <EmployeeHome />
  if (user.role === 'management') return <Navigate to="/dashboard" replace />
  return <Navigate to="/queue" replace />
}

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="p-10 text-center text-sm text-gray-500">Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

function RequireRole({ roles, children }) {
  const { user } = useAuth()
  if (!roles.includes(user.role)) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) return <div className="p-10 text-center text-sm text-gray-500">Loading...</div>

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<HomeRedirect />} />
        <Route
          path="/queue"
          element={
            <RequireRole roles={['agent', 'admin']}>
              <ITQueue />
            </RequireRole>
          }
        />
        <Route path="/tickets/:id" element={<TicketDetail />} />
        <Route
          path="/dashboard"
          element={
            <RequireRole roles={['agent', 'admin', 'management']}>
              <Dashboard />
            </RequireRole>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireRole roles={['admin']}>
              <Admin />
            </RequireRole>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
