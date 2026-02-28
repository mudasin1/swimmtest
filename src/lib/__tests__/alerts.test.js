/**
 * src/lib/__tests__/alerts.test.js
 *
 * Unit tests for the powder alert system (SPEC.md section 6 / Agent 6 Deliverable 8).
 *
 * Test 1:  fires notification when threshold is met
 * Test 2:  does NOT fire when below threshold
 * Test 3:  cooldown prevents double-firing
 * Test 4:  fires again after cooldown expires
 * Test 5:  missing forecast skipped silently
 * Test 6:  buildNotificationPayload returns correct shape
 * Test 7:  per-resort threshold override respected
 * Test 8:  checkPowderAlerts returns merged alertLog
 */

import {
  checkPowderAlerts,
  buildNotificationPayload,
} from '../alerts.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockResort = {
  id: 'resort-test-001',
  name: 'Test Mountain',
  region: 'Colorado',
  country: 'US',
  tier: 1,
};

const mockResort2 = {
  id: 'resort-test-002',
  name: 'Second Peak',
  region: 'Utah',
  country: 'US',
  tier: 1,
};

/** Builds a minimal forecast object with the given daily snowfall_sum values. */
function makeForecast(snowfall_sum) {
  return {
    daily: {
      snowfall_sum,
      rain_sum: snowfall_sum.map(() => 0),
    },
    hourly: { time: [], snowfall: [] },
  };
}

// ── Mock Notification setup ───────────────────────────────────────────────────

/** Tracks every `new Notification(title, options)` call during a test. */
let notificationInstances = [];

/** Mock Notification class placed on globalThis before each test. */
class MockNotification {
  constructor(title, options) {
    notificationInstances.push({ title, options });
  }
}
MockNotification.permission = 'granted';
MockNotification.requestPermission = () => Promise.resolve('granted');

beforeEach(() => {
  notificationInstances = [];
  MockNotification.permission = 'granted';
  global.Notification = MockNotification;
});

afterEach(() => {
  delete global.Notification;
});

// ── Test 1: fires notification when threshold is met ──────────────────────────

test('Test 1: fires a notification when max snowfall >= threshold (default 15.24 cm)', () => {
  // 20 cm in day 0 — above the default 6" (15.24 cm) threshold
  const forecasts = { [mockResort.id]: makeForecast([20, 0]) };

  checkPowderAlerts({
    resorts: [mockResort],
    forecasts,
    thresholds: {},
    defaultThreshold: 15.24,
    alertLog: {},
  });

  expect(notificationInstances).toHaveLength(1);
  expect(notificationInstances[0].title).toContain('Powder Alert');
  expect(notificationInstances[0].title).toContain('Test Mountain');
  expect(notificationInstances[0].options.body).toContain('"');
});

// ── Test 2: does NOT fire when below threshold ────────────────────────────────

test('Test 2: does NOT fire when max snowfall < threshold', () => {
  // 10 cm and 8 cm — both below 15.24 cm
  const forecasts = { [mockResort.id]: makeForecast([10, 8]) };

  checkPowderAlerts({
    resorts: [mockResort],
    forecasts,
    thresholds: {},
    defaultThreshold: 15.24,
    alertLog: {},
  });

  expect(notificationInstances).toHaveLength(0);
});

// ── Test 3: cooldown prevents double-firing ───────────────────────────────────

test('Test 3: cooldown prevents firing if last alert was < 6 hours ago', () => {
  // snowfall clearly above threshold
  const forecasts = { [mockResort.id]: makeForecast([20, 0]) };
  // last alerted 1 second ago — well within 6-hour cooldown
  const alertLog = { [mockResort.id]: Date.now() - 1000 };

  checkPowderAlerts({
    resorts: [mockResort],
    forecasts,
    thresholds: {},
    defaultThreshold: 15.24,
    alertLog,
  });

  expect(notificationInstances).toHaveLength(0);
});

// ── Test 4: fires again after cooldown expires ────────────────────────────────

test('Test 4: fires again when last alert was > 6 hours ago', () => {
  const forecasts = { [mockResort.id]: makeForecast([20, 0]) };
  // last alerted 7 hours ago — cooldown expired
  const alertLog = { [mockResort.id]: Date.now() - 7 * 60 * 60 * 1000 };

  checkPowderAlerts({
    resorts: [mockResort],
    forecasts,
    thresholds: {},
    defaultThreshold: 15.24,
    alertLog,
  });

  expect(notificationInstances).toHaveLength(1);
});

// ── Test 5: missing forecast skipped silently ─────────────────────────────────

test('Test 5: resorts with no loaded forecast are skipped without errors', () => {
  // Two resorts but only one has forecast data
  const forecasts = { [mockResort.id]: makeForecast([20, 0]) };
  // mockResort2 has no forecast — should be silently skipped

  let threwError = false;
  try {
    checkPowderAlerts({
      resorts: [mockResort, mockResort2],
      forecasts,
      thresholds: {},
      defaultThreshold: 15.24,
      alertLog: {},
    });
  } catch {
    threwError = true;
  }

  expect(threwError).toBe(false);
  // Only the resort with data should have fired
  expect(notificationInstances).toHaveLength(1);
  expect(notificationInstances[0].title).toContain('Test Mountain');
});

// ── Test 6: buildNotificationPayload returns correct shape ────────────────────

test('Test 6: buildNotificationPayload returns title, body, and icon', () => {
  const payload = buildNotificationPayload(mockResort, '7.9');

  expect(payload.title).toContain('❄️ Powder Alert');
  expect(payload.title).toContain('Test Mountain');
  expect(payload.body).toContain('7.9');
  expect(payload.body).toContain('"'); // inch mark
  expect(payload.body).toContain('Colorado');
  expect(payload.icon).toBe('/snow-icon.png');
});

// ── Test 7: per-resort threshold override respected ───────────────────────────

test('Test 7: per-resort threshold override takes priority over defaultThreshold', () => {
  // defaultThreshold = 15.24 cm (6")
  // per-resort override = 25.4 cm (10")
  // snowfall = 20 cm — above default but BELOW the override → should NOT fire
  const forecasts = { [mockResort.id]: makeForecast([20, 0]) };

  checkPowderAlerts({
    resorts: [mockResort],
    forecasts,
    thresholds: { [mockResort.id]: 25.4 }, // 10 inch override
    defaultThreshold: 15.24,
    alertLog: {},
  });

  expect(notificationInstances).toHaveLength(0);
});

// ── Test 8: checkPowderAlerts returns merged alertLog ─────────────────────────

test('Test 8: returns a merged alertLog containing existing entries plus new timestamps', () => {
  const existingTs = Date.now() - ALERT_COOLDOWN_MS * 2; // 12 hours ago → can re-fire

  // Two resorts: resort1 fires, resort2 below threshold
  const forecasts = {
    [mockResort.id]: makeForecast([20, 0]),  // fires
    [mockResort2.id]: makeForecast([5, 5]),  // below threshold — does not fire
  };

  const initialAlertLog = {
    [mockResort.id]:  existingTs,  // old entry — should be overwritten with new timestamp
    [mockResort2.id]: existingTs,  // old entry — should remain unchanged
    'some-other-resort': 12345,    // unrelated entry — should be preserved
  };

  const before = Date.now();

  const returned = checkPowderAlerts({
    resorts: [mockResort, mockResort2],
    forecasts,
    thresholds: {},
    defaultThreshold: 15.24,
    alertLog: initialAlertLog,
  });

  const after = Date.now();

  // resort1 fired → its timestamp should be updated to roughly now
  expect(returned[mockResort.id]).toBeGreaterThanOrEqual(before);
  expect(returned[mockResort.id]).toBeLessThanOrEqual(after);

  // resort2 did NOT fire → its old timestamp preserved
  expect(returned[mockResort2.id]).toBe(existingTs);

  // Unrelated entry preserved
  expect(returned['some-other-resort']).toBe(12345);

  // Notification was fired exactly once
  expect(notificationInstances).toHaveLength(1);
});
