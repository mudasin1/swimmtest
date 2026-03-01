/**
 * src/views/ResortDetail.jsx
 *
 * /resort/:slug route — full 3-tab resort detail view.
 * SPEC.md section 8.3 and Deliverable 4.
 *
 * Tabs: Snow Summary | Forecast | Conditions
 *
 * On mount:
 *   1. Read :slug param, find resort in context.
 *   2. If forecasts[resort.id] already exists: use it immediately (no re-fetch).
 *   3. If not: call loadSingleForecast() from dataLoader.js, show loading state.
 *   4. If resort ID not found in resorts.json: show "Resort not found" with back button.
 *
 * Back button: navigate(-1) if history exists, otherwise navigate('/').
 * Save star and alert bell: synced with Dashboard via shared AppContext.
 */

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useApp,
  useSaveResort,
  useSetForecast,
  useSetLoadingState,
  useUpdateSettings,
} from '../context/AppContext';
import { loadSingleForecast } from '../lib/dataLoader.js';
import SnowSummary from './ResortDetail/tabs/SnowSummary.jsx';
import ForecastTab from './ResortDetail/tabs/Forecast.jsx';
import Conditions from './ResortDetail/tabs/Conditions.jsx';

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS = ['Snow Summary', 'Forecast', 'Conditions'];

const THRESHOLD_OPTIONS = [
  { label: '6"',  value: 15.24 },
  { label: '8"',  value: 20.32 },
  { label: '10"', value: 25.40 },
  { label: '12"', value: 30.48 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function toFeet(m) {
  return Math.round(m * 3.28084);
}

// ── Loading spinner ───────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div
      style={{
        width: 32,
        height: 32,
        border: '3px solid var(--color-bg-card-hover)',
        borderTopColor: 'var(--color-accent)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }}
    />
  );
}

// ── Alert bell popover (same behavior as ResortCard) ──────────────────────────

function AlertBell({ resort, settings, updateSettings }) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef(null);
  const bellRef    = useRef(null);
  const hasThreshold = settings.thresholds?.[resort.id] !== undefined;

  useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target) &&
        bellRef.current   && !bellRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function handleSelect(value) {
    updateSettings({ thresholds: { ...settings.thresholds, [resort.id]: value } });
    setOpen(false);
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={bellRef}
        aria-label="Set powder alert threshold"
        onClick={() => setOpen((v) => !v)}
        style={{
          background: 'none',
          border: '1px solid var(--color-bg-card-hover)',
          borderRadius: 8,
          cursor: 'pointer',
          padding: '6px 10px',
          fontSize: 16,
          color: hasThreshold ? 'var(--color-alert-powder)' : 'var(--color-text-secondary)',
        }}
      >
        🔔
      </button>

      {open && (
        <div
          ref={popoverRef}
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 6,
            backgroundColor: '#0F172A',
            border: '1px solid var(--color-bg-card-hover)',
            borderRadius: 8,
            padding: '8px 0',
            zIndex: 50,
            minWidth: 150,
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
          {THRESHOLD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleSelect(opt.value)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '6px 12px',
                fontSize: 13,
                color:
                  settings.thresholds?.[resort.id] === opt.value
                    ? 'var(--color-snow-powder)'
                    : 'var(--color-text-primary)',
                fontWeight: settings.thresholds?.[resort.id] === opt.value ? 600 : 400,
              }}
            >
              {opt.label}
              {settings.thresholds?.[resort.id] === opt.value && ' ✓'}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── ResortDetail ─────────────────────────────────────────────────────────────-

export default function ResortDetail() {
  const { slug }    = useParams();
  const navigate    = useNavigate();

  // Changed: using savedSlugs instead of savedResortIds
  const { resorts, forecasts, loadingStates, savedSlugs, settings } = useApp();
  const saveResort      = useSaveResort();
  const setForecast     = useSetForecast();
  const setLoadingState = useSetLoadingState();
  const updateSettings  = useUpdateSettings();

  // Tab state: local only — not in URL, not in global context (SPEC.md Deliverable 4)
  const [activeTab, setActiveTab] = useState(0);

  const resort       = resorts.find((r) => r.slug === slug) ?? null;
  const forecast     = resort ? (forecasts[resort.id] ?? null) : null;
  const loadingState = resort ? (loadingStates[resort.id] ?? 'idle') : 'idle';

  // Stable refs so the fetch effect closure always has latest dispatchers
  const setForecastRef     = useRef(setForecast);
  const setLoadingStateRef = useRef(setLoadingState);
  useEffect(() => { setForecastRef.current = setForecast; },      [setForecast]);
  useEffect(() => { setLoadingStateRef.current = setLoadingState; }, [setLoadingState]);

  // Trigger fetch for Tier 2 resorts or direct URL navigation (no prior cache)
  const fetchStarted = useRef(false);
  useEffect(() => {
    if (!resort)                     return; // will show "not found"
    if (forecast)                    return; // already loaded — no re-fetch (SPEC step 2)
    if (fetchStarted.current)        return;
    if (loadingState === 'loading')  return; // already in flight
    fetchStarted.current = true;
    loadSingleForecast(
      resort,
      (rid, data)   => setForecastRef.current(rid, data),
      (rid, status) => setLoadingStateRef.current(rid, status)
    );
  // Intentionally only runs when resort.id changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resort?.id]);

  // ── Back navigation ─────────────────────────────────────────────────────-
  function handleBack() {
    // If user navigated directly (no prior history entry), go home instead
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  }

  // ── Resort not found ─────────────────────────────────────────────────────
  if (!resort) {
    return (
      <div style={{ padding: 24, minHeight: '100vh' }}>
        <button
          onClick={handleBack}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-accent)',
            fontSize: 14,
            padding: 0,
            marginBottom: 20,
          }}
        >
          ← Back
        </button>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            marginBottom: 8,
          }}
        >
          Resort not found
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>
          No resort with slug: <code>{slug}</code>
        </p>
      </div>
    );
  }

  // Changed: Check savedSlugs instead of savedResortIds, use resort.slug
  const isSaved = savedSlugs.includes(resort.slug);

  // ── Full-page loading state (SPEC.md Deliverable 4 loading layout) ─────--
  if (!forecast || loadingState === 'loading' || loadingState === 'idle') {
    return (
      <div style={{ padding: 24, minHeight: '100vh' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginBottom: 40,
          }}
        >
          <button
            onClick={handleBack}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-accent)',
              fontSize: 14,
              padding: 0,
              flexShrink: 0,
            }}
          >
            ← Back
          </button>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              margin: 0,
            }}
          >
            {resort.name}
          </h1>
        </div>

        {/* Loading indicator */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
            marginTop: 60,
            color: 'var(--color-text-secondary)',
          }}
        >
          <Spinner />
          <p style={{ fontSize: 14, margin: 0 }}>Loading forecast…</p>
        </div>
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────--
  if (loadingState === 'error') {
    return (
      <div style={{ padding: 24 }}>
        <button
          onClick={handleBack}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-accent)',
            fontSize: 14,
            padding: 0,
            marginBottom: 20,
          }}
        >
          ← Back
        </button>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            marginBottom: 12,
          }}
        >
          {resort.name}
        </h1>
        <p style={{ color: '#EF4444', fontSize: 14 }}>
          Forecast unavailable — could not fetch data for this resort.
        </p>
      </div>
    );
  }

  // ── Full detail view ─────────────────────────────────────────────────────-
  return (
    <div style={{ minHeight: '100vh', paddingBottom: 48 }}>

      {/* ── Header: back · name · star · bell ─────────────────────────────-- */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '16px 24px 12px',
          borderBottom: '1px solid var(--color-bg-card)',
        }}
      >
        <button
          onClick={handleBack}
          aria-label="Go back"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-accent)',
            fontSize: 14,
            padding: '4px 0',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          ← Back
        </button>

        <h1
          style={{
            flex: 1,
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            margin: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {resort.name}
        </h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {/* Save star — reading from shared context, so Dashboard card stays in sync */}
          {/* Changed: onClick now passes resort.slug */}
          <button
            aria-label={isSaved ? 'Unsave resort' : 'Save resort'}
            onClick={() => saveResort(resort.slug)}
            style={{
              background: 'none',
              border: '1px solid var(--color-bg-card-hover)',
              borderRadius: 8,
              cursor: 'pointer',
              padding: '6px 10px',
              fontSize: 18,
              color: isSaved ? '#F59E0B' : 'var(--color-text-secondary)',
              lineHeight: 1,
            }}
          >
            {isSaved ? '★' : '☆'}
          </button>

          <AlertBell
            resort={resort}
            settings={settings}
            updateSettings={updateSettings}
          />
        </div>
      </div>

      {/* ── Subtitle: region · summit · base elevation ─────────────────────-- */}
      <div
        style={{
          padding: '8px 24px',
          fontSize: 13,
          color: 'var(--color-text-secondary)',
          borderBottom: '1px solid var(--color-bg-card)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        {resort.region && (
          <>
            <span>{resort.region}</span>
            <span>•</span>
          </>
        )}
        <span>
          Summit{' '}
          <span style={{ color: 'var(--color-text-primary)' }}>
            {toFeet(resort.summitElevation).toLocaleString()}ft
          </span>
        </span>
        {resort.baseElevation > 0 && (
          <>
            <span>•</span>
            <span>
              Base{' '}
              <span style={{ color: 'var(--color-text-primary)' }}>
                {toFeet(resort.baseElevation).toLocaleString()}ft
              </span>
            </span>
          </>
        )}
      </div>

      {/* ── Tab bar ───────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--color-bg-card)',
          padding: '0 24px',
        }}
      >
        {TABS.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '12px 16px',
              fontSize: 14,
              fontWeight: activeTab === i ? 600 : 400,
              color:
                activeTab === i
                  ? 'var(--color-text-primary)'
                  : 'var(--color-text-secondary)',
              borderBottom:
                activeTab === i
                  ? '2px solid var(--color-accent)'
                  : '2px solid transparent',
              marginBottom: -1,
              transition: 'color 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Tab content ───────────────────────────────────────────────────── */}
      <div style={{ padding: '0 24px' }}>
        {/* Switching tabs does NOT re-fetch — data stays in context */}
        {activeTab === 0 && <SnowSummary resort={resort} forecast={forecast} />}
        {activeTab === 1 && <ForecastTab resort={resort} forecast={forecast} />}
        {activeTab === 2 && <Conditions  resort={resort} forecast={forecast} />}
      </div>
    </div>
  );
}
