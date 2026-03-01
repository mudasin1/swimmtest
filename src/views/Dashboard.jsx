/**
 * src/views/Dashboard.jsx
 *
 * Full dashboard implementation — loads Tier 1 resort forecasts in batches,
 * renders ResortCards progressively, with sort / filter / search controls.
 * Conforms to SPEC.md section 8.1 and Deliverable 6.
 */

import { useEffect, useRef, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  useApp,
  useSetForecast,
  useSetLoadingState,
  useUpdateAlertLog,
} from '../context/AppContext';
import { loadTier1Forecasts } from '../lib/dataLoader.js';
import { checkPowderAlerts } from '../lib/alerts.js';
import { getSnowQuality, getSnowAgeHours } from '../lib/snowQuality.js';
import { getCurrentHourIndex } from '../lib/utils.js';
import ResortCard from '../components/ResortCard.jsx';
import SearchResults from '../components/SearchResults.jsx';

// ── Sort options (SPEC.md section 8.1) ────────────────────────────────────────
const SORT_OPTIONS = [
  { value: 'snow24',  label: 'Next 24hr snow' },
  { value: 'snow48',  label: 'Next 48hr snow' },
  { value: 'snow7d',  label: 'Next 7-day total' },
  { value: 'quality', label: 'Snow quality' },
  { value: 'alpha',   label: 'Alphabetical' },
];

// Country codes that get their own filter bucket; everything else → 'SA'
const KNOWN_COUNTRIES = ['US', 'CA', 'MX'];

function resortCountryBucket(country) {
  return KNOWN_COUNTRIES.includes(country) ? country : 'SA';
}

// ── Sort helpers ──────────────────────────────────────────────────────────────

function getDailySnow(forecast, dayIndex) {
  return forecast?.daily?.snowfall_sum?.[dayIndex] ?? 0;
}

function get7DaySnow(forecast) {
  return (
    forecast?.daily?.snowfall_sum?.slice(0, 7).reduce((a, b) => a + b, 0) ?? 0
  );
}

function getQualityPriority(resort, forecasts) {
  const forecast = forecasts[resort.id];
  if (!forecast) return 999;
  try {
    const idx = getCurrentHourIndex(forecast.hourly.time, forecast.timezone);
    const q = getSnowQuality({
      temp_c:       forecast.hourly.temperature_2m[idx] ?? 0,
      wind_kmh:     forecast.hourly.windspeed_10m[idx]  ?? 0,
      snowfall_cm:  forecast.hourly.snowfall[idx]       ?? 0,
      snowAgeHours: getSnowAgeHours(forecast.hourly.snowfall, idx),
      humidity_pct: forecast.hourly.relativehumidity_2m[idx] ?? 50,
    });
    return q.priority;
  } catch {
    return 999;
  }
}

// ── Filter dropdown (multi-select checkboxes) ─────────────────────────────────

function FilterDropdown({ label, options, selected, onToggle, onClear }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const activeCount = selected.size;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '6px 12px',
          borderRadius: 6,
          border: '1px solid var(--color-bg-card-hover)',
          backgroundColor:
            activeCount > 0 ? 'var(--color-accent)' : 'var(--color-bg-card)',
          color:
            activeCount > 0
              ? 'var(--color-bg-dark)'
              : 'var(--color-text-secondary)',
          fontSize: 13,
          cursor: 'pointer',
          fontWeight: activeCount > 0 ? 600 : 400,
        }}
      >
        {label}
        {activeCount > 0 && ` (${activeCount})`}
        {' ▾'}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            backgroundColor: '#0F172A',
            border: '1px solid var(--color-bg-card-hover)',
            borderRadius: 8,
            padding: '6px 0',
            zIndex: 50,
            minWidth: 170,
            maxHeight: 300,
            overflowY: 'auto',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          }}
        >
          {options.map((opt) => (
            <label
              key={opt.value}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 14px',
                cursor: 'pointer',
                fontSize: 13,
                color: selected.has(opt.value)
                  ? 'var(--color-text-primary)'
                  : 'var(--color-text-secondary)',
              }}
            >
              <input
                type="checkbox"
                checked={selected.has(opt.value)}
                onChange={() => onToggle(opt.value)}
                style={{ accentColor: 'var(--color-accent)' }}
              />
              {opt.label}
            </label>
          ))}
          {activeCount > 0 && (
            <button
              onClick={() => {
                onClear();
                setOpen(false);
              }}
              style={{
                display: 'block',
                width: '100%',
                padding: '6px 14px',
                textAlign: 'left',
                background: 'none',
                border: 'none',
                borderTop: '1px solid var(--color-bg-card-hover)',
                marginTop: 4,
                cursor: 'pointer',
                fontSize: 12,
                color: 'var(--color-text-secondary)',
              }}
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { resorts, forecasts, loadingStates, settings, alertLog, user, savedSlugs } = useApp();
  const setForecast      = useSetForecast();
  const setLoadingState  = useSetLoadingState();
  const updateAlertLog   = useUpdateAlertLog();

  // Toggle state for My Resorts vs All Resorts (default to My Resorts if logged in)
  const [showMyResorts, setShowMyResorts] = useState(!!user);

  // Stable refs so in-flight batch callbacks always dispatch to current functions
  const setForecastRef     = useRef(setForecast);
  const setLoadingStateRef = useRef(setLoadingState);
  useEffect(() => { setForecastRef.current = setForecast; },      [setForecast]);
  useEffect(() => { setLoadingStateRef.current = setLoadingState; }, [setLoadingState]);

  // Refs to always read the latest context values inside the once-on-mount effect
  const forecastsRef     = useRef(forecasts);
  const settingsRef      = useRef(settings);
  const alertLogRef      = useRef(alertLog);
  const updateAlertLogRef = useRef(updateAlertLog);
  useEffect(() => { forecastsRef.current = forecasts; },         [forecasts]);
  useEffect(() => { settingsRef.current = settings; },           [settings]);
  useEffect(() => { alertLogRef.current = alertLog; },           [alertLog]);
  useEffect(() => { updateAlertLogRef.current = updateAlertLog; }, [updateAlertLog]);

  // ── Kick off batch loading once on mount ───────────────────────────────────
  const loadStarted = useRef(false);
  useEffect(() => {
    if (loadStarted.current) return;
    loadStarted.current = true;

    // Mark all tier1 resorts idle immediately so skeletons render right away
    resorts
      .filter((r) => r.tier === 1)
      .forEach((r) => setLoadingStateRef.current(r.id, 'idle'));

    loadTier1Forecasts(
      resorts,
      (id, data)   => setForecastRef.current(id, data),
      (id, status) => setLoadingStateRef.current(id, status)
    ).then(() => {
      // After all tier 1 forecasts have loaded, run the powder alert check.
      // Use refs to access the latest state values (the closure captures the
      // initial empty forecasts/settings/alertLog from mount time).
      const updatedLog = checkPowderAlerts({
        resorts: resorts.filter((r) => r.tier === 1),
        forecasts: forecastsRef.current,
        thresholds: settingsRef.current.thresholds,
        defaultThreshold: settingsRef.current.defaultThreshold,
        alertLog: alertLogRef.current,
        onAlertFired: (resort, snowfall_in) => {
          console.log(`🔔 Alert fired: ${resort.name} — ${snowfall_in}"`);
        },
      });
      Object.entries(updatedLog).forEach(([id, ts]) =>
        updateAlertLogRef.current(id, ts)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [sortBy,            setSortBy]            = useState('snow24');
  const [selectedCountries, setSelectedCountries] = useState(new Set());
  const [selectedRegions,   setSelectedRegions]   = useState(new Set());
  const [searchQuery,       setSearchQuery]       = useState('');
  const [searchOpen,        setSearchOpen]        = useState(false);

  // ── Search mode: true when query has non-whitespace content ───────────────
  const isSearching = searchQuery.trim().length > 0;

  // ── Escape key clears search ────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setSearchQuery('');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ── Full-resort search results (all tiers, name + region match) ────────────
  const searchResults = isSearching
    ? resorts.filter((r) => {
        const q = searchQuery.toLowerCase();
        return (
          r.name.toLowerCase().includes(q) ||
          (r.region ?? '').toLowerCase().includes(q)
        );
      })
    : [];

  // ── Derived data ───────────────────────────────────────────────────────────
  const tier1 = useMemo(() => resorts.filter((r) => r.tier === 1), [resorts]);

  const tier1Total = tier1.length;

  const loadedCount = useMemo(
    () =>
      tier1.filter(
        (r) =>
          loadingStates[r.id] === 'done' || loadingStates[r.id] === 'error'
      ).length,
    [tier1, loadingStates]
  );

  const progress  = tier1Total > 0 ? (loadedCount / tier1Total) * 100 : 0;
  const allLoaded = loadedCount === tier1Total && tier1Total > 0;

  // Global max snowfall — shared scale so all bars are comparable (SPEC.md Deliverable 6)
  const globalMaxSnow = useMemo(() => {
    const allValues = Object.values(forecasts)
      .filter((f) => f?.daily?.snowfall_sum)
      .flatMap((f) => f.daily.snowfall_sum);
    return allValues.length > 0 ? Math.max(...allValues, 0) : 1;
  }, [forecasts]);

  // Country and region filter options
  const countryOptions = [
    { value: 'US', label: 'United States' },
    { value: 'CA', label: 'Canada' },
    { value: 'MX', label: 'Mexico' },
    { value: 'SA', label: 'South America' },
  ];

  const regionOptions = useMemo(() => {
    const seen = new Set();
    return tier1
      .filter((r) => r.region && !seen.has(r.region) && seen.add(r.region))
      .map((r) => ({ value: r.region, label: r.region }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [tier1]);

  // ── Filter (Tier 1 card grid only — search uses its own results path) ──────
  const filteredResorts = useMemo(() => {
    let list = tier1;

    if (selectedCountries.size > 0) {
      list = list.filter((r) =>
        selectedCountries.has(resortCountryBucket(r.country))
      );
    }
    if (selectedRegions.size > 0) {
      list = list.filter((r) => selectedRegions.has(r.region));
    }

    return list;
  }, [tier1, selectedCountries, selectedRegions]);

  // ── Sort: loaded resorts sorted by criteria; loading ones at end ───────────
  const sortedResorts = useMemo(() => {
    const loaded  = filteredResorts.filter(
      (r) =>
        loadingStates[r.id] === 'done' || loadingStates[r.id] === 'error'
    );
    const loading = filteredResorts.filter(
      (r) =>
        loadingStates[r.id] !== 'done' && loadingStates[r.id] !== 'error'
    );

    const sorted = [...loaded].sort((a, b) => {
      const fa = forecasts[a.id];
      const fb = forecasts[b.id];

      switch (sortBy) {
        case 'snow24':
          return getDailySnow(fb, 0) - getDailySnow(fa, 0);
        case 'snow48':
          return (
            getDailySnow(fb, 0) + getDailySnow(fb, 1) -
            (getDailySnow(fa, 0) + getDailySnow(fa, 1))
          );
        case 'snow7d':
          return get7DaySnow(fb) - get7DaySnow(fa);
        case 'quality':
          return (
            getQualityPriority(a, forecasts) -
            getQualityPriority(b, forecasts)
          );
        case 'alpha':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

    return [...sorted, ...loading];
  }, [filteredResorts, loadingStates, forecasts, sortBy]);

  // ── Toggle My Resorts vs All Resorts ───────────────────────────────────────
  const displayedResorts = useMemo(() => {
    if (showMyResorts && user) {
      // Show only saved resorts
      return sortedResorts.filter(r => savedSlugs.includes(r.slug));
    }
    return sortedResorts;
  }, [sortedResorts, showMyResorts, user, savedSlugs]);

  // ── Toggle helpers ─────────────────────────────────────────────────────────
  function toggleCountry(code) {
    setSelectedCountries((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  }
  function toggleRegion(region) {
    setSelectedRegions((prev) => {
      const next = new Set(prev);
      next.has(region) ? next.delete(region) : next.add(region);
      return next;
    });
  }
  function resetFilters() {
    setSelectedCountries(new Set());
    setSelectedRegions(new Set());
    setSearchQuery('');
    setSearchOpen(false);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', paddingBottom: 40 }}>

      {/* ── Progress bar — thin line just below the fixed top nav ─────────── */}
      {!allLoaded && (
        <div
          style={{
            position: 'fixed',
            top: 60,
            left: 0,
            right: 0,
            height: 3,
            zIndex: 40,
            backgroundColor: 'var(--color-bg-card)',
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              backgroundColor: 'var(--color-accent)',
              transition: 'width 0.4s ease',
            }}
          />
        </div>
      )}

      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
          padding: '12px 16px',
          borderBottom: '1px solid var(--color-bg-card)',
        }}
      >
        {/* Sort */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
            Sort
          </span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid var(--color-bg-card-hover)',
              backgroundColor: 'var(--color-bg-card)',
              color: 'var(--color-text-primary)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Country filter */}
        <FilterDropdown
          label="Country"
          options={countryOptions}
          selected={selectedCountries}
          onToggle={toggleCountry}
          onClear={() => setSelectedCountries(new Set())}
        />

        {/* Region filter */}
        <FilterDropdown
          label="Region"
          options={regionOptions}
          selected={selectedRegions}
          onToggle={toggleRegion}
          onClear={() => setSelectedRegions(new Set())}
        />

        {/* Search icon / input */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
          {searchOpen ? (
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onBlur={() => {
                if (!searchQuery) setSearchOpen(false);
              }}
              placeholder="Search all resorts…"
              style={{
                padding: '6px 10px',
                borderRadius: 6,
                border: '1px solid var(--color-bg-card-hover)',
                backgroundColor: 'var(--color-bg-card)',
                color: 'var(--color-text-primary)',
                fontSize: 13,
                outline: 'none',
                width: 180,
              }}
            />
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Open search"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 18,
                color: 'var(--color-text-secondary)',
                padding: '4px 6px',
              }}
            >
              🔍
            </button>
          )}
        </div>

        {/* Loading progress counter */}
        {!allLoaded && (
          <span
            style={{
              fontSize: 11,
              color: 'var(--color-text-secondary)',
              whiteSpace: 'nowrap',
            }}
          >
            {loadedCount} / {tier1Total} loaded
          </span>
        )}
      </div>

      {/* ── My Resorts / All Resorts Toggle (logged-in users only) ───────── */}
      {user && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: '12px 16px',
            borderBottom: '1px solid var(--color-bg-card)',
          }}
        >
          <button
            onClick={() => setShowMyResorts(true)}
            style={{
              padding: '6px 16px',
              borderRadius: 9999,
              border: 'none',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              backgroundColor: showMyResorts ? 'var(--color-accent)' : 'var(--color-bg-card)',
              color: showMyResorts ? 'var(--color-bg-dark)' : 'var(--color-text-secondary)',
            }}
          >
            My Resorts ({savedSlugs.length})
          </button>
          <button
            onClick={() => setShowMyResorts(false)}
            style={{
              padding: '6px 16px',
              borderRadius: 9999,
              border: 'none',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              backgroundColor: !showMyResorts ? 'var(--color-accent)' : 'var(--color-bg-card)',
              color: !showMyResorts ? 'var(--color-bg-dark)' : 'var(--color-text-secondary)',
            }}
          >
            All Resorts
          </button>
        </div>
      )}

      {/* ── Guest prompt (logged-out users only) ───────────────────────────── */}
      {!user && (
        <div
          style={{
            padding: '10px 16px',
            textAlign: 'center',
            fontSize: 13,
            color: 'var(--color-text-secondary)',
            borderBottom: '1px solid var(--color-bg-card)',
          }}
        >
          <Link
            to="/login"
            style={{ color: 'var(--color-accent)', textDecoration: 'none' }}
          >
            Log in
          </Link>{' '}
          to save your favorite resorts
        </div>
      )}

      {/* ── Search results: shown instead of card grid when query is active ── */}
      {isSearching ? (
        <SearchResults
          results={searchResults}
          forecasts={forecasts}
          query={searchQuery}
        />
      ) : (
        <>
          {/* ── Empty state for My Resorts when no saved resorts ─────────── */}
          {user && showMyResorts && displayedResorts.length === 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '60px 24px',
                textAlign: 'center',
              }}
            >
              <p
                style={{
                  fontSize: 16,
                  color: 'var(--color-text-secondary)',
                  marginBottom: 16,
                }}
              >
                You haven't saved any resorts yet.
              </p>
              <button
                onClick={() => setShowMyResorts(false)}
                style={{
                  padding: '8px 20px',
                  borderRadius: 6,
                  border: 'none',
                  backgroundColor: 'var(--color-accent)',
                  color: 'var(--color-bg-dark)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Browse All Resorts
              </button>
            </div>
          )}

          {/* ── Empty state (filters only, not search) ───────────────────── */}
          {!user || !showMyResorts ? (
            displayedResorts.length === 0 &&
            (selectedCountries.size > 0 || selectedRegions.size > 0) && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '60px 24px',
                  textAlign: 'center',
                }}
              >
                <p
                  style={{
                    fontSize: 16,
                    color: 'var(--color-text-secondary)',
                    marginBottom: 16,
                  }}
                >
                  No resorts match your filters.
                </p>
                <button
                  onClick={resetFilters}
                  style={{
                    padding: '8px 20px',
                    borderRadius: 6,
                    border: 'none',
                    backgroundColor: 'var(--color-accent)',
                    color: 'var(--color-bg-dark)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Reset filters
                </button>
              </div>
            )
          ) : null}

          {/* ── Responsive card grid (Tier 1 only) ──────────────────────── */}
          {!(user && showMyResorts && displayedResorts.length === 0) && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(285px, 1fr))',
                gap: 16,
                padding: '16px 16px 0',
              }}
            >
              {displayedResorts.map((resort) => (
                <ResortCard
                  key={resort.id}
                  resort={resort}
                  forecast={forecasts[resort.id] ?? null}
                  loading={loadingStates[resort.id] ?? 'idle'}
                  maxValue_cm={globalMaxSnow}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
