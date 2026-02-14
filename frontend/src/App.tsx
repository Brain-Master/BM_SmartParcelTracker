import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { DesktopDashboard } from './pages/DesktopDashboard'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Profile } from './pages/Profile'
import { OrderForm } from './pages/OrderForm'
import { ParcelForm } from './pages/ParcelForm'
import { SettingsPage } from './pages/SettingsPage'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AppLayout } from './components/AppLayout'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={
          <ProtectedRoute>
            <AppLayout>
              <DesktopDashboard />
            </AppLayout>
          </ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute>
            <AppLayout>
              <Profile />
            </AppLayout>
          </ProtectedRoute>
        } />
        <Route path="/orders/new" element={
          <ProtectedRoute>
            <AppLayout>
              <OrderForm />
            </AppLayout>
          </ProtectedRoute>
        } />
        <Route path="/orders/:id/edit" element={
          <ProtectedRoute>
            <AppLayout>
              <OrderForm />
            </AppLayout>
          </ProtectedRoute>
        } />
        <Route path="/parcels/new" element={
          <ProtectedRoute>
            <AppLayout>
              <ParcelForm />
            </AppLayout>
          </ProtectedRoute>
        } />
        <Route path="/parcels/:id/edit" element={
          <ProtectedRoute>
            <AppLayout>
              <ParcelForm />
            </AppLayout>
          </ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute>
            <AppLayout>
              <SettingsPage />
            </AppLayout>
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  )
}

export default App
