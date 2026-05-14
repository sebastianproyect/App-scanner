import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ReactNode, lazy, Suspense } from 'react'

const Dashboard    = lazy(() => import('./pages/Dashboard'))
const Scanner      = lazy(() => import('./pages/Scanner'))
const History      = lazy(() => import('./pages/History'))
const ReviewReceipt = lazy(() => import('./pages/ReviewReceipt'))
const Login        = lazy(() => import('./pages/Login'))
const Users        = lazy(() => import('./pages/Users'))
const NotFound     = lazy(() => import('./pages/NotFound'))

function PageLoader() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <img src="/icons/icon.png" alt="IDT" className="w-12 h-12 rounded-2xl object-contain animate-pulse" />
        <p className="text-on-surface-variant text-sm font-medium">Cargando...</p>
      </div>
    </div>
  )
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <img src="/icons/icon.png" alt="IDT" className="w-12 h-12 rounded-2xl object-contain animate-pulse" />
          <p className="text-on-surface-variant text-sm font-medium">Cargando...</p>
        </div>
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AdminRoute({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuth()
  if (loading) return null
  if (profile?.role !== 'admin') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function AppRoutes() {
  const { session } = useAuth()
  const location = useLocation()

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes location={location}>
        <Route path="/login" element={session ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/scanner" element={<ProtectedRoute><Scanner /></ProtectedRoute>} />
        <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
        <Route path="/review" element={<ProtectedRoute><ReviewReceipt /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute><AdminRoute><Users /></AdminRoute></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
