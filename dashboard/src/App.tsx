import './App.css'
import { Navigate, Route, Routes } from 'react-router-dom'

import { getToken } from './auth/token'
import { DashboardPage } from './routes/DashboardPage'
import { LoginPage } from './routes/LoginPage'
import { ResultDetailPage } from './routes/ResultDetailPage'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<DashboardPage />} />
      <Route path="/results/:resultId" element={<ResultDetailPage />} />
      <Route
        path="*"
        element={<Navigate to={getToken() ? '/' : '/login'} replace />}
      />
    </Routes>
  )
}

export default App
