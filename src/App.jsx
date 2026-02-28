/**
 * src/App.jsx
 *
 * App shell: context provider, router, chrome layout, route definitions.
 * Conforms to SPEC.md section 8 (Navigation) and section 11 (File Structure).
 */

import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider, useApp, useUpdateAlertLog } from './context/AppContext'
import { checkPowderAlerts } from './lib/alerts'
import TopNav from './components/TopNav'
import Dashboard from './views/Dashboard'
import Comparison from './views/Comparison'
import ResortDetail from './views/ResortDetail'
import Settings from './views/Settings'

/**
 * AlertWatcher — must live inside AppProvider so it can access context.
 * Attaches a window 'focus' listener that re-checks powder alerts whenever
 * the user switches back to the tab (SPEC.md section 6 / Agent 6 Deliverable 3).
 */
function AlertWatcher() {
  const { resorts, forecasts, settings, alertLog } = useApp()
  const updateAlertLog = useUpdateAlertLog()

  useEffect(() => {
    const handleFocus = () => {
      if (Object.keys(forecasts).length === 0) return // nothing loaded yet

      const updatedLog = checkPowderAlerts({
        resorts: resorts.filter((r) => r.tier === 1),
        forecasts,
        thresholds: settings.thresholds,
        defaultThreshold: settings.defaultThreshold,
        alertLog,
      })
      Object.entries(updatedLog).forEach(([id, ts]) => updateAlertLog(id, ts))
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [forecasts, settings, alertLog]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}

export default function App() {
  return (
    <AppProvider>
      <Router>
        <AlertWatcher />
        <TopNav />
        {/* 60px top padding to clear the fixed nav */}
        <main className="pt-[60px] min-h-screen" style={{ backgroundColor: 'var(--color-bg-dark)' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/compare" element={<Comparison />} />
            <Route path="/resort/:slug" element={<ResortDetail />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </Router>
    </AppProvider>
  )
}
