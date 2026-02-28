/**
 * src/lib/__tests__/snowQuality.test.js
 *
 * Unit tests for the snow quality algorithm (SPEC.md section 4).
 * Covers all 7 quality labels, getSnowAgeHours edge cases, and getBestWindow.
 */

import { getSnowQuality, getSnowAgeHours, getBestWindow } from '../snowQuality.js';

// ── getSnowQuality — all 7 branches ──────────────────────────────────────────

describe('getSnowQuality', () => {
  test('Powder — active snowfall, cold, wind < 40 km/h', () => {
    // Triggers: snowfall_cm > 0.5 && temp_c < -2 && wind_kmh < 40
    const result = getSnowQuality({
      temp_c: -8,
      wind_kmh: 20,
      snowfall_cm: 1.2,
      snowAgeHours: 1,
      humidity_pct: 75,
    });
    expect(result.label).toBe('Powder');
    expect(result.color).toBe('#1E90FF');
    expect(result.bgColor).toBe('#E8F4FD');
    expect(result.priority).toBe(1);
  });

  test('Wind Affected — snowfall present but wind >= 40 km/h', () => {
    // Triggers: snowfall_cm > 0.2 && wind_kmh >= 40
    const result = getSnowQuality({
      temp_c: -5,
      wind_kmh: 55,
      snowfall_cm: 0.5,
      snowAgeHours: 2,
      humidity_pct: 80,
    });
    expect(result.label).toBe('Wind Affected');
    expect(result.color).toBe('#F97316');
    expect(result.priority).toBe(2);
  });

  test('Packed Powder — recent snow (≤ 12 hrs), cold, dry', () => {
    // Triggers: snowAgeHours <= 12 && temp_c < -5 && humidity_pct < 70
    // Not Powder (snowfall_cm = 0), not Wind Affected (snowfall <= 0.2)
    const result = getSnowQuality({
      temp_c: -8,
      wind_kmh: 15,
      snowfall_cm: 0,
      snowAgeHours: 6,
      humidity_pct: 60,
    });
    expect(result.label).toBe('Packed Powder');
    expect(result.color).toBe('#38BDF8');
    expect(result.priority).toBe(3);
  });

  test('Soft — recent snow (≤ 24 hrs), temp between -5 °C and 2 °C', () => {
    // Triggers: snowAgeHours <= 24 && temp_c >= -5 && temp_c < 2
    const result = getSnowQuality({
      temp_c: -2,
      wind_kmh: 10,
      snowfall_cm: 0,
      snowAgeHours: 18,
      humidity_pct: 75,
    });
    expect(result.label).toBe('Soft');
    expect(result.color).toBe('#4ADE80');
    expect(result.priority).toBe(4);
  });

  test('Spring/Corn — warm temp (≥ 2 °C)', () => {
    // Acceptance criteria case: temp_c: 4, wind_kmh: 10, snowfall_cm: 0,
    //   snowAgeHours: 48, humidity_pct: 60
    const result = getSnowQuality({
      temp_c: 4,
      wind_kmh: 10,
      snowfall_cm: 0,
      snowAgeHours: 48,
      humidity_pct: 60,
    });
    expect(result.label).toBe('Spring/Corn');
    expect(result.color).toBe('#FBBF24');
    expect(result.priority).toBe(5);
  });

  test('Icy — old snow (> 24 hrs), below freezing', () => {
    // Triggers: snowAgeHours > 24 && temp_c < -2
    // Not Spring/Corn (temp < 2), not Soft (snowAgeHours > 24)
    const result = getSnowQuality({
      temp_c: -8,
      wind_kmh: 10,
      snowfall_cm: 0,
      snowAgeHours: 48,
      humidity_pct: 80,
    });
    expect(result.label).toBe('Icy');
    expect(result.color).toBe('#EF4444');
    expect(result.priority).toBe(6);
  });

  test('Variable — fallback when no other branch matches', () => {
    // Must avoid all 6 specific branches:
    //   Not Powder:       snowfall_cm = 0 (≤ 0.5)
    //   Not Wind Affected: snowfall_cm = 0 (≤ 0.2)
    //   Not Packed Powder: snowAgeHours = 20 (> 12)
    //   Not Soft:         temp_c = -6 (< -5), so -6 >= -5 is false
    //   Not Spring/Corn:  temp_c = -6 (< 2)
    //   Not Icy:          snowAgeHours = 20 (≤ 24), so snowAgeHours > 24 is false
    const result = getSnowQuality({
      temp_c: -6,
      wind_kmh: 10,
      snowfall_cm: 0,
      snowAgeHours: 20,
      humidity_pct: 75,
    });
    expect(result.label).toBe('Variable');
    expect(result.color).toBe('#9CA3AF');
    expect(result.priority).toBe(7);
  });
});

// ── getSnowAgeHours ───────────────────────────────────────────────────────────

describe('getSnowAgeHours', () => {
  test('returns 3 when last qualifying snowfall was 3 hours ago', () => {
    // Index 4 has snowfall > 0.1 cm; currentHourIndex = 7 → gap = 3
    const snowfall = [0, 0, 0, 0, 0.5, 0, 0, 0];
    expect(getSnowAgeHours(snowfall, 7)).toBe(3);
  });

  test('returns 72 (cap) when no qualifying snowfall found in 80-hour window', () => {
    const snowfall = new Array(100).fill(0);
    expect(getSnowAgeHours(snowfall, 80)).toBe(72);
  });

  test('returns 0 when current hour has snowfall', () => {
    const snowfall = [0, 0, 0.8];
    expect(getSnowAgeHours(snowfall, 2)).toBe(0);
  });

  test('returns 72 cap when only snow is beyond 72 hours', () => {
    // Snow at index 0, current index 73 → 73 hours ago → cap at 72
    const snowfall = new Array(74).fill(0);
    snowfall[0] = 1.5;
    expect(getSnowAgeHours(snowfall, 73)).toBe(72);
  });
});

// ── getBestWindow ─────────────────────────────────────────────────────────────

describe('getBestWindow', () => {
  test('picks the day with highest snow, no rain, low wind, cold temp', () => {
    const dailyData = [
      // Day 0: light snow, no rain, moderate wind, cold
      // score = 2*3 - 0*5 - 0 + 5 = 11
      { time: '2026-03-01', snowfall_sum: 2,  rain_sum: 0, windspeed_10m_max: 30, temperature_2m_max: -5 },
      // Day 1: heavy snow, no rain, low wind, very cold — BEST
      // score = 20*3 - 0*5 - 0 + 5 = 65
      { time: '2026-03-02', snowfall_sum: 20, rain_sum: 0, windspeed_10m_max: 20, temperature_2m_max: -8 },
      // Day 2: some snow, rain mix, high wind, warm
      // score = 5*3 - 5*5 - 10 + 0 = -20
      { time: '2026-03-03', snowfall_sum: 5,  rain_sum: 5, windspeed_10m_max: 60, temperature_2m_max: 2  },
    ];

    const result = getBestWindow(dailyData);

    expect(result.index).toBe(1);
    expect(result.date).toBe('2026-03-02');
    expect(result.score).toBe(65);
  });

  test('penalises rain correctly', () => {
    const dailyData = [
      // Day 0: no snow, no rain → score = 0
      { time: '2026-03-01', snowfall_sum: 0, rain_sum: 0, windspeed_10m_max: 10, temperature_2m_max: 5 },
      // Day 1: 10 cm snow but 4 cm rain → score = 10*3 - 4*5 = 10
      { time: '2026-03-02', snowfall_sum: 10, rain_sum: 4, windspeed_10m_max: 10, temperature_2m_max: 5 },
    ];

    const result = getBestWindow(dailyData);
    expect(result.index).toBe(1);
    expect(result.score).toBe(10);
  });
});
