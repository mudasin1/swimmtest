/**
 * src/components/ResortCard.jsx
 *
 * The primary dashboard card — shows 7-day snow forecast for a single resort.
 * Conforms to SPEC.md section 8.1 (card layout) and Deliverable 5.
 *
 * Props:
 *   resort      {object}  — resort object from resorts.json
 *   forecast    {object|null} — Open-Meteo response, or null while loading
 *   loading     {'idle'|'loading'|'done'|'error'}
 *   maxValue_cm {number}  — global scale ceiling shared across all cards
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useApp,
  useSaveResort,
  useUpdateSettings,
} from '../context/AppContext';
import { getSnowQuality, getSnowAgeHours, getBestWindow } from '../lib/snowQuality.js';
import {
  getCurrentHourIndex,
  getDayLabel,
  toF,
  toMph,
  POWDER_THRESHOLD_CM,
} from '../lib/utils.js';
import LoadingSkeleton from './LoadingSkeleton.jsx';
import SnowBar from './SnowBar.jsx';
import QualityBadge from './QualityBadge.jsx';

// ── Alert threshold options (SPEC.md section 6 / Agent 6 Deliverable 7) ───────
// "Off" = no override (resort uses the global default threshold).
// Numeric options set a per-resort threshold override (stored in cm).
const THRESHOLD_OPTIONS = [
  { label: 'Off',  value: null  },
  { label: '6"',   value: 15.24 },
  { label: '8"',   value: 20.32 },
  { label: '10"',  value: 25.40 },
  { label: '12"',  value: 30.48 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert meters → feet, rounded to nearest integer. */
function toFeet(m) {
  return Math.round(m * 3.28084);
}

/**
 * Transform Open-Meteo flat daily object into the array-of-objects format
 * that getBestWindow() expects.
 */
function buildDailyArray(daily, count = 7) {
  return daily.time.slice(0, count).map((date, i) => ({
    time: date,
    snowfall_sum:       daily.snowfall_sum[i]       ?? 0,
    rain_sum:           daily.rain_sum[i]           ?? 0,
    windspeed_10m_max:  daily.windspeed_10m_max[i]  ?? 0,
    temperature_2m_max: daily.temperature_2m_max[i] ?? 0,
  }));
}

// ── Card border logic (SPEC.md section 8.1) ───────────────────────────────────

function getCardBorderStyle(powderHit, activeSnow) {
  if (powderHit) {
    return {
      boxShadow:
        '0 0 0 2px var(--color-snow-powder), 0 0 16px 0 rgba(249,115,22,0.3)',
    };
  }
  if (activeSnow) {
    return {
      boxShadow:
        '0 0 0 2px var(--color-snow-light), 0 0 16px 0 rgba(59,130,246,0.3)',
    };
  }
  return {};
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ResortCard({ resort, forecast, loading, maxValue_cm = 1 }) {
  const { savedResortIds, settings } = useApp();
  const saveResort = useSaveResort();
  const updateSettings = useUpdateSettings();
  const navigate = useNavigate();

  const [showPopover, setShowPopover] = useState(false);
  const popoverRef = useRef(null);
  const bellRef = useRef(null);

  // Close popover when clicking outside
  useEffect(() => {
    if (!showPopover) return;
    function handleClickOutside(e) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target) &&
        bellRef.current &&
        !bellRef.current.contains(e.target)
      ) {
        setShowPopover(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPopover]);

  // ── Loading / idle ──────────────────────────────────────────────────────────
  if (loading === 'loading' || loading === 'idle') {
    return <LoadingSkeleton />;
  }

  // ── Error ───────────────────────────────────────────────────────────────────
  if (loading === 'error' || !forecast) {
    return (
      <div
        className="rounded-lg p-4 w-full"
        style={{
          backgroundColor: 'var(--color-bg-card)',
          minHeight: 160,
        }}
      >
        <div
          className="font-semibold mb-1"
          style={{ fontSize: 18, color: 'var(--color-text-primary)' }}
        >
          {resort.name}
        </div>
        <div
          className="text-xs mb-3"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {resort.region && `${resort.region} · `}{resort.country}
        </div>
        <div style={{ fontSize: 13, color: '#EF4444' }}>
          Forecast unavailable
        </div>
      </div>
    );
  }

  // ── Derive data from forecast ───────────────────────────────────────────────
  const currentHourIndex = getCurrentHourIndex(
    forecast.hourly.time,
    forecast.timezone
  );

  const quality = getSnowQuality({
    temp_c:       forecast.hourly.temperature_2m[currentHourIndex] ?? 0,
    wind_kmh:     forecast.hourly.windspeed_10m[currentHourIndex]  ?? 0,
    snowfall_cm:  forecast.hourly.snowfall[currentHourIndex]       ?? 0,
    snowAgeHours: getSnowAgeHours(forecast.hourly.snowfall, currentHourIndex),
    humidity_pct: forecast.hourly.relativehumidity_2m[currentHourIndex] ?? 50,
  });

  const dailyArr   = buildDailyArray(forecast.daily);
  const bestWindow = getBestWindow(dailyArr);

  // Powder threshold hit in next 48 hrs (SPEC.md section 8.1)
  const powderHit = forecast.daily.snowfall_sum
    .slice(0, 2)
    .some((v) => v >= POWDER_THRESHOLD_CM);

  // Active snowfall right now (SPEC.md section 8.1)
  const activeSnow = (forecast.hourly.snowfall[currentHourIndex] ?? 0) > 0.1;

  // Today's summary values
  const highF    = Math.round(toF(forecast.daily.temperature_2m_max[0] ?? 0));
  const lowF     = Math.round(toF(forecast.daily.temperature_2m_min[0] ?? 0));
  const windMph  = toMph(forecast.daily.windspeed_10m_max[0] ?? 0);
  const bestDay  = bestWindow ? getDayLabel(bestWindow.date) : '—';

  // Save / alert state
  const isSaved     = savedResortIds.includes(resort.id);
  const hasThreshold = settings.thresholds?.[resort.id] !== undefined;

  const safeMax = maxValue_cm > 0 ? maxValue_cm : 1;

  function handleThresholdSelect(value) {
    if (value === null) {
      // "Off" — remove the per-resort override so it falls back to the default.
      // Does NOT disable alerts for this resort (SPEC.md section 6 / Deliverable 7).
      const { [resort.id]: _removed, ...rest } = settings.thresholds ?? {};
      updateSettings({ thresholds: rest });
    } else {
      updateSettings({
        thresholds: { ...(settings.thresholds ?? {}), [resort.id]: value },
      });
    }
    setShowPopover(false);
  }

  function handleCardClick() {
    navigate(`/resort/${resort.id}`);
  }

  return (
    <div
      className="rounded-lg p-4 w-full transition-colors cursor-pointer"
      style={{
        backgroundColor: 'var(--color-bg-card)',
        minHeight: 160,
        position: 'relative',
        ...getCardBorderStyle(powderHit, activeSnow),
      }}
      onClick={handleCardClick}
      onMouseEnter={(e) =>
        (e.currentTarget.style.backgroundColor = 'var(--color-bg-card-hover)')
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.backgroundColor = 'var(--color-bg-card)')
      }
    >
      {/* ── Row 1: Name · Region · Bell · Star ──────────────────────────────── */}
      <div className="flex items-start justify-between mb-1">
        <div className="flex-1 min-w-0">
          <span
            className="font-semibold resort-name truncate block"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {resort.name}
          </span>
        </div>

        {/* Bell + Star — stop propagation so clicks don't navigate */}
        <div
          className="flex items-center gap-2 ml-2 flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Alert bell */}
          <div style={{ position: 'relative' }}>
            <button
              ref={bellRef}
              aria-label="Set powder alert threshold"
              onClick={() => setShowPopover((v) => !v)}
              title={hasThreshold ? 'Custom alert threshold set' : 'Set alert threshold'}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px 4px',
                fontSize: 16,
                // Filled + orange when override set; muted + dimmed when using default
                color: hasThreshold
                  ? 'var(--color-snow-powder)'
                  : 'var(--color-text-secondary)',
                opacity: hasThreshold ? 1 : 0.5,
                transition: 'color 0.15s, opacity 0.15s',
              }}
            >
              🔔
            </button>

            {/* Popover */}
            {showPopover && (
              <div
                ref={popoverRef}
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 4,
                  backgroundColor: '#0F172A',
                  border: '1px solid var(--color-bg-card-hover)',
                  borderRadius: 8,
                  padding: '8px 0',
                  zIndex: 50,
                  minWidth: 140,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--color-text-secondary)',
                    padding: '2px 12px 6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Alert threshold
                </div>
                {THRESHOLD_OPTIONS.map((opt) => {
                  // Determine whether this option is currently active.
                  // "Off" (null) is active when no per-resort override is set.
                  const currentValue = settings.thresholds?.[resort.id];
                  const isActive =
                    opt.value === null
                      ? currentValue === undefined
                      : currentValue === opt.value;

                  return (
                    <button
                      key={String(opt.value)}
                      onClick={() => handleThresholdSelect(opt.value)}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '6px 12px',
                        fontSize: 13,
                        backgroundColor: isActive
                          ? 'rgba(249,115,22,0.15)'
                          : 'transparent',
                        color: isActive
                          ? 'var(--color-snow-powder)'
                          : 'var(--color-text-primary)',
                        fontWeight: isActive ? 600 : 400,
                      }}
                    >
                      {opt.label}
                      {isActive && ' ✓'}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Save star */}
          <button
            aria-label={isSaved ? 'Unsave resort' : 'Save resort'}
            onClick={() => saveResort(resort.id)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px 4px',
              fontSize: 18,
              color: isSaved ? '#F59E0B' : 'var(--color-text-secondary)',
              lineHeight: 1,
            }}
          >
            {isSaved ? '★' : '☆'}
          </button>
        </div>
      </div>

      {/* ── Row 2: Region · Quality badge · Summit elevation ─────────────────── */}
      <div
        className="flex items-center gap-2 mb-3 flex-wrap"
        style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}
      >
        {resort.region && (
          <span>{resort.region}</span>
        )}
        <span>·</span>
        <QualityBadge quality={quality} size="md" />
        <span>·</span>
        <span>Summit {toFeet(resort.summitElevation).toLocaleString()}ft</span>
      </div>

      {/* ── Divider ──────────────────────────────────────────────────────────── */}
      <div
        style={{
          borderTop: '1px solid var(--color-bg-card-hover)',
          marginBottom: 10,
        }}
      />

      {/* ── Snow bars: 7 days ─────────────────────────────────────────────────── */}
      <div
        className="flex gap-1 justify-between mb-1"
        style={{ minHeight: 80 }}
      >
        {forecast.daily.time.slice(0, 7).map((date, i) => (
          <SnowBar
            key={date}
            snowfall_cm={forecast.daily.snowfall_sum[i] ?? 0}
            rain_cm={forecast.daily.rain_sum[i] ?? 0}
            maxValue_cm={safeMax}
            showLabel={true}
            date={date}
            width={28}
            maxHeight={80}
          />
        ))}
      </div>

      {/* ── Divider ──────────────────────────────────────────────────────────── */}
      <div
        style={{
          borderTop: '1px solid var(--color-bg-card-hover)',
          marginTop: 8,
          marginBottom: 8,
        }}
      />

      {/* ── Footer: Hi/Lo · Wind · Best day ──────────────────────────────────── */}
      <div
        className="flex items-center gap-3 flex-wrap"
        style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}
      >
        <span>
          Hi{' '}
          <span style={{ color: 'var(--color-text-primary)' }}>{highF}°F</span>
        </span>
        <span>
          Lo{' '}
          <span style={{ color: 'var(--color-text-primary)' }}>{lowF}°F</span>
        </span>
        <span>
          💨{' '}
          <span style={{ color: 'var(--color-text-primary)' }}>{windMph}mph</span>
        </span>
        <span>
          ✨ Best:{' '}
          <span style={{ color: 'var(--color-text-primary)' }}>{bestDay}</span>
        </span>
      </div>
    </div>
  );
}
