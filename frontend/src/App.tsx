import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './admin/context/AuthContext'
import { ProtectedRoute } from './admin/components/ProtectedRoute'
import { AdminLayout } from './admin/components/AdminLayout'
import { Login } from './admin/pages/Login'
import { Dashboard } from './admin/pages/Dashboard'
import { Applicants } from './admin/pages/Applicants'
import { ApplicantDetail } from './admin/pages/ApplicantDetail'
import { Matching } from './admin/pages/Matching'
import { AuditLogs } from './admin/pages/AuditLogs'
import InviteGate from './components/InviteGate'
import Home from './pages/Home'
import Apply from './pages/Apply'
import Success from './pages/Success'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* ── Admin (JWT auth, no invite gate) ─────────────────────── */}
          <Route path="/admin/login" element={<Login />} />
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <Routes>
                    <Route index element={<Dashboard />} />
                    <Route path="applicants" element={<Applicants />} />
                    <Route path="applicants/:id" element={<ApplicantDetail />} />
                    <Route path="matching" element={<Matching />} />
                    <Route path="audit-logs" element={<AuditLogs />} />
                  </Routes>
                </AdminLayout>
              </ProtectedRoute>
            }
          />

          {/* ── Public form (invite gate) ─────────────────────────────── */}
          <Route
            path="/*"
            element={
              <InviteGate>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/apply" element={<Apply />} />
                  <Route path="/success" element={<Success />} />
                </Routes>
              </InviteGate>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
