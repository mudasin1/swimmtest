/**
 * src/lib/aiSummary.js
 *
 * Claude API integration for AI-generated snow summaries.
 * Conforms to SPEC.md section 7.
 *
 * Exports:
 *   buildForecastPayload(resort, forecast) → clean payload object
 *   generateSummary(resort, forecast)      → string (API call)
 *   getCachedOrFetchSummary(resort, forecast) → string (cache-aware)
 */

import {
  getCurrentHourIndex,
  toInches,
  toF,
  toMph,
  getDayLabel,
  getWeatherInfo,
} from './utils.js'
import { getCachedSummary } from './cache.js'

// ── System prompt (verbatim from SPEC.md section 7 / Agent 5 brief) ───────────

const SYSTEM_PROMPT = `You are a mountain weather forecaster writing a brief daily snow report for skiers and snowboarders.
Write exactly 3 sentences. Be direct and actionable. Use skier-friendly language — not meteorologist language.
Sentence 1: Describe current or very recent conditions on the mountain right now.
Sentence 2: Identify the single best upcoming window for skiing in the next 7 days and why.
Sentence 3: Name one specific thing to watch out for (wind, rain mix, warming trend, icy conditions, etc).
Do not use bullet points. Do not use headers. Do not use markdown formatting of any kind. Plain prose only.
Never start with the resort name. Never say "I" or "we". Write in present/future tense only.`

// ── buildForecastPayload ───────────────────────────────────────────────────────

/**
 * Builds the forecast payload to send to Claude.
 * Extracts exactly what the prompt needs — not the raw API response.
 *
 * @param {object} resort   Resort object from resorts.json
 * @param {object} forecast Open-Meteo forecast response
 * @returns {{ resortName, region, summitElevation_m, currentDepth_in, next7Days }}
 */
export function buildForecastPayload(resort, forecast) {
  const currentHourIndex = getCurrentHourIndex(
    forecast.hourly.time,
    forecast.timezone
  )
  const currentDepth_in = toInches(
    forecast.hourly.snow_depth[currentHourIndex] ?? 0
  )
  const next7Days = forecast.daily.time.slice(0, 7).map((date, i) => ({
    date: getDayLabel(date),
    snowfall_in: toInches(forecast.daily.snowfall_sum[i] ?? 0),
    rain_in: toInches(forecast.daily.rain_sum[i] ?? 0),
    high_f: toF(forecast.daily.temperature_2m_max[i]).toFixed(0),
    low_f: toF(forecast.daily.temperature_2m_min[i]).toFixed(0),
    max_wind_mph: toMph(forecast.daily.windspeed_10m_max[i]).toFixed(0),
    condition: getWeatherInfo(forecast.daily.weathercode[i]).label,
  }))
  return {
    resortName: resort.name,
    region: resort.region,
    summitElevation_m: resort.summitElevation,
    currentDepth_in,
    next7Days,
  }
}

// ── generateSummary ───────────────────────────────────────────────────────────

/**
 * Calls the Anthropic API with the exact prompt from SPEC section 7.
 * Uses model: "claude-sonnet-4-20250514", max_tokens: 1000.
 * API key from: import.meta.env.VITE_ANTHROPIC_API_KEY
 *
 * @param {object} resort   Resort object
 * @param {object} forecast Open-Meteo forecast response
 * @returns {Promise<string>} The AI-generated summary text
 * @throws {Error} On missing API key, non-200 response, or malformed response
 */
export async function generateSummary(resort, forecast) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY not configured — set VITE_ANTHROPIC_API_KEY in .env'
    )
  }

  const payload = buildForecastPayload(resort, forecast)

  const userMessage =
    `Resort: ${payload.resortName}, ${payload.region}\n` +
    `Summit elevation: ${payload.summitElevation_m}m\n` +
    `Current snow depth at summit: ${payload.currentDepth_in}" \n` +
    `7-day forecast:\n` +
    payload.next7Days
      .map(
        (d) =>
          `${d.date}: ${d.snowfall_in}" snow, ${d.rain_in}" rain, High ${d.high_f}°F / Low ${d.low_f}°F, Wind max ${d.max_wind_mph}mph, Conditions: ${d.condition}`
      )
      .join('\n')

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  if (!response.ok) {
    throw new Error(
      `Claude API error for ${resort.name}: HTTP ${response.status}`
    )
  }

  let data
  try {
    data = await response.json()
  } catch {
    throw new Error(
      `Unexpected Claude API response shape for ${resort.name}`
    )
  }

  if (!data?.content?.[0]?.text) {
    throw new Error(
      `Unexpected Claude API response shape for ${resort.name}`
    )
  }

  return data.content[0].text
}

// ── getCachedOrFetchSummary ───────────────────────────────────────────────────

/**
 * Wrapper that checks the per-resort-per-day cache before calling generateSummary.
 * Cache key format: "{resortId}_{YYYY-MM-DD}" (UTC date, managed by cache.js).
 * Uses getCachedSummary from cache.js.
 *
 * @param {object} resort   Resort object
 * @param {object} forecast Open-Meteo forecast response
 * @returns {Promise<string>} The summary text (cached or freshly generated)
 */
export async function getCachedOrFetchSummary(resort, forecast) {
  return getCachedSummary(resort.id, () => generateSummary(resort, forecast))
}
