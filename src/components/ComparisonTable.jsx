/**
 * src/components/ComparisonTable.jsx
 *
 * Sortable data table showing all loaded resorts side by side.
 * Conforms to SPEC.md section 8.2 and Deliverable 1.
 *
 * Columns (exact order per spec):
 *   Resort | Region | Now | 24hr | 48hr | 7-Day | Quality | Best Day
 *
 * Sorting: click once → asc, again → desc, again → return to default (24hr desc)
 * Mobile (< 768px): hide Region and Best Day columns.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { getSnowQuality, getSnowAgeHours, getBestWindow } from '../lib/snowQuality.js';
import {
  getCurrentHourIndex,
  getDayLabel,
  toF,
  toInches,
  POWDER_THRESHOLD_CM,
} from '../lib/utils.js';
import WeatherIcon from './WeatherIcon.jsx';
import QualityBadge from './QualityBadge.jsx';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Transform flat Open-Meteo daily object → array for getBestWindow(). */
function buildDailyArray(daily, count = 7) {
  return daily.time.slice(0, count).map((date, i) => ({
    time: date,
    snowfall_sum:       daily.snowfall_sum[i]       ?? 0,
    rain_sum:           daily.rain_sum[i]           ?? 0,
    windspeed_10m_max:  daily.windspeed_10m_max[i]  ?? 0,
    temperature_2m_max: daily.temperature_2m_max[i] ?? 0,
  }));
}

/**
 * Cell background tint logic per SPEC.md Deliverable 1.
 * Purple (mixed) overrides all other tints.
 */
function getSnowCellBg(snowfall_cm, rain_cm) {
  if (rain_cm > 0 && snowfall_cm > 0) return 'rgba(139,92,246,0.15)';  // purple — mixed
  if (snowfall_cm >= POWDER_THRESHOLD_CM) return 'rgba(249,115,22,0.15)'; // orange — ≥ 6"
  if (snowfall_cm > 0)                    return 'rgba(59,130,246,0.15)'; // blue  — < 6"
  return 'transparent';
}

// Column definitions — mobileHide = true → hidden on screens < 768px
const COLUMNS = [
  { key: 'name',    label: 'Resort',   mobileHide: false, align: 'left'   },
  { key: 'region',  label: 'Region',   mobileHide: true,  align: 'left'   },
  { key: 'now',     label: 'Now',      mobileHide: false, align: 'center' },
  { key: 'snow24',  label: '24hr',     mobileHide: false, align: 'center' },
  { key: 'snow48',  label: '48hr',     mobileHide: false, align: 'center' },
  { key: 'snow7d',  label: '7-Day',    mobileHide: false, align: 'center' },
  { key: 'quality', label: 'Quality',  mobileHide: false, align: 'center' },
  { key: 'bestDay', label: 'Best Day', mobileHide: true,  align: 'left'   },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function ComparisonTable() {
  const { resorts, forecasts, loadingStates, savedSlugs, settings } = useApp();
  const navigate = useNavigate();

  // ── Sort state ─────────────────────────────────────────────────────────────-
  // sortCol === null means "default" (24hr descending)
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('desc');

  /**
   * Cycle for each column: default → asc → desc → default
   * Clicking a different column always starts at asc.
   */
  function handleHeaderClick(col) {
    if (sortCol !== col) {
      // Different column (including coming from null/default)
      setSortCol(col);
      setSortDir('asc');
    } else {
      // Same column: asc → desc → back to default
      if (sortDir === 'asc') {
        setSortDir('desc');
      } else {
        setSortCol(null);
        setSortDir('desc');
      }
    }
  }

  /** Returns sort indicator arrow for a given column header. */
  function getSortIndicator(col) {
    const isActive = sortCol === col || (sortCol === null && col === 'snow24');
    if (!isActive) return null;
    return <span style={{ marginLeft: 4 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  function isActiveSort(col) {
    return sortCol === col || (sortCol === null && col === 'snow24');
  }

  // ── Resorts to display ─────────────────────────────────────────────────────-
  const visibleResorts = useMemo(() => {
    const tier1 = resorts.filter((r) => r.tier === 1);
    // Tier 2: only include saved resorts that already have a loaded forecast
    const savedTier2 = resorts.filter(
      (r) => r.tier !== 1 && savedSlugs.includes(r.slug) && forecasts[r.id]
    );
    return [...tier1, ...savedTier2];
  }, [resorts, savedSlugs, forecasts]);

  // ── Sorted rows ─────────────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    const effectiveCol = sortCol ?? 'snow24';
    const effectiveDir = sortCol === null ? 'desc' : sortDir;

    // Separate loaded vs still-loading resorts
    const loaded  = visibleResorts.filter((r) => forecasts[r.id]);
    const loading = visibleResorts.filter((r) => !forecasts[r.id]);

    const sortedLoaded = [...loaded].sort((a, b) => {
      const fa = forecasts[a.id];
      const fb = forecasts[b.id];

      switch (effectiveCol) {
        case 'name': {
          const cmp = a.name.localeCompare(b.name);
          return effectiveDir === 'asc' ? cmp : -cmp;
        }
        case 'region': {
          const cmp = (a.region ?? '').localeCompare(b.region ?? '');
          return effectiveDir === 'asc' ? cmp : -cmp;
        }
        case 'now': {
          const ia = getCurrentHourIndex(fa.hourly.time, fa.timezone);
          const ib = getCurrentHourIndex(fb.hourly.time, fb.timezone);
          const va = fa.hourly.temperature_2m[ia] ?? 0;
          const vb = fb.hourly.temperature_2m[ib] ?? 0;
          return effectiveDir === 'asc' ? va - vb : vb - va;
        }
        case 'snow24': {
          const va = fa.daily.snowfall_sum[0] ?? 0;
          const vb = fb.daily.snowfall_sum[0] ?? 0;
          return effectiveDir === 'asc' ? va - vb : vb - va;
        }
        case 'snow48': {
          const va = (fa.daily.snowfall_sum[0] ?? 0) + (fa.daily.snowfall_sum[1] ?? 0);
          const vb = (fb.daily.snowfall_sum[0] ?? 0) + (fb.daily.snowfall_sum[1] ?? 0);
          return effectiveDir === 'asc' ? va - vb : vb - va;
        }
        case 'snow7d': {
          const va = fa.daily.snowfall_sum.slice(0, 7).reduce((s, x) => s + x, 0);
          const vb = fb.daily.snowfall_sum.slice(0, 7).reduce((s, x) => s + x, 0);
          return effectiveDir === 'asc' ? va - vb : vb - va;
        }
        case 'quality': {
          const ia = getCurrentHourIndex(fa.hourly.time, fa.timezone);
          const ib = getCurrentHourIndex(fb.hourly.time, fb.timezone);
          const qa = getSnowQuality({
            temp_c:       fa.hourly.temperature_2m[ia]       ?? 0,
            wind_kmh:     fa.hourly.windspeed_10m[ia]        ?? 0,
            snowfall_cm:  fa.hourly.snowfall[ia]             ?? 0,
            snowAgeHours: getSnowAgeHours(fa.hourly.snowfall, ia),
            humidity_pct: fa.hourly.relativehumidity_2m[ia]  ?? 50,
          });
          const qb = getSnowQuality({
            temp_c:       fb.hourly.temperature_2m[ib]       ?? 0,
            wind_kmh:     fb.hourly.windspeed_10m[ib]        ?? 0,
            snowfall_cm:  fb.hourly.snowfall[ib]             ?? 0,
            snowAgeHours: getSnowAgeHours(fb.hourly.snowfall, ib),
            humidity_pct: fb.hourly.relativehumidity_2m[ib]  ?? 50,
          });
          return effectiveDir === 'asc'
            ? qa.priority - qb.priority
            : qb.priority - qa.priority;
        }
        case 'bestDay': {
          const da = buildDailyArray(fa.daily);
          const db = buildDailyArray(fb.daily);
          const bwa = getBestWindow(da);
          const bwb = getBestWindow(db);
          const va = bwa?.score ?? 0;
          const vb = bwb?.score ?? 0;
          return effectiveDir === 'asc' ? va - vb : vb - va;
        }
        default:
          return 0;
      }
    });

    // Loading resorts come after all loaded ones
    return [...sortedLoaded, ...loading];
  }, [visibleResorts, forecasts, sortCol, sortDir]);

  // ── Render ─────────────────────────────────────────────────────────────────-
  return (
    <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
      <table className="min-w-[640px] w-full border-collapse text-[13px] text-[var(--color-text-primary)]">
        {/* ── Header ── */}
        <thead className="sticky top-0 z-10 bg-[var(--color-bg-dark)]">
          <tr>
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className={`${col.mobileHide ? 'hidden md:table-cell' : ''} px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider cursor-pointer select-none border-b border-[var(--color-bg-card)] whitespace-nowrap ${isActiveSort(col.key) ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-secondary)]'}`}
                style={{ textAlign: col.align }}
                onClick={() => handleHeaderClick(col.key)}
              >
                {col.label}
                {getSortIndicator(col.key)}
              </th>
            ))}
          </tr>
        </thead>

        {/* ── Body ── */}
        <tbody>
          {/* Empty state — shown briefly on first load */}
          {sorted.length === 0 && (
            <tr>
              <td
                colSpan={COLUMNS.length}
                className="text-center py-12 text-[var(--color-text-secondary)] text-sm"
              >
                No forecast data loaded yet
              </td>
            </tr>
          )}

          {sorted.map((resort) => {
            const forecast = forecasts[resort.id];
            const ls = loadingStates[resort.id];
            const isLoading = !forecast;

            // ── Skeleton row for loading resorts ─────────────────────────────
            if (isLoading) {
              return (
                <tr key={resort.id}>
                  <td
                    colSpan={COLUMNS.length}
                    className="px-3 py-2 border-b border-[var(--color-bg-card)]"
                  >
                    <div className="animate-pulse h-6 rounded bg-[var(--color-bg-card)]" />
                  </td>
                </tr>
              );
            }

            // ── Derive row data ─────────────────────────────────────────────--
            const idx = getCurrentHourIndex(forecast.hourly.time, forecast.timezone);
            const currentTemp = forecast.hourly.temperature_2m[idx] ?? 0;
            const tempDisplay = settings.units === 'metric'
              ? `${Math.round(currentTemp)}°C`
              : `${Math.round(toF(currentTemp))}°F`;

            const snow24cm = forecast.daily.snowfall_sum[0] ?? 0;
            const rain24cm = forecast.daily.rain_sum[0]    ?? 0;
            const snow48cm = (forecast.daily.snowfall_sum[0] ?? 0) + (forecast.daily.snowfall_sum[1] ?? 0);
            const rain48cm = (forecast.daily.rain_sum[0] ?? 0) + (forecast.daily.rain_sum[1] ?? 0);

            const snow7dCm  = forecast.daily.snowfall_sum.slice(0, 7).reduce((s, x) => s + x, 0);
            const snow7dIn  = toInches(snow7dCm);

            const quality = getSnowQuality({
              temp_c:       currentTemp,
              wind_kmh:     forecast.hourly.windspeed_10m[idx]       ?? 0,
              snowfall_cm:  forecast.hourly.snowfall[idx]            ?? 0,
              snowAgeHours: getSnowAgeHours(forecast.hourly.snowfall, idx),
              humidity_pct: forecast.hourly.relativehumidity_2m[idx] ?? 50,
            });

            const dailyArr   = buildDailyArray(forecast.daily);
            const bestWindow = getBestWindow(dailyArr);
            const bestDayLabel = bestWindow ? getDayLabel(bestWindow.date) : '—';
            const isBestDayNear = bestDayLabel === 'Today' || bestDayLabel === 'Tomorrow';

            // Now column uses daily weathercode (dominant code for current day)
            const nowWeatherCode = forecast.daily.weathercode[0] ?? 0;

            return (
              <tr
                key={resort.id}
                onClick={() => navigate(`/resort/${resort.slug}`)}
                className="cursor-pointer transition-colors hover:bg-[var(--color-bg-card-hover)] border-b border-[var(--color-bg-card)]"
              >
                {/* Resort name - fixed truncation */}
                <td
                  title={resort.name}
                  className="max-w-[160px] px-3 py-2.5 text-left overflow-hidden text-ellipsis whitespace-nowrap"
                >
                  <span className="font-medium">{resort.name}</span>
                </td>

                {/* Region - hidden on mobile */}
                <td className="hidden md:table-cell px-3 py-2.5 text-left text-[var(--color-text-secondary)]">
                  {resort.region ?? '—'}
                </td>

                {/* Now: weather icon + current temp - SINGLE ICON ONLY */}
                <td className="px-3 py-2.5 text-center">
                  <span className="inline-flex items-center gap-1 justify-center">
                    <WeatherIcon code={nowWeatherCode} size={16} />
                    <span>{tempDisplay}</span>
                  </span>
                </td>

                {/* 24hr snowfall — with cell tint */}
                <td
                  className="px-3 py-2.5 text-center"
                  style={{ backgroundColor: getSnowCellBg(snow24cm, rain24cm) }}
                >
                  {toInches(snow24cm)}&quot;
                </td>

                {/* 48hr snowfall — with cell tint */}
                <td
                  className="px-3 py-2.5 text-center"
                  style={{ backgroundColor: getSnowCellBg(snow48cm, rain48cm) }}
                >
                  {toInches(snow48cm)}&quot;
                </td>

                {/* 7-Day total — bold if ≥ 24" */}
                <td className={`px-3 py-2.5 text-center ${snow7dIn >= 24 ? 'font-bold' : ''}`}>
                  {snow7dIn}&quot;
                </td>

                {/* Quality badge */}
                <td className="px-3 py-2.5 text-center">
                  <QualityBadge quality={quality} size="sm" />
                </td>

                {/* Best Day — accent color if today or tomorrow - hidden on mobile */}
                <td className={`hidden md:table-cell px-3 py-2.5 text-left ${isBestDayNear ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-secondary)]'}`}>
                  {bestDayLabel}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
