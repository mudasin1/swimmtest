/**
 * src/lib/dataLoader.js
 *
 * Batched forecast loading pipeline — powers the Dashboard.
 * Conforms to SPEC.md section 5 (Load Strategy) and Deliverable 1.
 *
 * Does NOT throw — all errors are per-resort and logged to console.
 */

import { getCachedForecast } from './cache.js';
import { fetchForecast } from './openMeteo.js';

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 200;

/**
 * Loads all Tier 1 resort forecasts in batches of 10, staggered 200 ms apart.
 * Populates AppContext progressively as each batch completes.
 *
 * @param {object[]} resorts          Full resort list from resorts.json
 * @param {Function} setForecast      (resortId, data) → void — from useSetForecast()
 * @param {Function} setLoadingState  (resortId, status) → void — from useSetLoadingState()
 */
export async function loadTier1Forecasts(resorts, setForecast, setLoadingState) {
  const tier1 = resorts.filter((r) => r.tier === 1);

  for (let i = 0; i < tier1.length; i += BATCH_SIZE) {
    const batch = tier1.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map((resort) => loadSingleForecast(resort, setForecast, setLoadingState))
    );

    // Stagger batches to avoid hammering the API (SPEC.md section 5)
    if (i + BATCH_SIZE < tier1.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }
}

/**
 * Loads a single resort forecast using the in-memory cache layer.
 * Used by loadTier1Forecasts (above) and by ResortDetail for Tier 2 resorts.
 *
 * On error: sets loadingState to 'error', logs to console, does NOT throw.
 *
 * @param {object}   resort           Resort object from resorts.json
 * @param {Function} setForecast      (resortId, data) → void
 * @param {Function} setLoadingState  (resortId, status) → void
 */
export async function loadSingleForecast(resort, setForecast, setLoadingState) {
  setLoadingState(resort.id, 'loading');
  try {
    const data = await getCachedForecast(resort.id, () => fetchForecast(resort));
    setForecast(resort.id, data);
    setLoadingState(resort.id, 'done');
  } catch (err) {
    console.error(`[SnowDesk] Failed to load forecast for ${resort.name}:`, err);
    setLoadingState(resort.id, 'error');
  }
}
