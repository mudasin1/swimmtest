/**
 * src/lib/cache.js
 *
 * In-memory caching layer for SnowDesk.
 * Conforms to SPEC.md section 5 (forecast cache) and section 7 (summary cache).
 *
 * No localStorage here — that belongs in the alert system (SPEC.md section 6).
 */

// ── Forecast cache ────────────────────────────────────────────────────────────

const forecastCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Returns cached forecast if still fresh; otherwise calls fetchFn, caches the
 * result, and returns it.
 *
 * @param {string}            resortId  Resort ID (key)
 * @param {() => Promise<*>}  fetchFn   Async function that fetches fresh data
 * @returns {Promise<*>}
 */
export async function getCachedForecast(resortId, fetchFn) {
  const cached = forecastCache.get(resortId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }
  const data = await fetchFn();
  forecastCache.set(resortId, { data, timestamp: Date.now() });
  return data;
}

// ── Summary cache ─────────────────────────────────────────────────────────────

const summaryCache = new Map();

/**
 * Returns cached AI summary for the given resort on today's date.
 * Key format: `resortId_YYYY-MM-DD` — summaries do not need hourly refresh.
 *
 * @param {string}            resortId  Resort ID
 * @param {() => Promise<*>}  fetchFn   Async function that generates a fresh summary
 * @returns {Promise<*>}
 */
export async function getCachedSummary(resortId, fetchFn) {
  const today = new Date().toISOString().split('T')[0];
  const key = `${resortId}_${today}`;
  if (summaryCache.has(key)) return summaryCache.get(key);
  const summary = await fetchFn();
  summaryCache.set(key, summary);
  return summary;
}
