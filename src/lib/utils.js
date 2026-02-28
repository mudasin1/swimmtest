/**
 * src/lib/utils.js
 *
 * Unit conversion constants and helper functions for SnowDesk.
 * Conforms to SPEC.md sections 3 and 8.
 */

// ── Unit conversion constants (SPEC.md section 3) ────────────────────────────

export const CM_TO_INCHES = 0.3937;
export const POWDER_THRESHOLD_CM = 15.24; // 6 inches
export const KMH_TO_MPH = 0.6214;

// ── Conversion helpers ────────────────────────────────────────────────────────

/** Celsius → Fahrenheit */
export const toF = (c) => (c * 9) / 5 + 32;

/** cm → inches, rounded to 1 decimal place */
export const toInches = (cm) => Math.round(cm * CM_TO_INCHES * 10) / 10;

/** km/h → mph, rounded to 0 decimal places */
export const toMph = (kmh) => Math.round(kmh * KMH_TO_MPH);

// ── WMO weather code lookup (SPEC.md section 3) ───────────────────────────────

const WEATHER_CODES = {
  0:  { label: 'Clear',               icon: '☀️'   },
  1:  { label: 'Mostly Clear',        icon: '🌤️'   },
  2:  { label: 'Partly Cloudy',       icon: '⛅'   },
  3:  { label: 'Overcast',            icon: '☁️'   },
  51: { label: 'Light Drizzle',       icon: '🌦️'   },
  61: { label: 'Light Rain',          icon: '🌧️'   },
  71: { label: 'Light Snow',          icon: '🌨️'   },
  73: { label: 'Moderate Snow',       icon: '❄️'   },
  75: { label: 'Heavy Snow',          icon: '❄️❄️' },
  77: { label: 'Snow Grains',         icon: '🌨️'   },
  85: { label: 'Snow Showers',        icon: '🌨️'   },
  86: { label: 'Heavy Snow Showers',  icon: '❄️❄️' },
};

/**
 * Returns the label and icon for a WMO weather code.
 * Falls back to { label: 'Unknown', icon: '❓' } for unmapped codes.
 *
 * @param {number} code  WMO weather code
 * @returns {{ label: string, icon: string }}
 */
export function getWeatherInfo(code) {
  return WEATHER_CODES[code] ?? { label: 'Unknown', icon: '❓' };
}

// ── Date display helpers ──────────────────────────────────────────────────────

/**
 * Converts a "YYYY-MM-DD" date string to a human-readable label:
 *   - Today's date   → "Today"
 *   - Tomorrow       → "Tomorrow"
 *   - Any other date → short weekday name ("Mon", "Tue", …)
 *
 * Parsing uses local midnight to avoid DST / timezone edge-cases.
 *
 * @param {string} dateStr  ISO date string "YYYY-MM-DD"
 * @returns {string}
 */
export function getDayLabel(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const inputDate = new Date(year, month - 1, day);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (inputDate.getTime() === today.getTime()) return 'Today';
  if (inputDate.getTime() === tomorrow.getTime()) return 'Tomorrow';

  return inputDate.toLocaleDateString('en-US', { weekday: 'short' });
}
