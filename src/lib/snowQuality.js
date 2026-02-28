/**
 * src/lib/snowQuality.js
 *
 * Snow quality algorithm as defined in SPEC.md section 4.
 * No UI dependencies — pure data logic.
 */

/**
 * Classify snow quality for the current hour.
 *
 * Decision tree is copied verbatim from SPEC.md section 4 — do not reorder
 * the branches without updating the spec first.
 *
 * @param {object} params
 * @param {number} params.temp_c         Current temperature (°C)
 * @param {number} params.wind_kmh       Wind speed (km/h)
 * @param {number} params.snowfall_cm    Hourly snowfall (cm)
 * @param {number} params.snowAgeHours   Hours since last snowfall > 0.1 cm
 * @param {number} params.humidity_pct   Relative humidity (%)
 * @returns {{ label: string, color: string, bgColor: string, emoji: string, priority: number }}
 */
export function getSnowQuality({ temp_c, wind_kmh, snowfall_cm, snowAgeHours, humidity_pct }) {
  // 1. Fresh Powder: active snowfall, cold, manageable wind
  if (snowfall_cm > 0.5 && temp_c < -2 && wind_kmh < 40) {
    return { label: 'Powder', color: '#1E90FF', bgColor: '#E8F4FD', emoji: '❄️', priority: 1 };
  }

  // 2. Wind Affected: fresh snow but blowing
  if (snowfall_cm > 0.2 && wind_kmh >= 40) {
    return { label: 'Wind Affected', color: '#F97316', bgColor: '#FEF3C7', emoji: '💨', priority: 2 };
  }

  // 3. Packed Powder: recent snow (< 12 hrs), cold and dry
  if (snowAgeHours <= 12 && temp_c < -5 && humidity_pct < 70) {
    return { label: 'Packed Powder', color: '#38BDF8', bgColor: '#F0F9FF', emoji: '🎿', priority: 3 };
  }

  // 4. Soft Snow: recent snow, warming
  if (snowAgeHours <= 24 && temp_c >= -5 && temp_c < 2) {
    return { label: 'Soft', color: '#4ADE80', bgColor: '#F0FDF4', emoji: '✨', priority: 4 };
  }

  // 5. Spring / Corn: warm temps
  if (temp_c >= 2) {
    return { label: 'Spring/Corn', color: '#FBBF24', bgColor: '#FFFBEB', emoji: '☀️', priority: 5 };
  }

  // 6. Icy: old snow, refrozen
  if (snowAgeHours > 24 && temp_c < -2) {
    return { label: 'Icy', color: '#EF4444', bgColor: '#FEF2F2', emoji: '🧊', priority: 6 };
  }

  // 7. Fallback
  return { label: 'Variable', color: '#9CA3AF', bgColor: '#F9FAFB', emoji: '🌫️', priority: 7 };
}

/**
 * Determine how many hours ago it last snowed (hourly snowfall > 0.1 cm).
 *
 * Scans backward from currentHourIndex. Returns 0 if it is snowing right now.
 * Caps at 72 if no qualifying snowfall is found within the lookback window.
 *
 * @param {number[]} hourlySnowfall   Array of hourly snowfall values (cm)
 * @param {number}   currentHourIndex Index of the current hour in the array
 * @returns {number} Hours since last snowfall > 0.1 cm, capped at 72
 */
export function getSnowAgeHours(hourlySnowfall, currentHourIndex) {
  for (let i = currentHourIndex; i >= 0; i--) {
    const hoursBack = currentHourIndex - i;
    if (hoursBack > 72) return 72; // cap — stop scanning beyond 72 hours
    if (hourlySnowfall[i] > 0.1) return hoursBack;
  }
  return 72; // no qualifying snowfall found in entire lookback window
}

/**
 * Find the single best 24-hour window in the daily forecast.
 *
 * Scoring formula from SPEC.md section 4:
 *   score = (snowfall_sum * 3) - (rain_sum * 5)
 *           - (windspeed_10m_max > 50 ? 10 : 0)
 *           + (temperature_2m_max < 0 ? 5 : 0)
 *
 * @param {Array<{
 *   time: string,
 *   snowfall_sum: number,
 *   rain_sum: number,
 *   windspeed_10m_max: number,
 *   temperature_2m_max: number
 * }>} dailyData  Array of daily forecast objects
 * @returns {{ index: number, date: string, score: number }}
 */
export function getBestWindow(dailyData) {
  const scored = dailyData.map((day, i) => ({
    index: i,
    date: day.time,
    score:
      day.snowfall_sum * 3
      - day.rain_sum * 5
      - (day.windspeed_10m_max > 50 ? 10 : 0)
      + (day.temperature_2m_max < 0 ? 5 : 0),
  }));

  return scored.sort((a, b) => b.score - a.score)[0];
}
