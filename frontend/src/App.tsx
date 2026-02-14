import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { DesktopDashboard } from './pages/DesktopDashboard'

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
