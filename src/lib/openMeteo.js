/**
 * src/lib/openMeteo.js
 *
 * Open-Meteo API calls for SnowDesk.
 * All parameters conform exactly to SPEC.md section 3.
 */

const FORECAST_BASE = 'https://api.open-meteo.com/v1/forecast';
const ARCHIVE_BASE = 'https://archive-api.open-meteo.com/v1/archive';

// Every hourly variable listed in SPEC.md section 3
const HOURLY_VARS = [
  'snowfall',           // cm/hr — primary variable
  'snow_depth',         // cm — current snowpack
  'temperature_2m',     // °C
  'apparent_temperature', // feels-like °C
  'precipitation',      // mm total
  'rain',               // mm rain component (mixed precip detection)
  'weathercode',        // WMO code 0–99
  'windspeed_10m',      // km/h
  'windgusts_10m',      // km/h
  'winddirection_10m',  // degrees
  'cloudcover',         // %
  'relativehumidity_2m', // % — needed for snow quality calc
].join(',');

// Every daily variable listed in SPEC.md section 3
const DAILY_VARS = [
  'snowfall_sum',           // cm total for day — primary card metric
  'rain_sum',               // cm rain (mixed precip detection)
  'precipitation_sum',      // cm total
  'temperature_2m_max',     // °C
  'temperature_2m_min',     // °C
  'windspeed_10m_max',      // km/h
  'windgusts_10m_max',      // km/h
  'precipitation_hours',    // hours of precip
  'weathercode',            // dominant WMO code for the day
].join(',');

/**
 * Fetches a 16-day hourly + daily forecast for a resort.
 * Returns the raw Open-Meteo JSON response — no transformation.
 *
 * CRITICAL: passes elevation = resort.summitElevation for accuracy.
 *
 * @param {object} resort  Resort object from resorts.json
 * @returns {Promise<object>} Raw Open-Meteo forecast response
 */
export async function fetchForecast(resort) {
  const params = new URLSearchParams({
    latitude: resort.lat,
    longitude: resort.lng,
    elevation: resort.summitElevation,
    timezone: 'auto',
    forecast_days: 16,
    hourly: HOURLY_VARS,
    daily: DAILY_VARS,
  });

  const url = `${FORECAST_BASE}?${params}`;

  let response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new Error(`Network error fetching forecast for ${resort.name}: ${err.message}`);
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching forecast for ${resort.name}`);
  }

  return response.json();
}

/**
 * Fetches last 10 days of historical daily data for a resort.
 * Uses archive-api.open-meteo.com (SPEC.md section 3).
 * start_date = today minus 10 days, end_date = yesterday.
 *
 * @param {object} resort  Resort object from resorts.json
 * @returns {Promise<object>} Raw Open-Meteo archive response
 */
export async function fetchHistorical(resort) {
  const now = new Date();

  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() - 1);

  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - 10);

  const fmt = (d) => d.toISOString().split('T')[0];

  const params = new URLSearchParams({
    latitude: resort.lat,
    longitude: resort.lng,
    elevation: resort.summitElevation,
    start_date: fmt(startDate),
    end_date: fmt(endDate),
    daily: 'snowfall_sum,temperature_2m_max,temperature_2m_min',
    timezone: 'auto',
  });

  const url = `${ARCHIVE_BASE}?${params}`;

  let response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new Error(`Network error fetching historical data for ${resort.name}: ${err.message}`);
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching historical data for ${resort.name}`);
  }

  return response.json();
}
