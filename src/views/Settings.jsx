/**
 * src/views/Settings.jsx
 *
 * Full settings page — powder alerts, display preferences, and alert history.
 * Conforms to SPEC.md section 8.4 and Agent 6 Deliverable 5.
 *
 * Sections:
 *   1. Powder Alerts — permission status, default threshold slider, per-resort overrides
 *   2. Display       — units toggle (Imperial / Metric)
 *   3. Alert History — human-readable timestamps, clear button
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, useUpdateSettings, useUpdateAlertLog } from '../context/AppContext';
import {
  requestNotificationPermission,
  getNotificationPermission,
} from '../lib/alerts';
import { timeAgo, CM_TO_INCHES } from '../lib/utils';

// ── Constants ─────────────────────────────────────────────────────────────────

// Default threshold slider: 2"–18" in 2" increments, stored in cm
const THRESHOLD_SLIDER_MIN_IN = 2;
const THRESHOLD_SLIDER_MAX_IN = 18;
const THRESHOLD_SLIDER_STEP_IN = 2;
const IN_TO_CM = 2.54;

/** Round a cm value to the nearest 2" increment (in inches), clamped to range. */
function cmToSliderInches(cm) {
  const inches = cm / IN_TO_CM;
  const snapped = Math.round(inches / THRESHOLD_SLIDER_STEP_IN) * THRESHOLD_SLIDER_STEP_IN;
  return Math.max(THRESHOLD_SLIDER_MIN_IN, Math.min(THRESHOLD_SLIDER_MAX_IN, snapped));
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ children }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
      }}
    >
      <span
        style={{
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontWeight: 600,
          color: 'var(--color-text-secondary)',
          whiteSpace: 'nowrap',
        }}
      >
        {children}
      </span>
      <div
        style={{
          flex: 1,
          height: 1,
          backgroundColor: 'var(--color-bg-card-hover)',
        }}
      />
    </div>
  );
}

// ── Threshold slider ──────────────────────────────────────────────────────────

function ThresholdSlider({ valueInches, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span
        style={{
          fontSize: 11,
          color: 'var(--color-text-secondary)',
          minWidth: 20,
          textAlign: 'right',
        }}
      >
        {THRESHOLD_SLIDER_MIN_IN}"
      </span>
      <input
        type="range"
        min={THRESHOLD_SLIDER_MIN_IN}
        max={THRESHOLD_SLIDER_MAX_IN}
        step={THRESHOLD_SLIDER_STEP_IN}
        value={valueInches}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          flex: 1,
          accentColor: 'var(--color-accent)',
          cursor: 'pointer',
        }}
      />
      <span
        style={{
          fontSize: 11,
          color: 'var(--color-text-secondary)',
          minWidth: 20,
        }}
      >
        {THRESHOLD_SLIDER_MAX_IN}"
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Settings() {
  const { resorts, settings, alertLog } = useApp();
  const updateSettings = useUpdateSettings();
  const updateAlertLog = useUpdateAlertLog();
  const navigate = useNavigate();

  // Track notification permission in local state so the UI updates immediately
  // after the user clicks "Enable Notifications" without a page reload.
  const [notifPermission, setNotifPermission] = useState(
    () => getNotificationPermission()
  );

  // ── Notification permission ────────────────────────────────────────────────

  async function handleEnableNotifications() {
    const result = await requestNotificationPermission();
    setNotifPermission(result);
  }

  // ── Default threshold slider ───────────────────────────────────────────────

  const defaultThresholdInches = cmToSliderInches(settings.defaultThreshold ?? 15.24);

  function handleDefaultThresholdChange(inches) {
    updateSettings({ defaultThreshold: inches * IN_TO_CM });
  }

  // ── Per-resort overrides ───────────────────────────────────────────────────

  // Only show resorts that have an explicit per-resort threshold set
  const overrideResorts = resorts.filter(
    (r) => settings.thresholds?.[r.id] !== undefined
  );

  function handleOverrideChange(resortId, inches) {
    updateSettings({
      thresholds: {
        ...(settings.thresholds ?? {}),
        [resortId]: inches * IN_TO_CM,
      },
    });
  }

  function handleResetOverride(resortId) {
    const { [resortId]: _removed, ...rest } = settings.thresholds ?? {};
    updateSettings({ thresholds: rest });
  }

  // ── Units ──────────────────────────────────────────────────────────────────

  function handleUnitChange(units) {
    updateSettings({ units });
  }

  // ── Alert history ──────────────────────────────────────────────────────────

  // Only entries with a real timestamp
  const alertEntries = Object.entries(alertLog ?? {}).filter(
    ([, ts]) => ts > 0
  );

  function handleClearHistory() {
    // Reset all timestamps to 0 (keys stay so alerts can re-fire immediately)
    Object.keys(alertLog ?? {}).forEach((id) => updateAlertLog(id, 0));
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function getResortName(id) {
    return resorts.find((r) => r.id === id)?.name ?? id;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        padding: '24px 24px 48px',
        maxWidth: 640,
        margin: '0 auto',
        color: 'var(--color-text-primary)',
      }}
    >
      <h1
        style={{
          fontSize: 24,
          fontWeight: 600,
          marginBottom: 32,
          color: 'var(--color-text-primary)',
        }}
      >
        Settings
      </h1>

      {/* ══════════════════════════════════════════════════════════════════════
          1. POWDER ALERTS
      ═══════════════════════════════════════════════════════════════════════ */}
      <section style={{ marginBottom: 40 }}>
        <SectionHeader>Powder Alerts</SectionHeader>

        {/* ── Notification permission ─────────────────────────────────────── */}
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              fontSize: 13,
              color: 'var(--color-text-secondary)',
              marginBottom: 8,
            }}
          >
            Notification permission
          </div>

          {notifPermission === 'granted' && (
            <div style={{ fontSize: 14, color: '#4ADE80', fontWeight: 500 }}>
              ✅ Notifications enabled
            </div>
          )}

          {notifPermission === 'default' && (
            <button
              onClick={handleEnableNotifications}
              style={{
                padding: '8px 18px',
                borderRadius: 6,
                border: 'none',
                backgroundColor: 'var(--color-accent)',
                color: 'var(--color-bg-dark)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Enable Notifications
            </button>
          )}

          {notifPermission === 'denied' && (
            <div style={{ fontSize: 14, color: '#F97316', fontWeight: 500 }}>
              ⚠️ Notifications blocked. Enable them in your browser settings.
            </div>
          )}

          {notifPermission === 'unsupported' && (
            <div style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>
              Your browser doesn't support notifications.
            </div>
          )}
        </div>

        {/* ── Default threshold slider ────────────────────────────────────── */}
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--color-text-primary)',
              marginBottom: 4,
            }}
          >
            Default powder threshold
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--color-text-secondary)',
              marginBottom: 12,
            }}
          >
            Alert me when forecast hits:
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              marginBottom: 8,
            }}
          >
            <span
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: 'var(--color-accent)',
                minWidth: 48,
                textAlign: 'right',
              }}
            >
              {defaultThresholdInches}"
            </span>
            <div style={{ flex: 1 }}>
              <ThresholdSlider
                valueInches={defaultThresholdInches}
                onChange={handleDefaultThresholdChange}
              />
            </div>
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--color-text-secondary)',
            }}
          >
            Stored as {(defaultThresholdInches * IN_TO_CM).toFixed(2)} cm · applies to all
            resorts without a custom override
          </div>
        </div>

        {/* ── Per-resort overrides ────────────────────────────────────────── */}
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--color-text-primary)',
              marginBottom: 12,
            }}
          >
            Per-resort overrides
          </div>

          {overrideResorts.length === 0 ? (
            <div
              style={{
                fontSize: 13,
                color: 'var(--color-text-secondary)',
                padding: '12px 0',
                fontStyle: 'italic',
              }}
            >
              No custom thresholds set. Use the 🔔 icon on any resort card to set one.
            </div>
          ) : (
            <div
              style={{
                borderRadius: 8,
                border: '1px solid var(--color-bg-card-hover)',
                overflow: 'hidden',
              }}
            >
              {overrideResorts.map((resort, idx) => {
                const resortThresholdCm = settings.thresholds[resort.id];
                const resortThresholdIn = cmToSliderInches(resortThresholdCm);
                return (
                  <div
                    key={resort.id}
                    style={{
                      padding: '12px 16px',
                      backgroundColor:
                        idx % 2 === 0
                          ? 'var(--color-bg-card)'
                          : 'rgba(30,41,59,0.5)',
                      borderBottom:
                        idx < overrideResorts.length - 1
                          ? '1px solid var(--color-bg-card-hover)'
                          : 'none',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        marginBottom: 8,
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 500,
                          fontSize: 14,
                          flex: 1,
                          color: 'var(--color-text-primary)',
                        }}
                      >
                        {resort.name}
                      </span>
                      <span
                        style={{
                          fontSize: 20,
                          fontWeight: 700,
                          color: 'var(--color-snow-powder)',
                          minWidth: 40,
                          textAlign: 'right',
                        }}
                      >
                        {resortThresholdIn}"
                      </span>
                    </div>
                    <ThresholdSlider
                      valueInches={resortThresholdIn}
                      onChange={(in_) => handleOverrideChange(resort.id, in_)}
                    />
                    <div style={{ marginTop: 8, textAlign: 'right' }}>
                      <button
                        onClick={() => handleResetOverride(resort.id)}
                        style={{
                          fontSize: 12,
                          padding: '4px 10px',
                          borderRadius: 4,
                          border: '1px solid var(--color-bg-card-hover)',
                          backgroundColor: 'transparent',
                          color: 'var(--color-text-secondary)',
                          cursor: 'pointer',
                        }}
                      >
                        Reset to default
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          2. DISPLAY
      ═══════════════════════════════════════════════════════════════════════ */}
      <section style={{ marginBottom: 40 }}>
        <SectionHeader>Display</SectionHeader>

        <div
          style={{
            fontSize: 13,
            color: 'var(--color-text-secondary)',
            marginBottom: 10,
          }}
        >
          Units
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {[
            { value: 'imperial', label: 'Imperial' },
            { value: 'metric',   label: 'Metric'   },
          ].map(({ value, label }) => {
            const active = settings.units === value;
            return (
              <button
                key={value}
                onClick={() => handleUnitChange(value)}
                style={{
                  padding: '8px 20px',
                  borderRadius: 6,
                  border: '1px solid',
                  borderColor: active
                    ? 'var(--color-accent)'
                    : 'var(--color-bg-card-hover)',
                  backgroundColor: active
                    ? 'var(--color-accent)'
                    : 'var(--color-bg-card)',
                  color: active
                    ? 'var(--color-bg-dark)'
                    : 'var(--color-text-secondary)',
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                {label} {active ? '●' : '○'}
              </button>
            );
          })}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          3. ALERT HISTORY
      ═══════════════════════════════════════════════════════════════════════ */}
      <section>
        <SectionHeader>Alert History</SectionHeader>

        {alertEntries.length === 0 ? (
          <div
            style={{
              fontSize: 13,
              color: 'var(--color-text-secondary)',
              fontStyle: 'italic',
              marginBottom: 16,
            }}
          >
            No alerts fired yet this session.
          </div>
        ) : (
          <div
            style={{
              borderRadius: 8,
              border: '1px solid var(--color-bg-card-hover)',
              overflow: 'hidden',
              marginBottom: 16,
            }}
          >
            {alertEntries
              .sort(([, a], [, b]) => b - a) // most recent first
              .map(([resortId, ts], idx) => (
                <div
                  key={resortId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    backgroundColor:
                      idx % 2 === 0
                        ? 'var(--color-bg-card)'
                        : 'rgba(30,41,59,0.5)',
                    borderBottom:
                      idx < alertEntries.length - 1
                        ? '1px solid var(--color-bg-card-hover)'
                        : 'none',
                  }}
                >
                  {/* Resort name — clickable link to detail page */}
                  <button
                    onClick={() => navigate(`/resort/${resortId}`)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 14,
                      fontWeight: 500,
                      color: 'var(--color-accent)',
                      padding: 0,
                      textAlign: 'left',
                      textDecoration: 'underline',
                    }}
                  >
                    {getResortName(resortId)}
                  </button>

                  {/* Human-readable timestamp */}
                  <span
                    style={{
                      fontSize: 12,
                      color: 'var(--color-text-secondary)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Last alerted: {timeAgo(ts)}
                  </span>
                </div>
              ))}
          </div>
        )}

        {/* Clear button — always visible so user can reset after manually
            reviewing history; disabled if nothing to clear */}
        <button
          onClick={handleClearHistory}
          disabled={alertEntries.length === 0}
          style={{
            padding: '8px 18px',
            borderRadius: 6,
            border: '1px solid var(--color-bg-card-hover)',
            backgroundColor: 'transparent',
            color:
              alertEntries.length > 0
                ? 'var(--color-text-secondary)'
                : 'var(--color-bg-card-hover)',
            fontSize: 13,
            cursor: alertEntries.length > 0 ? 'pointer' : 'default',
          }}
        >
          Clear Alert History
        </button>
      </section>
    </div>
  );
}
