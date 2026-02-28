/**
 * src/lib/__tests__/aiSummary.test.js
 *
 * Unit tests for buildForecastPayload (SPEC.md section 7 / Agent 5 brief).
 * Does NOT test the API call (generateSummary / getCachedOrFetchSummary).
 *
 * Test 1: Returns correct shape
 * Test 2: Snowfall cm → inches conversion
 * Test 3: Temperature C → F conversion
 * Test 4: condition label comes from getWeatherInfo
 * Test 5: currentDepth_in derived from correct hour index
 */

import { buildForecastPayload } from '../aiSummary.js'

// ── Shared fixtures ───────────────────────────────────────────────────────────

const mockResort = {
  id: 'openstreetmap-way-test123',
  name: 'Test Mountain',
  region: 'Colorado',
  summitElevation: 3500,
}

/**
 * Builds a minimal valid daily block for 7 days.
 * Caller may override individual arrays.
 */
function makeDailyBlock(overrides = {}) {
  return {
    time: [
      '2026-03-01', '2026-03-02', '2026-03-03',
      '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-07',
    ],
    snowfall_sum:       new Array(7).fill(0),
    rain_sum:           new Array(7).fill(0),
    temperature_2m_max: new Array(7).fill(0),
    temperature_2m_min: new Array(7).fill(-5),
    windspeed_10m_max:  new Array(7).fill(20),
    weathercode:        new Array(7).fill(0),
    ...overrides,
  }
}

/**
 * Builds a minimal hourly block with the current UTC hour at the given index.
 *
 * By placing the current UTC hour at `currentIndex`, getCurrentHourIndex()
 * (using timezone 'UTC') will return `currentIndex` — equivalent to mocking
 * it to return that value.
 */
function makeHourlyBlock(currentIndex = 0, snowDepthOverrides = {}) {
  const now = new Date()
  now.setUTCMinutes(0, 0, 0)

  const times = []
  for (let i = 0; i < 10; i++) {
    const d = new Date(now.getTime() + (i - currentIndex) * 3600_000)
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, '0')
    const day = String(d.getUTCDate()).padStart(2, '0')
    const h = String(d.getUTCHours()).padStart(2, '0')
    times.push(`${y}-${m}-${day}T${h}:00`)
  }
  // times[currentIndex] is the current UTC hour → getCurrentHourIndex returns currentIndex

  const snow_depth = new Array(10).fill(0)
  for (const [idx, val] of Object.entries(snowDepthOverrides)) {
    snow_depth[Number(idx)] = val
  }

  return { time: times, snow_depth }
}

// ── Test 1: Correct shape ─────────────────────────────────────────────────────

test('buildForecastPayload returns correct shape with 7 next7Days entries', () => {
  const forecast = {
    timezone: 'UTC',
    hourly: makeHourlyBlock(0),
    daily: makeDailyBlock(),
  }

  const payload = buildForecastPayload(mockResort, forecast)

  // Top-level fields
  expect(payload).toHaveProperty('resortName')
  expect(payload).toHaveProperty('region')
  expect(payload).toHaveProperty('summitElevation_m')
  expect(payload).toHaveProperty('currentDepth_in')
  expect(payload).toHaveProperty('next7Days')

  // Values
  expect(payload.resortName).toBe('Test Mountain')
  expect(payload.region).toBe('Colorado')
  expect(payload.summitElevation_m).toBe(3500)

  // next7Days array
  expect(Array.isArray(payload.next7Days)).toBe(true)
  expect(payload.next7Days).toHaveLength(7)

  // Each entry has all 7 required fields
  payload.next7Days.forEach(d => {
    expect(d).toHaveProperty('date')
    expect(d).toHaveProperty('snowfall_in')
    expect(d).toHaveProperty('rain_in')
    expect(d).toHaveProperty('high_f')
    expect(d).toHaveProperty('low_f')
    expect(d).toHaveProperty('max_wind_mph')
    expect(d).toHaveProperty('condition')
  })
})

// ── Test 2: Snowfall cm → inches ──────────────────────────────────────────────

test('snowfall values are correctly converted from cm to inches', () => {
  // 15.24 cm is exactly 6 inches (POWDER_THRESHOLD_CM)
  const snowfall_sum = [15.24, 0, 0, 0, 0, 0, 0]

  const forecast = {
    timezone: 'UTC',
    hourly: makeHourlyBlock(0),
    daily: makeDailyBlock({ snowfall_sum }),
  }

  const payload = buildForecastPayload(mockResort, forecast)

  // toInches(15.24) = Math.round(15.24 * 0.3937 * 10) / 10
  //                 = Math.round(59.9998...) / 10 = 60 / 10 = 6
  expect(payload.next7Days[0].snowfall_in).toBe(6)
})

// ── Test 3: Temperature C → F ─────────────────────────────────────────────────

test('temperature is correctly converted from Celsius to Fahrenheit', () => {
  // 0 °C → 32 °F (exact, no rounding error)
  const temperature_2m_max = [0, 0, 0, 0, 0, 0, 0]

  const forecast = {
    timezone: 'UTC',
    hourly: makeHourlyBlock(0),
    daily: makeDailyBlock({ temperature_2m_max }),
  }

  const payload = buildForecastPayload(mockResort, forecast)

  // toF(0).toFixed(0) = (0 * 9/5 + 32).toFixed(0) = "32"
  expect(payload.next7Days[0].high_f).toBe('32')
})

// ── Test 4: Condition label from getWeatherInfo ───────────────────────────────

test('condition label is derived from getWeatherInfo for the daily weathercode', () => {
  // WMO code 73 → "Moderate Snow" (SPEC.md section 3)
  const weathercode = [73, 0, 0, 0, 0, 0, 0]

  const forecast = {
    timezone: 'UTC',
    hourly: makeHourlyBlock(0),
    daily: makeDailyBlock({ weathercode }),
  }

  const payload = buildForecastPayload(mockResort, forecast)

  expect(payload.next7Days[0].condition).toBe('Moderate Snow')
})

// ── Test 5: currentDepth_in from correct hour index ───────────────────────────

test('currentDepth_in is derived from the current hour index (index 5)', () => {
  // By placing the current UTC hour at index 5 in the time array,
  // getCurrentHourIndex returns 5 — equivalent to mocking it to return 5.
  const forecast = {
    timezone: 'UTC',
    hourly: makeHourlyBlock(5, { 5: 360 }), // 360 cm at index 5
    daily: makeDailyBlock(),
  }

  const payload = buildForecastPayload(mockResort, forecast)

  // toInches(360) = Math.round(360 * 0.3937 * 10) / 10
  //               = Math.round(1417.32) / 10 = 1417 / 10 = 141.7
  expect(payload.currentDepth_in).toBe(141.7)
})
