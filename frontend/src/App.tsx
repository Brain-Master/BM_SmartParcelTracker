import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { DesktopDashboard } from './pages/DesktopDashboard'
import { Login } from './pages/Login'
import { Register } from './pages/Register'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<DesktopDashboard />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
