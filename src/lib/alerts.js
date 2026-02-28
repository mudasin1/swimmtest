/**
 * src/lib/alerts.js
 *
 * Powder alert system — browser Notification API integration.
 * Conforms to SPEC.md section 6 and Agent 6 deliverable specification.
 *
 * Architecture: in-session polling (no Service Worker).
 * Does NOT modify context directly — returns updated alertLog for caller to persist.
 */

import { CM_TO_INCHES } from './utils.js';

// 6-hour cooldown — prevents re-alerting same resort within a session
const ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000;

// ── Permission helpers ────────────────────────────────────────────────────────

/**
 * Requests browser notification permission.
 * Returns the permission string: 'granted' | 'denied' | 'default'
 * If Notification API not available: returns 'denied'
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'denied';
  return await Notification.requestPermission();
}

/**
 * Returns current permission state without prompting.
 * Returns: 'granted' | 'denied' | 'default' | 'unsupported'
 */
export function getNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

// ── Notification payload ──────────────────────────────────────────────────────

/**
 * Formats the notification payload for a single resort.
 * Returns { title, body, icon }
 *
 * @param {object} resort       Resort object from resorts.json
 * @param {string} snowfall_in  Snowfall amount as formatted string (e.g. "7.8")
 * @returns {{ title: string, body: string, icon: string }}
 */
export function buildNotificationPayload(resort, snowfall_in) {
  return {
    title: `❄️ Powder Alert: ${resort.name}`,
    body: `${snowfall_in}" forecast in the next 48 hours — ${resort.region}`,
    icon: '/snow-icon.png',
  };
}

// ── Core alert check ──────────────────────────────────────────────────────────

/**
 * Runs the powder alert check against all provided resorts.
 *
 * For each resort:
 *   1. Gets its threshold (from thresholds[resort.id] ?? defaultThreshold)
 *   2. Checks daily.snowfall_sum[0] and [1] (next 48hrs)
 *   3. If max >= threshold AND last alert > ALERT_COOLDOWN_MS ago:
 *      - Fires a browser Notification
 *      - Records timestamp in updatedLog
 *      - Calls onAlertFired(resort, snowfall_in) if provided
 *
 * Does NOT modify context directly.
 * Returns the full updated alertLog (merge of existing + new timestamps).
 * Does NOT throw — all errors are logged and skipped.
 *
 * @param {object} params
 * @param {object[]} params.resorts            Resorts to check
 * @param {Record<string,object>} params.forecasts     resortId → forecast data
 * @param {Record<string,number>} params.thresholds    Per-resort threshold overrides (cm)
 * @param {number} params.defaultThreshold             Global default threshold (cm)
 * @param {Record<string,number>} params.alertLog      resortId → last alert timestamp
 * @param {Function} [params.onAlertFired]             Optional callback: (resort, snowfall_in) => void
 * @returns {Record<string,number>}  Updated alertLog with any new timestamps merged in
 */
export function checkPowderAlerts({
  resorts,
  forecasts,
  thresholds,
  defaultThreshold,
  alertLog,
  onAlertFired,
}) {
  // Start with a copy of the existing log so we always return the full merged object
  const updatedLog = { ...(alertLog ?? {}) };

  // Nothing to do if notifications are not available or not granted
  if (!('Notification' in globalThis) || Notification.permission !== 'granted') {
    return updatedLog;
  }

  for (const resort of (resorts ?? [])) {
    try {
      // Skip resorts with no forecast loaded yet
      const forecast = (forecasts ?? {})[resort.id];
      if (!forecast) continue;

      // Per-resort override takes priority; fall back to global default
      const threshold =
        (thresholds ?? {})[resort.id] !== undefined
          ? (thresholds ?? {})[resort.id]
          : (defaultThreshold ?? 15.24);

      // Next 48 hrs — slice handles arrays shorter than 2 elements gracefully
      const next2Days = forecast.daily?.snowfall_sum?.slice(0, 2) ?? [];
      if (next2Days.length === 0) continue;

      const maxSnow = Math.max(...next2Days);
      const lastAlerted = (alertLog ?? {})[resort.id] ?? 0;

      if (maxSnow >= threshold && Date.now() - lastAlerted > ALERT_COOLDOWN_MS) {
        const snowfall_in = (maxSnow * CM_TO_INCHES).toFixed(1);
        const payload = buildNotificationPayload(resort, snowfall_in);

        // Fire the notification — catch browser-level failures gracefully
        try {
          new Notification(payload.title, {
            body: payload.body,
            icon: payload.icon,
          });
        } catch (notifErr) {
          console.error('[SnowDesk] Notification constructor failed:', notifErr);
        }

        // Record the timestamp in the returned log
        updatedLog[resort.id] = Date.now();

        // Invoke optional callback
        if (typeof onAlertFired === 'function') {
          try {
            onAlertFired(resort, snowfall_in);
          } catch (cbErr) {
            console.error('[SnowDesk] onAlertFired callback error:', cbErr);
          }
        }
      }
    } catch (err) {
      console.error(`[SnowDesk] Alert check error for resort "${resort?.id}":`, err);
    }
  }

  return updatedLog;
}
