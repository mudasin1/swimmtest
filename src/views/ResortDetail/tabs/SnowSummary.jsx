/**
 * src/views/ResortDetail/tabs/SnowSummary.jsx
 *
 * Snow Summary tab for the Resort Detail view.
 * SPEC.md section 8.3, Tab 1.
 *
 * Props: { resort, forecast }
 *
 * Named export AISummarySection accepts { summary, summaryLoading, error, onRetry }.
 * AI summary is lazy-loaded via useEffect only when this tab mounts.
 */

import { useState, useEffect } from 'react'
import { getSnowQuality, getSnowAgeHours, getBestWindow } from '../../../lib/snowQuality.js';
import {
  getCurrentHourIndex,
  getDayLabel,
  toF,
  toInches,
  toMph,
} from '../../../lib/utils.js';
import QualityBadge from '../../../components/QualityBadge.jsx';
import { getCachedOrFetchSummary } from '../../../lib/aiSummary.js'
import { useApp, useSetSummary } from '../../../context/AppContext.jsx'

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildDailyArray(daily, count = 7) {
  return daily.time.slice(0, count).map((date, i) => ({
    time:               date,
    snowfall_sum:       daily.snowfall_sum[i]       ?? 0,
    rain_sum:           daily.rain_sum[i]           ?? 0,
    windspeed_10m_max:  daily.windspeed_10m_max[i]  ?? 0,
    temperature_2m_max: daily.temperature_2m_max[i] ?? 0,
  }));
}

// ── AISummarySection ──────────────────────────────────────────────────────────

/**
 * AI summary section.
 *
 * Props:
 *   summary        {string|null}    — AI-generated 3-sentence summary
 *   summaryLoading {boolean}        — true while the API call is in-flight
 *   error          {string|null}    — error message if the API call failed
 *   onRetry        {function}       — callback to clear error and retry fetch
 *
 * States:
 *   summaryLoading=true  → pulsing 3-line skeleton
 *   error set            → muted-red error message + retry button
 *   summary set          → rendered text, 14px, line-height 1.6
 *   neither              → "Forecast summary not available" in muted text
 */
export function AISummarySection({ summary, summaryLoading, error, onRetry }) {
  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (summaryLoading) {
    return (
      <div className="animate-pulse" style={{ padding: '4px 0' }}>
        {[100, 90, 75].map((w, i) => (
          <div
            key={i}
            style={{
              height: 14,
              borderRadius: 4,
              backgroundColor: 'var(--color-bg-card-hover)',
              marginBottom: i < 2 ? 10 : 0,
              width: `${w}%`,
            }}
          />
        ))}
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (error) {
    return (
      <div>
        <p
          style={{
            fontSize: 14,
            color: '#EF4444',
            margin: '0 0 10px',
          }}
        >
          Summary unavailable: {error}
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              fontSize: 12,
              color: 'var(--color-text-secondary)',
              background: 'none',
              border: '1px solid var(--color-bg-card-hover)',
              borderRadius: 4,
              padding: '4px 10px',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  // ── Summary text ──────────────────────────────────────────────────────────
  if (summary) {
    return (
      <p
        className="ai-summary"
        style={{
          fontSize: 14,
          lineHeight: 1.6,
          color: 'var(--color-text-primary)',
          margin: 0,
        }}
      >
        {summary}
      </p>
    );
  }

  // ── Empty / not available ─────────────────────────────────────────────────
  return (
    <p
      style={{
        fontSize: 14,
        color: 'var(--color-text-secondary)',
        margin: 0,
        fontStyle: 'italic',
      }}
    >
      Forecast summary not available
    </p>
  );
}

// ── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({ label, value }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <span
        className="data-label"
        style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: 'var(--color-text-primary)',
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ── SnowSummary ───────────────────────────────────────────────────────────────

export default function SnowSummary({ resort, forecast }) {
  // ── AI summary state ───────────────────────────────────────────────────────
  const { summaries } = useApp()
  const setSummary = useSetSummary()
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState(null)
  // retryCount is incremented on retry to re-trigger the effect (deps include it)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    // Only fetch if we don't already have a summary for this resort today
    // eslint-disable-next-line no-unused-vars
    const todayKey = `${resort.id}_${new Date().toISOString().split('T')[0]}`
    if (summaries[resort.id]) return   // already loaded in this session
    if (!forecast) return               // forecast not ready yet

    setSummaryLoading(true)
    setSummaryError(null)

    getCachedOrFetchSummary(resort, forecast)
      .then(text => {
        setSummary(resort.id, text)
        setSummaryLoading(false)
      })
      .catch(err => {
        console.error(err)
        setSummaryError(err.message)
        setSummaryLoading(false)
      })
  }, [resort.id, !!forecast, retryCount]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleRetry() {
    setSummary(resort.id, null)   // clear from context so effect's early-return is bypassed
    setSummaryError(null)
    setRetryCount(c => c + 1)    // increment to re-trigger the effect
  }

  const idx = getCurrentHourIndex(forecast.hourly.time, forecast.timezone);

  // ── Quality ───────────────────────────────────────────────────────────────
  const quality = getSnowQuality({
    temp_c:       forecast.hourly.temperature_2m[idx]       ?? 0,
    wind_kmh:     forecast.hourly.windspeed_10m[idx]        ?? 0,
    snowfall_cm:  forecast.hourly.snowfall[idx]             ?? 0,
    snowAgeHours: getSnowAgeHours(forecast.hourly.snowfall, idx),
    humidity_pct: forecast.hourly.relativehumidity_2m[idx]  ?? 50,
  });

  // ── Snow depth ────────────────────────────────────────────────────────────
  const snowDepthIn = toInches(forecast.hourly.snow_depth[idx] ?? 0);

  // ── Current conditions ────────────────────────────────────────────────────
  const tempF      = Math.round(toF(forecast.hourly.temperature_2m[idx]      ?? 0));
  const feelsLikeF = Math.round(toF(forecast.hourly.apparent_temperature[idx] ?? 0));
  const humidity   = forecast.hourly.relativehumidity_2m[idx] ?? 0;

  // ── Best window ───────────────────────────────────────────────────────────
  const dailyArr   = buildDailyArray(forecast.daily);
  const bestWindow = getBestWindow(dailyArr);
  const bestDayLabel  = bestWindow ? getDayLabel(bestWindow.date) : '—';
  const bestSnowIn    = bestWindow ? toInches(dailyArr[bestWindow.index].snowfall_sum) : 0;

  return (
    <div style={{ padding: '24px 0' }}>

      {/* ── Quality badge (large) ─────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <QualityBadge quality={quality} size="lg" />
      </div>

      {/* ── Primary stats row ────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          gap: 40,
          marginBottom: 24,
          flexWrap: 'wrap',
        }}
      >
        <StatTile label="Summit Depth" value={`${snowDepthIn}"`} />
        <StatTile label="Season Context" value="—" />
      </div>

      {/* ── Secondary conditions row ─────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          gap: 24,
          marginBottom: 28,
          padding: '14px 16px',
          borderRadius: 8,
          backgroundColor: 'var(--color-bg-card)',
          flexWrap: 'wrap',
          fontSize: 14,
          color: 'var(--color-text-secondary)',
        }}
      >
        <span>
          🌡️ Temp{' '}
          <strong style={{ color: 'var(--color-text-primary)' }}>{tempF}°F</strong>
        </span>
        <span>
          🥶 Feels like{' '}
          <strong style={{ color: 'var(--color-text-primary)' }}>{feelsLikeF}°F</strong>
        </span>
        <span>
          💧 Humidity{' '}
          <strong style={{ color: 'var(--color-text-primary)' }}>{humidity}%</strong>
        </span>
      </div>

      {/* ── Best window callout ───────────────────────────────────────────── */}
      {bestWindow && (
        <div
          style={{
            marginBottom: 28,
            padding: '12px 16px',
            borderRadius: 8,
            border: '1px solid rgba(56,189,248,0.3)',
            backgroundColor: 'rgba(56,189,248,0.05)',
            fontSize: 14,
            color: 'var(--color-accent)',
            fontWeight: 500,
          }}
        >
          ✨ Best conditions:{' '}
          <strong>{bestDayLabel}</strong>
          {bestSnowIn > 0 && ` — ${bestSnowIn}"`}
        </div>
      )}

      {/* ── AI Summary section ────────────────────────────────────────────── */}
      <div
        style={{
          padding: '16px',
          borderRadius: 8,
          backgroundColor: 'var(--color-bg-card)',
          border: '1px solid var(--color-bg-card-hover)',
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            color: 'var(--color-text-secondary)',
            marginBottom: 12,
          }}
        >
          AI Summary
        </div>
        <AISummarySection
          summary={summaries[resort.id] ?? null}
          summaryLoading={summaryLoading}
          error={summaryError}
          onRetry={handleRetry}
        />
      </div>
    </div>
  );
}
