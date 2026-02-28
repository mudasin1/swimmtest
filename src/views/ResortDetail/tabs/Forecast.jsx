/**
 * src/views/ResortDetail/tabs/Forecast.jsx
 *
 * Forecast tab for the Resort Detail view.
 * SPEC.md section 8.3, Tab 2.
 *
 * Three sections:
 *   1. 7-Day Recharts bar chart (blue/orange/purple per bar)
 *   2. Daily data table with all forecast variables
 *   3. Hourly accordion — click a day row to expand/collapse hourly breakdown
 *
 * Props: { resort, forecast }
 */

import { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from 'recharts';
import { getBestWindow } from '../../../lib/snowQuality.js';
import {
  getCurrentHourIndex,
  getDayLabel,
  getWeatherInfo,
  toF,
  toInches,
  toMph,
  POWDER_THRESHOLD_CM,
  degreesToCardinal,
} from '../../../lib/utils.js';
import WeatherIcon from '../../../components/WeatherIcon.jsx';
import SnowBar from '../../../components/SnowBar.jsx';

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

/** Per-bar color per SPEC.md section 9 color tokens. */
function getBarColor(snowfall_cm, rain_cm) {
  if (rain_cm > 0 && snowfall_cm > 0) return '#8B5CF6'; // purple — mixed
  if (snowfall_cm >= POWDER_THRESHOLD_CM) return '#F97316'; // orange — ≥ 6"
  if (snowfall_cm > 0)                    return '#3B82F6'; // blue — < 6"
  return '#1E293B'; // empty — dark fill
}

/** Format "2026-02-27T06:00" → "06:00" */
function formatHour(timeStr) {
  return timeStr?.split('T')[1] ?? timeStr ?? '';
}

/**
 * For a given day index, find which hourly array indices are "interesting":
 *   - snowfall > 0.1cm, OR
 *   - within ±3 hours of current time (today only)
 */
function getVisibleHourIndices(forecast, dayIndex, currentHourIndex) {
  const dayStart = dayIndex * 24;
  const isToday  = dayIndex === 0;
  const visible  = [];

  for (let h = dayStart; h < dayStart + 24; h++) {
    if (h >= forecast.hourly.snowfall.length) break;
    const snowfall      = forecast.hourly.snowfall[h] ?? 0;
    const nearCurrentHr = isToday && Math.abs(h - currentHourIndex) <= 3;
    if (snowfall > 0.1 || nearCurrentHr) {
      visible.push(h);
    }
  }
  return visible;
}

// ── Custom Recharts tooltip ───────────────────────────────────────────────────

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg-card)',
        border: '1px solid var(--color-bg-card-hover)',
        borderRadius: 8,
        padding: '10px 14px',
        fontSize: 13,
        color: 'var(--color-text-primary)',
        minWidth: 160,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--color-accent)' }}>
        {d.day}
      </div>
      <div style={{ marginBottom: 4 }}>❄️ Snow: <strong>{d.snowfall_in}&quot;</strong></div>
      {d.rain_in > 0 && (
        <div style={{ marginBottom: 4 }}>🌧️ Rain: <strong>{d.rain_in}&quot;</strong></div>
      )}
      <div style={{ marginBottom: 4 }}>
        🌡️ {d.highF}°F / {d.lowF}°F
      </div>
      <div>💨 Wind: <strong>{d.windMph}mph</strong></div>
    </div>
  );
}

// ── Hourly row ────────────────────────────────────────────────────────────────

function HourlyRow({ hourIndex, forecast, maxHourlySnow }) {
  const h = forecast.hourly;
  const snowfall_cm = h.snowfall[hourIndex]          ?? 0;
  const rain_cm     = h.rain[hourIndex]              ?? 0;
  const temp_c      = h.temperature_2m[hourIndex]    ?? 0;
  const wind_kmh    = h.windspeed_10m[hourIndex]     ?? 0;
  const gusts_kmh   = h.windgusts_10m[hourIndex]     ?? 0;
  const windDir     = h.winddirection_10m[hourIndex] ?? 0;
  const wCode       = h.weathercode[hourIndex]       ?? 0;

  const timeLabel   = formatHour(h.time[hourIndex]);
  const weatherInfo = getWeatherInfo(wCode);
  const tempF       = Math.round(toF(temp_c));
  const windMph     = toMph(wind_kmh);
  const gustsMph    = toMph(gusts_kmh);

  const CARDINAL_ARROWS = { N:'↑', NE:'↗', E:'→', SE:'↘', S:'↓', SW:'↙', W:'←', NW:'↖' };
  const cardinal = degreesToCardinal(windDir);
  const arrow    = CARDINAL_ARROWS[cardinal] ?? '→';

  return (
    <tr
      style={{
        borderBottom: '1px solid rgba(51,65,85,0.4)',
        fontSize: 12,
        color: 'var(--color-text-secondary)',
      }}
    >
      {/* Time */}
      <td style={{ padding: '6px 12px', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
        {timeLabel}
      </td>
      {/* Conditions */}
      <td style={{ padding: '6px 8px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <WeatherIcon code={wCode} size={14} />
          <span style={{ color: 'var(--color-text-primary)' }}>{weatherInfo.label}</span>
        </span>
      </td>
      {/* Snowfall */}
      <td style={{ padding: '6px 8px', color: snowfall_cm > 0.1 ? '#3B82F6' : undefined }}>
        {snowfall_cm > 0 ? `${toInches(snowfall_cm)}"` : '—'}
      </td>
      {/* Temp */}
      <td style={{ padding: '6px 8px', color: 'var(--color-text-primary)' }}>
        {tempF}°F
      </td>
      {/* Wind */}
      <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
        <span style={{ color: 'var(--color-text-primary)' }}>{arrow} {windMph}mph</span>
        {gustsMph > windMph && (
          <span style={{ marginLeft: 4, color: '#F97316' }}>gusts {gustsMph}mph</span>
        )}
      </td>
      {/* Mini bar */}
      <td style={{ padding: '6px 8px' }}>
        <SnowBar
          snowfall_cm={snowfall_cm}
          rain_cm={rain_cm}
          maxValue_cm={Math.max(maxHourlySnow, 1)}
          maxHeight={20}
          width={48}
          showLabel={false}
        />
      </td>
    </tr>
  );
}

// ── Forecast ──────────────────────────────────────────────────────────────────

export default function ForecastTab({ resort, forecast }) {
  const [expandedDay, setExpandedDay] = useState(null);

  const currentHourIndex = getCurrentHourIndex(forecast.hourly.time, forecast.timezone);

  // ── Best window ─────────────────────────────────────────────────────────
  const dailyArr   = buildDailyArray(forecast.daily);
  const bestWindow = getBestWindow(dailyArr);

  // ── Chart data ──────────────────────────────────────────────────────────
  const chartData = useMemo(
    () =>
      forecast.daily.time.slice(0, 7).map((date, i) => ({
        day:          getDayLabel(date),
        snowfall_in:  toInches(forecast.daily.snowfall_sum[i] ?? 0),
        rain_in:      toInches(forecast.daily.rain_sum[i]    ?? 0),
        highF:        Math.round(toF(forecast.daily.temperature_2m_max[i] ?? 0)),
        lowF:         Math.round(toF(forecast.daily.temperature_2m_min[i] ?? 0)),
        windMph:      toMph(forecast.daily.windspeed_10m_max[i] ?? 0),
        rawSnow:      forecast.daily.snowfall_sum[i] ?? 0,
        rawRain:      forecast.daily.rain_sum[i]    ?? 0,
        dayIndex:     i,
      })),
    [forecast]
  );

  // Max hourly snowfall — used to scale mini bars
  const maxHourlySnow = useMemo(
    () => Math.max(...forecast.hourly.snowfall, 0.1),
    [forecast]
  );

  function toggleDay(i) {
    setExpandedDay((prev) => (prev === i ? null : i));
  }

  return (
    <div style={{ padding: '24px 0' }}>

      {/* ── Section 1: 7-Day Bar Chart ──────────────────────────────────── */}
      <div
        style={{
          marginBottom: 32,
          padding: '16px',
          borderRadius: 8,
          backgroundColor: 'var(--color-bg-card)',
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            color: 'var(--color-text-secondary)',
            marginBottom: 16,
          }}
        >
          7-Day Snowfall
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={chartData}
            margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
            barCategoryGap="20%"
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="var(--color-bg-card-hover)"
            />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v) => `${v}"`}
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <Bar dataKey="snowfall_in" radius={[3, 3, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getBarColor(entry.rawSnow, entry.rawRain)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Section 2 & 3: Daily Table + Hourly Accordion ─────────────── */}
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 13,
          }}
        >
          {/* Daily table header */}
          <thead>
            <tr
              style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--color-text-secondary)',
                borderBottom: '1px solid var(--color-bg-card)',
              }}
            >
              {['Day', 'Snow', 'Rain', 'High', 'Low', 'Wind', 'Precip Hrs', 'Cond.'].map(
                (label) => (
                  <th
                    key={label}
                    style={{
                      padding: '8px 10px',
                      textAlign: 'left',
                      whiteSpace: 'nowrap',
                      fontWeight: 600,
                    }}
                  >
                    {label}
                  </th>
                )
              )}
            </tr>
          </thead>

          <tbody>
            {forecast.daily.time.slice(0, 7).map((date, i) => {
              const isBestDay = bestWindow?.index === i;
              const isExpanded = expandedDay === i;

              const snowIn      = toInches(forecast.daily.snowfall_sum[i] ?? 0);
              const rainIn      = toInches(forecast.daily.rain_sum[i]    ?? 0);
              const highF       = Math.round(toF(forecast.daily.temperature_2m_max[i] ?? 0));
              const lowF        = Math.round(toF(forecast.daily.temperature_2m_min[i] ?? 0));
              const windMph     = toMph(forecast.daily.windspeed_10m_max[i] ?? 0);
              const precipHours = forecast.daily.precipitation_hours[i] ?? 0;
              const wCode       = forecast.daily.weathercode[i] ?? 0;
              const dayLabel    = getDayLabel(date);

              // Hourly hours for this day (only the "interesting" ones)
              const visibleHours = getVisibleHourIndices(forecast, i, currentHourIndex);

              return (
                <>
                  {/* ── Daily row ── */}
                  <tr
                    key={date}
                    onClick={() => toggleDay(i)}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor = 'var(--color-bg-card)')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = 'transparent')
                    }
                    style={{
                      cursor: 'pointer',
                      borderBottom: isExpanded
                        ? 'none'
                        : '1px solid var(--color-bg-card)',
                      borderLeft: isBestDay
                        ? '3px solid var(--color-accent)'
                        : '3px solid transparent',
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    {/* Day */}
                    <td style={{ padding: '10px 10px', whiteSpace: 'nowrap', fontWeight: 500 }}>
                      <span style={{ marginRight: 6, fontSize: 12, color: 'var(--color-text-secondary)' }}>
                        {isExpanded ? '▾' : '▸'}
                      </span>
                      {dayLabel}
                    </td>
                    {/* Snow */}
                    <td
                      style={{
                        padding: '10px 10px',
                        color: snowIn >= 6 ? '#F97316' : snowIn > 0 ? '#3B82F6' : 'var(--color-text-secondary)',
                        fontWeight: snowIn >= 6 ? 600 : 400,
                      }}
                    >
                      {snowIn}&quot;
                    </td>
                    {/* Rain */}
                    <td
                      style={{
                        padding: '10px 10px',
                        color: rainIn > 0 ? '#8B5CF6' : 'var(--color-text-secondary)',
                      }}
                    >
                      {rainIn > 0 ? `${rainIn}"` : '—'}
                    </td>
                    {/* High */}
                    <td style={{ padding: '10px 10px' }}>{highF}°F</td>
                    {/* Low */}
                    <td style={{ padding: '10px 10px', color: 'var(--color-text-secondary)' }}>
                      {lowF}°F
                    </td>
                    {/* Wind */}
                    <td style={{ padding: '10px 10px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                      {windMph}mph
                    </td>
                    {/* Precip hours */}
                    <td style={{ padding: '10px 10px', color: 'var(--color-text-secondary)' }}>
                      {precipHours > 0 ? `${precipHours}h` : '—'}
                    </td>
                    {/* Conditions icon */}
                    <td style={{ padding: '10px 10px' }}>
                      <WeatherIcon code={wCode} size={18} />
                    </td>
                  </tr>

                  {/* ── Hourly accordion ── */}
                  {isExpanded && (
                    <tr key={`${date}-hourly`}>
                      <td
                        colSpan={8}
                        style={{
                          padding: 0,
                          borderBottom: '1px solid var(--color-bg-card)',
                        }}
                      >
                        {visibleHours.length === 0 ? (
                          <div
                            style={{
                              padding: '12px 24px',
                              fontSize: 12,
                              color: 'var(--color-text-secondary)',
                              fontStyle: 'italic',
                            }}
                          >
                            No significant snowfall hours for this day.
                          </div>
                        ) : (
                          <table
                            style={{
                              width: '100%',
                              borderCollapse: 'collapse',
                              backgroundColor: 'rgba(15,23,42,0.5)',
                            }}
                          >
                            <tbody>
                              {visibleHours.map((hourIdx) => (
                                <HourlyRow
                                  key={hourIdx}
                                  hourIndex={hourIdx}
                                  forecast={forecast}
                                  maxHourlySnow={maxHourlySnow}
                                />
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
