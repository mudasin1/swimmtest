/**
 * src/views/Settings.jsx — stub with working unit preference toggle
 *
 * The units toggle (Imperial / Metric) is wired up and persisted via
 * useUpdateSettings() to validate that context persistence is working.
 * Full settings view (thresholds, alerts, dark mode toggle) built by Agent 6.
 * SPEC.md section 8.4.
 */

import { useApp, useUpdateSettings } from '../context/AppContext'

export default function Settings() {
  const { settings } = useApp()
  const updateSettings = useUpdateSettings()

  function handleUnitChange(units) {
    updateSettings({ units })
  }

  return (
    <div className="p-6 max-w-lg">
      <h1
        className="text-2xl font-semibold mb-6"
        style={{ color: 'var(--color-text-primary)' }}
      >
        Settings
      </h1>

      {/* ── Unit preference — wired up and persisted ── */}
      <section className="mb-8">
        <h2
          className="text-xs uppercase tracking-widest mb-3 font-semibold"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Unit Preference
        </h2>
        <div className="flex gap-3">
          <button
            onClick={() => handleUnitChange('imperial')}
            className="px-5 py-2 rounded text-sm font-medium transition-colors"
            style={{
              backgroundColor:
                settings.units === 'imperial'
                  ? 'var(--color-accent)'
                  : 'var(--color-bg-card)',
              color:
                settings.units === 'imperial'
                  ? 'var(--color-bg-dark)'
                  : 'var(--color-text-secondary)',
              border: '1px solid',
              borderColor:
                settings.units === 'imperial'
                  ? 'var(--color-accent)'
                  : 'var(--color-bg-card-hover)',
            }}
          >
            Imperial (in, °F, mph)
          </button>
          <button
            onClick={() => handleUnitChange('metric')}
            className="px-5 py-2 rounded text-sm font-medium transition-colors"
            style={{
              backgroundColor:
                settings.units === 'metric'
                  ? 'var(--color-accent)'
                  : 'var(--color-bg-card)',
              color:
                settings.units === 'metric'
                  ? 'var(--color-bg-dark)'
                  : 'var(--color-text-secondary)',
              border: '1px solid',
              borderColor:
                settings.units === 'metric'
                  ? 'var(--color-accent)'
                  : 'var(--color-bg-card-hover)',
            }}
          >
            Metric (cm, °C, km/h)
          </button>
        </div>
        <p
          className="mt-2 text-xs"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Currently: <strong style={{ color: 'var(--color-text-primary)' }}>
            {settings.units === 'imperial' ? 'Imperial' : 'Metric'}
          </strong>
          {' '}— persisted to localStorage
        </p>
      </section>

      {/* ── Dark mode placeholder ── */}
      <section className="mb-8">
        <h2
          className="text-xs uppercase tracking-widest mb-3 font-semibold"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Display
        </h2>
        <p
          className="text-sm"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Dark mode is the default and only mode for v1. Light mode toggle coming in Agent 6.
        </p>
      </section>

      {/* ── Alert thresholds placeholder ── */}
      <section>
        <h2
          className="text-xs uppercase tracking-widest mb-3 font-semibold"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Powder Alerts
        </h2>
        <p
          className="text-sm"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Threshold slider and per-resort overrides coming in Agent 6.
        </p>
      </section>
    </div>
  )
}
