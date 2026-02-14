import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { DesktopDashboard } from './pages/DesktopDashboard'
import './index.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DesktopDashboard />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
