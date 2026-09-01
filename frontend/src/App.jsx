import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import PublicLayout from './components/layout/PublicLayout'
import DashboardLayout from './components/layout/DashboardLayout'
import ProtectedRoute from './components/layout/ProtectedRoute'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import UploadPage from './pages/UploadPage'
import FilesPage from './pages/FilesPage'
import FileDetailsPage from './pages/FileDetailsPage'
import SharedLinksPage from './pages/SharedLinksPage'
import LogsPage from './pages/LogsPage'
import ProfilePage from './pages/ProfilePage'
import SharePage from './pages/SharePage'
import AdminPage from './pages/AdminPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/share/:token" element={<SharePage />} />
          </Route>

          <Route
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/files" element={<FilesPage />} />
            <Route path="/files/:id" element={<FileDetailsPage />} />
            <Route path="/shares" element={<SharedLinksPage />} />
            <Route path="/logs" element={<LogsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
