/**
 * src/components/SnowBar.jsx
 *
 * Atomic snowfall bar — used in resort cards and the detail chart.
 * Color logic conforms exactly to SPEC.md section 9.
 *
 * Props:
 *   snowfall_cm  {number}  — determines height and color
 *   rain_cm      {number}  — if > 0 AND snowfall > 0: mixed precip → purple
 *   maxValue_cm  {number}  — scale ceiling for relative height
 *   showLabel    {boolean} — if true, render day label + inch value below bar
 *   date         {string}  — "YYYY-MM-DD", used for day label when showLabel=true
 *   width        {number}  — px width of bar (default 28)
 *   maxHeight    {number}  — px max height of bar (default 80)
 */

import { toInches, getDayLabel, POWDER_THRESHOLD_CM } from '../lib/utils.js';

// Minimum visible height for any non-zero snowfall bar (px)
const MIN_BAR_PX = 4;

/**
 * Derive the bar fill color from snowfall and rain values.
 * Priority order (SPEC.md section 9):
 *   1. rain + snow → mixed (purple)
 *   2. snowfall ≥ POWDER_THRESHOLD_CM → powder (orange)
 *   3. snowfall > 0 → light snow (blue)
 *   4. no snowfall → empty (transparent — background handles it)
 */
function getBarColor(snowfall_cm, rain_cm) {
  if (rain_cm > 0 && snowfall_cm > 0) return 'var(--color-snow-mixed)';
  if (snowfall_cm >= POWDER_THRESHOLD_CM)  return 'var(--color-snow-powder)';
  if (snowfall_cm > 0)                     return 'var(--color-snow-light)';
  return null; // empty — no fill bar needed
}

export default function SnowBar({
  snowfall_cm = 0,
  rain_cm = 0,
  maxValue_cm = 1,
  showLabel = false,
  date,
  width = 28,
  maxHeight = 80,
}) {
  const safeMax = maxValue_cm > 0 ? maxValue_cm : 1;
  const fillColor = getBarColor(snowfall_cm, rain_cm);

  // Proportional height, clamped to [MIN_BAR_PX, maxHeight]
  const fillHeight =
    snowfall_cm > 0
      ? Math.max(MIN_BAR_PX, Math.min((snowfall_cm / safeMax) * maxHeight, maxHeight))
      : 0;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width,
        flexShrink: 0,
      }}
    >
      {/* ── Bar container — always full height so bars align at bottom ── */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: maxHeight,
          backgroundColor: '#1E293B', // SPEC: empty bar dark fill
          borderRadius: 4,
          overflow: 'hidden',
        }}
      >
        {/* ── Colored fill — grows from bottom ── */}
        {fillColor && fillHeight > 0 && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: fillHeight,
              backgroundColor: fillColor,
              borderRadius: 4,
            }}
          />
        )}
      </div>

      {/* ── Labels below bar ── */}
      {showLabel && (
        <div
          style={{
            marginTop: 4,
            textAlign: 'center',
            width: '100%',
            lineHeight: 1.3,
          }}
        >
          {/* Day label */}
          {date && (
            <div
              style={{
                fontSize: 10,
                color: 'var(--color-text-secondary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {getDayLabel(date)}
            </div>
          )}
          {/* Inch value */}
          <div
            style={{
              fontSize: 10,
              color: 'var(--color-text-secondary)',
            }}
          >
            {toInches(snowfall_cm)}&quot;
          </div>
        </div>
      )}
    </div>
  );
}
