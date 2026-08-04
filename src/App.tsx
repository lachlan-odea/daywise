import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ConfirmProvider } from './components/ConfirmProvider'
import { ToastProvider } from './components/ToastProvider'
import ProtectedRoute from './components/ProtectedRoute'
import AppShell from './components/AppShell'
import LandingPage from './pages/LandingPage'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import Timetable from './pages/Timetable'
import Classes from './pages/Classes'
import ClassDetail from './pages/ClassDetail'
import SharedClass from './pages/SharedClass'
import Programs from './pages/Programs'
import ProgramDetail from './pages/ProgramDetail'
import Record from './pages/Record'
import History from './pages/History'
import EntryDetail from './pages/EntryDetail'
import Settings from './pages/Settings'
import Admin from './pages/Admin'
import Reports from './pages/Reports'
import Achievements from './pages/Achievements'
import Unsubscribe from './pages/Unsubscribe'

export default function App() {
  return (
    <AuthProvider>
      <ConfirmProvider>
      <ToastProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="timetable" element={<Timetable />} />
            <Route path="classes" element={<Classes />} />
            <Route path="classes/:id" element={<ClassDetail />} />
            <Route path="shared/:id" element={<SharedClass />} />
            <Route path="programs" element={<Programs />} />
            <Route path="programs/:id" element={<ProgramDetail />} />
            <Route path="record" element={<Record />} />
            <Route path="history" element={<History />} />
            <Route path="history/:id" element={<EntryDetail />} />
            <Route path="settings" element={<Settings />} />
            <Route path="reports" element={<Reports />} />
            <Route path="achievements" element={<Achievements />} />
            <Route path="unsubscribe" element={<Unsubscribe />} />
            <Route path="admin" element={<Admin />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </ToastProvider>
      </ConfirmProvider>
    </AuthProvider>
  )
}
