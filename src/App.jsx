/**
 * src/App.jsx
 *
 * App shell: context provider, router, chrome layout, route definitions.
 * Conforms to SPEC.md section 8 (Navigation) and section 11 (File Structure).
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import TopNav from './components/TopNav'
import Dashboard from './views/Dashboard'
import Comparison from './views/Comparison'
import ResortDetail from './views/ResortDetail'
import Settings from './views/Settings'

export default function App() {
  return (
    <AppProvider>
      <Router>
        <TopNav />
        {/* 60px top padding to clear the fixed nav */}
        <main className="pt-[60px] min-h-screen" style={{ backgroundColor: 'var(--color-bg-dark)' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/compare" element={<Comparison />} />
            <Route path="/resort/:id" element={<ResortDetail />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </Router>
    </AppProvider>
  )
}
