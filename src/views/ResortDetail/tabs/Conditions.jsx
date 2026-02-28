/**
 * src/views/ResortDetail/tabs/Conditions.jsx
 *
 * Current conditions tab for the Resort Detail view.
 * SPEC.md section 8.3, Tab 3.
 *
 * Displays 8 stat cards in a 2×4 or 4×2 grid:
 *   Temperature | Feels Like | Wind | Gusts
 *   Snow Depth  | Humidity   | Cloud Cover | Visibility
 *
 * All values from forecast.hourly at currentHourIndex.
 * Wind direction: degrees → cardinal → arrow emoji.
 * Visibility: not in API response → shown as N/A.
 *
 * Props: { resort, forecast }
 */

import { getCurrentHourIndex, toF, toInches, toMph, degreesToCardinal } from '../../../lib/utils.js';

// Arrow emoji for each cardinal direction
const CARDINAL_ARROWS = {
  N:  '↑',
  NE: '↗',
  E:  '→',
  SE: '↘',
  S:  '↓',
  SW: '↙',
  W:  '←',
  NW: '↖',
};

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }) {
  return (
    <div
      style={{
        padding: '16px 20px',
        borderRadius: 10,
        backgroundColor: 'var(--color-bg-card)',
        border: '1px solid var(--color-bg-card-hover)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minWidth: 0,
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--color-text-secondary)',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 28,
          fontWeight: 700,
          color: accent ? 'var(--color-accent)' : 'var(--color-text-primary)',
          lineHeight: 1.1,
        }}
      >
        {value}
      </span>
      {sub && (
        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
          {sub}
        </span>
      )}
    </div>
  );
}

// ── Conditions ────────────────────────────────────────────────────────────────

export default function Conditions({ resort, forecast }) {
  const idx = getCurrentHourIndex(forecast.hourly.time, forecast.timezone);
  const h   = forecast.hourly;

  // ── Raw values ────────────────────────────────────────────────────────────
  const temp_c        = h.temperature_2m[idx]       ?? 0;
  const feelsLike_c   = h.apparent_temperature[idx]  ?? 0;
  const wind_kmh      = h.windspeed_10m[idx]         ?? 0;
  const gusts_kmh     = h.windgusts_10m[idx]         ?? 0;
  const windDir_deg   = h.winddirection_10m[idx]     ?? 0;
  const snowDepth_cm  = h.snow_depth[idx]            ?? 0;
  const humidity_pct  = h.relativehumidity_2m[idx]   ?? 0;
  const cloudCover    = h.cloudcover[idx]            ?? 0;

  // ── Unit conversions ──────────────────────────────────────────────────────
  const tempF        = Math.round(toF(temp_c));
  const feelsLikeF   = Math.round(toF(feelsLike_c));
  const windMph      = toMph(wind_kmh);
  const gustsMph     = toMph(gusts_kmh);
  const snowDepthIn  = toInches(snowDepth_cm);

  // ── Wind direction ────────────────────────────────────────────────────────
  const cardinal  = degreesToCardinal(windDir_deg);
  const arrow     = CARDINAL_ARROWS[cardinal] ?? '→';

  return (
    <div style={{ padding: '24px 0' }}>

      {/* ── Conditions grid — 4 columns on wider screens, 2 on mobile ─────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: 12,
        }}
      >
        {/* 1. Temperature */}
        <StatCard
          label="Temperature"
          value={`${tempF}°F`}
        />

        {/* 2. Feels Like */}
        <StatCard
          label="Feels Like"
          value={`${feelsLikeF}°F`}
        />

        {/* 3. Wind */}
        <StatCard
          label="Wind"
          value={`${windMph} mph`}
          sub={`${arrow} ${cardinal}`}
        />

        {/* 4. Gusts */}
        <StatCard
          label="Gusts"
          value={`${gustsMph} mph`}
        />

        {/* 5. Snow Depth */}
        <StatCard
          label="Snow Depth"
          value={`${snowDepthIn}"`}
          accent={snowDepthIn >= 100}
        />

        {/* 6. Humidity */}
        <StatCard
          label="Humidity"
          value={`${humidity_pct}%`}
        />

        {/* 7. Cloud Cover */}
        <StatCard
          label="Cloud Cover"
          value={`${cloudCover}%`}
        />

        {/* 8. Visibility — not included in API hourly vars */}
        <StatCard
          label="Visibility"
          value="N/A"
          sub="Not in forecast data"
        />
      </div>

      {/* ── Timestamp note ────────────────────────────────────────────────── */}
      <div
        style={{
          marginTop: 20,
          fontSize: 11,
          color: 'var(--color-text-secondary)',
        }}
      >
        Current conditions at {forecast.hourly.time[idx]?.replace('T', ' ') ?? '—'}{' '}
        ({forecast.timezone})
      </div>
    </div>
  );
}
