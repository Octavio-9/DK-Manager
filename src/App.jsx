import { Routes, Route, Navigate, Link } from 'react-router-dom'
import { Loader2, ShieldAlert } from 'lucide-react'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import Clients from './pages/Clients'
import ClientDetail from './pages/ClientDetail'
import Finance from './pages/Finance'
import Invoices from './pages/Invoices'
import Documents from './pages/Documents'
import Productions from './pages/Productions'
import EditorialCalendar from './pages/EditorialCalendar'
import PublicValidation from './pages/PublicValidation'
import CalendarPage from './pages/Calendar'
import Tasks from './pages/Tasks'
import Team from './pages/Team'
import Users from './pages/Users'
import Settings from './pages/Settings'
import AiContent from './pages/AiContent'
import History from './pages/History'
import Bilan from './pages/Bilan'
import { btnPrimary } from './lib/ui'

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-dark">
      <div className="flex flex-col items-center gap-3">
        <img src="/dk-mark-white.png" alt="DK Production" className="h-12 w-auto" />
        <Loader2 size={24} className="animate-spin text-accent-purple" />
      </div>
    </div>
  )
}

function AccessDenied() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg-dark px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-c-danger/10">
        <ShieldAlert size={32} className="text-c-danger" />
      </div>
      <h1 className="text-xl font-semibold text-text-primary">Accès refusé</h1>
      <p className="max-w-sm text-sm text-text-secondary">
        Votre rôle ne vous permet pas d'accéder à cette application.
      </p>
      <Link to="/login" className={btnPrimary}>
        Retour à la connexion
      </Link>
    </div>
  )
}

function ProtectedRoute({ children, routeKey }) {
  const { user, loading, hasAccess } = useAuth()

  if (loading) return <FullScreenLoader />
  if (!user) return <Navigate to="/login" replace />

  if (routeKey) {
    if (!hasAccess(routeKey)) {
      if (routeKey === 'dashboard') return <AccessDenied />
      return <Navigate to="/dashboard" replace />
    }
  } else if (!hasAccess('dashboard')) {
    return <AccessDenied />
  }

  return children
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) return <FullScreenLoader />
  if (user) return <Navigate to="/dashboard" replace />

  return children
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/signup"
        element={
          <PublicRoute>
            <Signup />
          </PublicRoute>
        }
      />

      <Route path="/validate/:token" element={<PublicValidation />} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute routeKey="dashboard">
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects"
          element={
            <ProtectedRoute routeKey="projects">
              <Projects />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/:id"
          element={
            <ProtectedRoute routeKey="projects">
              <ProjectDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/clients"
          element={
            <ProtectedRoute routeKey="clients">
              <Clients />
            </ProtectedRoute>
          }
        />
        <Route
          path="/clients/:id"
          element={
            <ProtectedRoute routeKey="clients">
              <ClientDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/calendar"
          element={
            <ProtectedRoute routeKey="calendar">
              <CalendarPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tasks"
          element={
            <ProtectedRoute routeKey="tasks">
              <Tasks />
            </ProtectedRoute>
          }
        />
        <Route
          path="/team"
          element={
            <ProtectedRoute routeKey="team">
              <Team />
            </ProtectedRoute>
          }
        />
        <Route
          path="/finance"
          element={
            <ProtectedRoute routeKey="finance">
              <Finance />
            </ProtectedRoute>
          }
        />
        <Route
          path="/invoices"
          element={
            <ProtectedRoute routeKey="invoices">
              <Invoices />
            </ProtectedRoute>
          }
        />
        <Route
          path="/documents"
          element={
            <ProtectedRoute routeKey="documents">
              <Documents />
            </ProtectedRoute>
          }
        />
        <Route
          path="/productions"
          element={
            <ProtectedRoute routeKey="productions">
              <Productions />
            </ProtectedRoute>
          }
        />
        <Route
          path="/editorial"
          element={
            <ProtectedRoute routeKey="editorial">
              <EditorialCalendar />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai"
          element={
            <ProtectedRoute routeKey="ai">
              <AiContent />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute routeKey="users">
              <Users />
            </ProtectedRoute>
          }
        />
        <Route
          path="/history"
          element={
            <ProtectedRoute routeKey="history">
              <History />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bilan"
          element={
            <ProtectedRoute routeKey="bilan">
              <Bilan />
            </ProtectedRoute>
          }
        />
        <Route path="/settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
