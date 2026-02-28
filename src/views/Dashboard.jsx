/**
 * src/views/Dashboard.jsx — stub (Agent 3 will build the full implementation)
 *
 * Displays the count of loaded resorts to verify context is working.
 * SPEC.md section 8.1 (full dashboard) built by Agent 3.
 */

import { useApp } from '../context/AppContext'

export default function Dashboard() {
  const { resorts } = useApp()

  return (
    <div className="p-6">
      <h1
        className="text-2xl font-semibold mb-2"
        style={{ color: 'var(--color-text-primary)' }}
      >
        Dashboard
      </h1>
      <p style={{ color: 'var(--color-text-secondary)' }}>
        {resorts.length} resorts loaded
      </p>
    </div>
  )
}
