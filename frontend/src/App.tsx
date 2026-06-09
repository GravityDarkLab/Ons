import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './admin/context/AuthContext'
import { ProtectedRoute } from './admin/components/ProtectedRoute'
import { AdminLayout } from './admin/components/AdminLayout'
import { Login } from './admin/pages/Login'
import { Dashboard } from './admin/pages/Dashboard'
import { Applicants } from './admin/pages/Applicants'
import { ApplicantDetail } from './admin/pages/ApplicantDetail'
import { Matching } from './admin/pages/Matching'
import { Matches } from './admin/pages/Matches'
import { AuditLogs } from './admin/pages/AuditLogs'
import InviteGate from './components/InviteGate'
import Home from './pages/Home'
import Apply from './pages/Apply'
import Success from './pages/Success'
import ProfileLoginPage from './pages/profile/ProfileLoginPage'
import ProfileDashboard from './pages/profile/ProfileDashboard'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ── Admin (session auth, no invite gate) ─────────────────────
            AuthProvider is scoped here — getMe() is only called when
            the user navigates to /admin/*, not on public pages.        */}
        <Route
          path="/admin/*"
          element={
            <AuthProvider>
              <Routes>
                <Route path="login" element={<Login />} />
                <Route
                  path="*"
                  element={
                    <ProtectedRoute>
                      <AdminLayout>
                        <Routes>
                          <Route index element={<Dashboard />} />
                          <Route path="applicants" element={<Applicants />} />
                          <Route path="applicants/:id" element={<ApplicantDetail />} />
                          <Route path="matching" element={<Matching />} />
                          <Route path="matches" element={<Matches />} />
                          <Route path="audit-logs" element={<AuditLogs />} />
                        </Routes>
                      </AdminLayout>
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </AuthProvider>
          }
        />

        {/* ── Applicant portal (Bearer JWT auth) ─────────────────────── */}
        <Route path="/profile/login" element={<ProfileLoginPage />} />
        <Route path="/profile" element={<ProfileDashboard />} />

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
    </BrowserRouter>
  )
}
