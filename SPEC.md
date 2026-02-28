SnowDesk — Personal Snow Forecast App
Master Specification v1.0
0. Project Overview
A personal React web application for ski/snowboard trip planning across major resorts in
North and South America. Inspired by OpenSnow but built for a small friend group with no
backend, no auth, and no subscription gates.
Core value: Wake up, open the tab, instantly know where to ski this weekend.
Stack:
React (Vite)
Tailwind CSS
Open-Meteo API (free, no key, CORS-enabled)
Anthropic Claude API (AI summaries)
Browser Notification API (powder alerts)
OpenSkiMap GeoJSON (resort database)
No backend. Runs entirely in the browser.
1. Feature Scope (v1)
Feature Description
Resort forecasts 7-day hourly + daily forecast per resort via Open-Meteo
Snow quality score Rule-based label derived from temp/wind/snowfall/humidity
Powder alerts Browser notification when any saved resort hits threshold
Multi-resort
comparison AI summaries resort
Resort database Side-by-side table ranked by upcoming snowfall
Claude-generated 3-sentence Daily Snow style narrative per
All major operating downhill resorts in North + South America
Out of scope for v1: maps, webcams, avalanche data, user accounts, trail conditions,
historical lookback UI, mobile app.
2. Resort Database
Source
OpenSkiMap GeoJSON — open data, updated daily, derived from OpenStreetMap.
https://tiles.openskimap.org/ski-areas.geojson
Filtering Criteria
At app build time, pre-filter and bundle as src/data/resorts.json :
// Include if ALL of:
properties.status === "operating"
properties.type === "downhill"
properties.statistics.verticalDrop >= 150 // meters — filters out tubing hills
properties.country in ["US", "CA", "MX", "AR", "CL", "BR", "BO", "PE", "CO"]
properties.name exists and is not empty
Resort JSON Schema (per resort, post-filter)
{
"id": "openstreetmap-way-12345678",
"name": "Vail",
"country": "US",
"region": "Colorado",
"lat": 39.6403,
"lng": -106.3742,
"summitElevation": 3713,
"baseElevation": 2476,
"verticalDrop": 1237,
"website": "https://www.vail.com",
"tier": 1
}
Tiering Strategy
Tier 1 (~100 resorts): Top resorts by vertical drop per country. Pre-fetched on app load.
Tier 2 (remaining ~700): Fetched on-demand when user navigates to resort detail.
Tier 1 threshold: Top 50 US by vertical drop, top 25 CA, top 15 SA, top 10 MX.
3. Open-Meteo API
Forecast Endpoint
GET https://api.open-meteo.com/v1/forecast
Parameters
latitude={resort.lat}
longitude={resort.lng}
elevation={resort.summitElevation} timezone=auto
forecast_days=16
← CRITICAL: always use summit elevation
Hourly Variables
snowfall # cm/hr — primary variable
snow_depth # cm — current snowpack
temperature_2m # °C
apparent_temperature # feels-like °C
precipitation # mm total
rain # mm rain component (mixed precip detection)
weathercode # WMO code 0–99
windspeed_10m # km/h
windgusts_10m # km/h
winddirection_10m # degrees
cloudcover # %
relativehumidity_2m # % — needed for snow quality calc
Daily Variables
snowfall_sum # cm total for day — primary card metric
rain_sum # cm rain (mixed precip detection)
precipitation_sum # cm total
temperature_2m_max # °C
temperature_2m_min # °C
windspeed_10m_max # km/h
windgusts_10m_max # km/h
precipitation_hours # hours of precip
weathercode # dominant WMO code for the day
Historical Endpoint (10-day lookback)
GET https://archive-api.open-meteo.com/v1/archive
?latitude={lat}
&longitude={lng}
&elevation={summitElevation}
&start_date={today - 10 days}
&end_date={today - 1 day}
&daily=snowfall_sum,temperature_2m_max,temperature_2m_min
&timezone=auto
Example Full Forecast Request
https://api.open-meteo.com/v1/forecast
?latitude=39.6403
&longitude=-106.3742
&elevation=3713
&hourly=snowfall,snow_depth,temperature_2m,apparent_temperature,precipitation,rain,weatherc
&daily=snowfall_sum,rain_sum,temperature_2m_max,temperature_2m_min,windspeed_10m_max,windgu
&timezone=auto
&forecast_days=16
Response Shape
{
"latitude": 39.64,
"longitude": -106.37,
"elevation": 3713.0,
"timezone": "America/Denver",
"timezone_abbreviation": "MST",
"hourly": {
"time": ["2026-02-27T00:00", "2026-02-27T01:00"],
"snowfall": [0.0, 0.2],
"snow_depth": [142.0, 143.1],
"temperature_2m": [-8.2, -9.1],
"windspeed_10m": [12.4, 15.2],
"weathercode": [71, 73],
"relativehumidity_2m": [82, 85]
},
"daily": {
"time": ["2026-02-27", "2026-02-28"],
"snowfall_sum": [3.2, 12.4],
"rain_sum": [0.0, 0.0],
"temperature_2m_max": [-2.1, -4.5],
"temperature_2m_min": [-12.4, -14.1],
"windspeed_10m_max": [28.0, 35.2],
"weathercode": [73, 75]
}
}
Unit Conversions
const CM_TO_INCHES = 0.3937
const POWDER_THRESHOLD_CM = 15.24 const KMH_TO_MPH = 0.6214
// 6 inches
// Temperature: C to F
const toF = c => (c * 9/5) + 32
WMO Weather Code Reference (relevant subset)
const WEATHER_CODES = {
0: { label: "Clear", icon: " " },
1: { label: "Mostly Clear", icon: " " },
2: { label: "Partly Cloudy", icon: " " },
3: { label: "Overcast", icon: " " },
51: { label: "Light Drizzle", icon: " " },
61: { label: "Light Rain", icon: " " },
71: { label: "Light Snow", icon: " " },
73: { label: "Moderate Snow", icon: " " },
75: { label: "Heavy Snow", icon: " " },
77: { label: "Snow Grains", icon: " " },
85: { label: "Snow Showers", icon: " " },
86: { label: "Heavy Snow Showers", icon: " }
" },
4. Snow Quality Algorithm
Input: current hour’s Open-Meteo hourly values + snowAgeHours (derived).
/**
*/
* snowAgeHours: hours since last hourly snowfall > 0.1cm
* Derived by scanning backward through hourly.snowfall array from current hour
function getSnowQuality({ temp_c, wind_kmh, snowfall_cm, snowAgeHours, humidity_pct }) {
// Fresh Powder: active snowfall, cold, manageable wind
if (snowfall_cm > 0.5 && temp_c < -2 && wind_kmh < 40)
return { label: "Powder", color: "#1E90FF", bgColor: "#E8F4FD", emoji: " ", priority: 1
// Wind Affected: fresh snow but blowing
if (snowfall_cm > 0.2 && wind_kmh >= 40)
return { label: "Wind Affected", color: "#F97316", bgColor: "#FEF3C7", emoji: " ", prior
// Packed Powder: recent snow (< 12hrs), cold and dry
if (snowAgeHours <= 12 && temp_c < -5 && humidity_pct < 70)
return { label: "Packed Powder", color: "#38BDF8", bgColor: "#F0F9FF", emoji: " ", prior
// Soft Snow: recent snow, warming
if (snowAgeHours <= 24 && temp_c >= -5 && temp_c < 2)
return { label: "Soft", color: "#4ADE80", bgColor: "#F0FDF4", emoji: " ", priority: 4 }
// Spring / Corn: warm temps
if (temp_c >= 2)
return { label: "Spring/Corn", color: "#FBBF24", bgColor: "#FFFBEB", emoji: " ", priorit
// Icy: old snow, refrozen
if (snowAgeHours > 24 && temp_c < -2)
return { label: "Icy", color: "#EF4444", bgColor: "#FEF2F2", emoji: " ", priority: 6 }
return { label: "Variable", color: "#9CA3AF", bgColor: "#F9FAFB", emoji: " ", priority: 7
}
Best Window Detection
For resort cards, surface the single best 24-hour window in the next 7 days:
function getBestWindow(dailyData) {
// Score each day: snowfall_sum weighted heavily, penalize rain_sum and high wind
const scored = dailyData.map((day, i) => ({
index: i,
date: day.time,
score: (day.snowfall_sum * 3)
- (day.rain_sum * 5)
- (day.windspeed_10m_max > 50 ? 10 : 0)
+ (day.temperature_2m_max < 0 ? 5 : 0)
}))
return scored.sort((a, b) => b.score - a.score)[0]
}
5. Data Flow & Caching
In-Memory Cache
// src/lib/cache.js
const forecastCache = new Map()
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour
export async function getCachedForecast(resortId, fetchFn) {
const cached = forecastCache.get(resortId)
if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
return cached.data
}
const data = await fetchFn()
forecastCache.set(resortId, { data, timestamp: Date.now() })
return data
}
Load Strategy
// On app mount:
// 1. Load all Tier 1 resorts (~100) in batches of 10
// 2. Stagger batches 200ms apart to avoid hammering the API
// 3. Tier 2 resorts: fetch only when user opens that resort's detail view
const BATCH_SIZE = 10
const BATCH_DELAY_MS = 200
async function loadTier1Forecasts(resorts) {
const tier1 = resorts.filter(r => r.tier === 1)
for (let i = 0; i < tier1.length; i += BATCH_SIZE) {
const batch = tier1.slice(i, i + BATCH_SIZE)
await Promise.all(batch.map(r => fetchAndCacheResort(r)))
if (i + BATCH_SIZE < tier1.length) {
await new Promise(r => setTimeout(r, BATCH_DELAY_MS))
}
}
}
6. Powder Alert System
Architecture: In-Session Polling (no Service Worker)
// src/lib/alerts.js
const ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000 // 6 hours — don't re-alert same resort
export async function requestNotificationPermission() {
if ('Notification' in window) {
return await Notification.requestPermission()
}
return 'denied'
}
export function checkPowderAlerts(resorts, forecasts, thresholds, savedAlerts) {
if (Notification.permission !== 'granted') return
resorts.forEach(resort => {
const forecast = forecasts[resort.id]
if (!forecast) return
const threshold = thresholds[resort.id] ?? POWDER_THRESHOLD_CM // default 15.24cm const lastAlerted = savedAlerts[resort.id] ?? 0
/ 6"
// Check next 48 hours of daily snowfall
const next2Days = forecast.daily.snowfall_sum.slice(0, 2)
const maxSnow = Math.max(...next2Days)
if (maxSnow >= threshold && Date.now() - lastAlerted > ALERT_COOLDOWN_MS) {
const inches = (maxSnow * CM_TO_INCHES).toFixed(1)
new Notification(` Powder Alert: ${resort.name}`, {
body: `${inches}" forecast in the next 48 hours`,
icon: '/snow-icon.png'
})
savedAlerts[resort.id] = Date.now()
localStorage.setItem('powderAlertLog', JSON.stringify(savedAlerts))
}
})
}
Trigger Points
On app load (after forecasts fetched)
On tab focus ( window.addEventListener('focus', ...) )
User can configure per-resort threshold in Settings (6”, 8”, 10”, 12”)
7. Claude AI Summary
API Call
// src/lib/aiSummary.js
export async function generateSummary(resort, forecast) {
const today = forecast.daily
const next7Days = today.time.slice(0, 7).map((date, i) => ({
date,
snowfall_in: (today.snowfall_sum[i] * CM_TO_INCHES).toFixed(1),
rain_in: (today.rain_sum[i] * CM_TO_INCHES).toFixed(1),
high_f: toF(today.temperature_2m_max[i]).toFixed(0),
low_f: toF(today.temperature_2m_min[i]).toFixed(0),
max_wind_mph: (today.windspeed_10m_max[i] * KMH_TO_MPH).toFixed(0),
code: today.weathercode[i]
}))
const currentSnowDepth = forecast.hourly.snow_depth[0]
const response = await fetch("https://api.anthropic.com/v1/messages", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
model: "claude-sonnet-4-20250514",
max_tokens: 1000,
system: `You are a mountain weather forecaster writing a brief daily snow report.
Write exactly 3 sentences. Be direct and actionable. Use skier-friendly language.
Mention: (1) current/recent conditions, (2) best upcoming window, (3) what to watch out for.
Do not use bullet points. Do not use headers. Plain prose only.`,
messages: [{
role: "user",
content: `Write a snow report for ${resort.name} (${resort.region}).
Current snow depth: ${(currentSnowDepth * CM_TO_INCHES).toFixed(0)} inches at summit (${resor
7-day forecast: ${JSON.stringify(next7Days, null, 2)}`
}]
})
})
const data = await response.json()
return data.content[0].text
}
Caching AI Summaries
Cache per resort per day (not per hour — summaries don’t need to change hourly):
const summaryCache = new Map()
export async function getCachedSummary(resortId, fetchFn) {
const today = new Date().toISOString().split('T')[0]
const key = `${resortId}_${today}`
if (summaryCache.has(key)) return summaryCache.get(key)
const summary = await fetchFn()
summaryCache.set(key, summary)
return summary
}
8. Application Screen Architecture
Navigation: 4 top-level views
App
├── / → Dashboard (default)
├── /compare → Comparison Table
├── /resort/:id → Resort Detail
└── /settings → Alert thresholds + preferences
8.1 Dashboard ( / )
Layout: Grid of resort cards, sorted by default by “next 48hr snowfall, descending”
Resort Card — data shown:
┌─────────────────────────────────────┐
│ Vail • CO │
│ Powder Summit: 12,192 ft │
│ │
│ NOW 24HR 48HR 72HR │
│ 3.2" [████] [██░░] [░░░░] │
│ 6.1" 2.4" 0" │
│ │
│ High: 18°F Wind: 22mph │
│ Best day: Tomorrow │
└─────────────────────────────────────┘
Card color states:
Orange glow border: 6”+ snowfall forecast in next 48hrs (powder threshold hit)
Blue border: Active snowfall right now
Default: No special border
Sort options (top of dashboard):
Next 24hr snow (default)
Next 48hr snow
Next 7-day snow total
Snow quality score
Alphabetical
Filter options:
Country (US / CA / SA)
Region (dropdown — Colorado, Utah, California, etc.)
8.2 Comparison Table ( /compare )
Layout: Sortable data table, all saved/tier-1 resorts
Resort Region Now 24hr 48hr 7-day Quality Best Day
Vail CO 6.1” 2.4” 18.2” Powder Tomorrow
Snowbird UT 0” 8.2” 24.1” Packed Sat
Columns:
Now: WMO weathercode icon + current temp
24hr: daily.snowfall_sum[0] in inches, color-coded (blue/orange)
48hr: daily.snowfall_sum[1]
7-day: sum of daily.snowfall_sum[0..6]
Quality: Snow quality label + emoji
Best Day: Day name of getBestWindow() result
Column headers are sortable (click to sort asc/desc)
Mixed precip indicator: If rain_sum > 0 on a day, show purple tint on that cell.
8.3 Resort Detail ( /resort/:id )
Three tabs: Snow Summary | Forecast | Conditions
Tab 1: Snow Summary
AI Overview (3-sentence summary, lazy loaded)
Snow quality badge (large, prominent)
Current snow depth at summit
Season context (is this above/below average? — skip for v1)
Tab 2: Forecast
7-day bar chart — one bar per day
Bar height = snowfall_
sum in inches
Bar color: blue if < 6”, orange if ≥ 6”, purple if rain_
sum > 0
X-axis: day name (Today, Fri, Sat…)
Y-axis: inches
Below the chart: daily data table with all variables
Hourly accordion — click any day to expand 24hr hourly breakdown
Tab 3: Conditions
Current temp (high/low)
Wind speed + gusts + direction
Cloud cover %
Relative humidity
Snow depth at summit
Feels like temp
8.4 Settings ( /settings )
Default powder alert threshold: slider (2” to 18” in 2” increments)
Per-resort overrides: list of saved resorts with individual threshold inputs
Notification permission status: button to request if not yet granted
Unit preference: Imperial (default) / Metric
Display preference: Dark mode / Light mode
9. Design System
Color Tokens
/* Snowfall bar colors */
--color-snow-light: #3B82F6; --color-snow-powder: #F97316; --color-snow-mixed: #8B5CF6; /* blue — < 6" */
/* orange — ≥ 6" */
/* purple — rain + snow */
/* Snow quality colors */
--color-quality-powder: #1E90FF;
--color-quality-wind: #F97316;
--color-quality-packed: #38BDF8;
--color-quality-soft: #4ADE80;
--color-quality-spring: #FBBF24;
--color-quality-icy: #EF4444;
--color-quality-variable: #9CA3AF;
/* Alert states */
--color-alert-powder: #F97316; --color-alert-active: #3B82F6; /* orange glow on card */
/* blue glow — snowing now */
/* App chrome */
--color-bg-dark: #0F172A; /* slate-900 */
--color-bg-card: #1E293B; /* slate-800 */
--color-bg-card-hover: #334155; /* slate-700 */
--color-text-primary: #F1F5F9; /* slate-100 */
--color-text-secondary: #94A3B8; /* slate-400 */
--color-accent: #38BDF8; /* sky-400 */
Typography
serif )
Font: System font stack ( -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-
Resort name: 18px semibold
Data values: 24px bold (snowfall numbers)
Labels: 12px uppercase tracking-wide, muted color
AI summary text: 14px regular, line-height 1.6
Component Library
Tailwind CSS for all layout and utility classes
No component library — build primitives directly
Recharts for the 7-day bar chart
lucide-react for icons
10. State Management
// Global state shape (React Context or Zustand)
{
resorts: Resort[], // full resort list from resorts.json
savedResortIds: string[], // user's pinned resorts (localStorage)
forecasts: Record<string, Forecast>, // resortId → Open-Meteo response
summaries: Record<string, string>, // resortId → AI summary text
loadingStates: Record<string, 'idle' | 'loading' | 'done' | 'error'>,
settings: {
defaultThreshold: number, // cm — default powder alert threshold
thresholds: Record<string, number>, // per-resort overrides
units: 'imperial' | 'metric',
darkMode: boolean
},
alertLog: Record<string, number> // resortId → last alert timestamp (localStorage)
}
Persistence (localStorage keys)
snowdesk_saved_resorts → string[] of resort IDs
snowdesk_settings → settings object
snowdesk_alert_log → alertLog object
11. File Structure
src/
├── data/
│ └── resorts.json # pre-filtered OpenSkiMap data (~100 Tier 1 + all Tier 2)
├── lib/
│ ├── openMeteo.js │ ├── cache.js │ ├── snowQuality.js │ ├── alerts.js │ ├── aiSummary.js │ └── utils.js # API calls + response parsing
# in-memory forecast + summary cache
# quality algorithm + best window calc
# powder alert logic
# Claude API call
# unit conversions, date helpers
├── components/
│ ├── ResortCard.jsx # dashboard card
│ ├── ComparisonTable.jsx # sortable comparison view
│ ├── SnowBar.jsx # single colored bar (reused in chart + card)
│ ├── QualityBadge.jsx # snow quality label + color
│ ├── WeatherIcon.jsx # WMO code → icon
│ └── LoadingSkeleton.jsx # card placeholder while fetching
├── views/
│ ├── Dashboard.jsx # /
│ ├── Comparison.jsx # /compare
│ ├── ResortDetail.jsx # /resort/:id
│ │ ├── tabs/SnowSummary.jsx
│ │ ├── tabs/Forecast.jsx
│ │ └── tabs/Conditions.jsx
│ └── Settings.jsx # /settings
├── context/
│ └── AppContext.jsx # global state + dispatch
├── App.jsx # router + layout shell
└── main.jsx # entry point
12. Build Agent Sequence
Run as separate Claude Code sessions in order. Each agent reads this SPEC.md first.
Agent 1: Data Layer
Prompt to start Claude Code session:
“Read SPEC.md. Build the data layer only. Deliverables: (1) Fetch and filter OpenSkiMap
GeoJSON, save as src/data/resorts.json with the schema in SPEC section 2. Include all
Americas resorts meeting filter criteria with tier assignments. (2) Build
src/lib/openMeteo.js — functions: fetchForecast(resort), fetchHistorical(resort). Use
exact parameters from SPEC section 3. (3) Build src/lib/snowQuality.js — exact algorithm
from SPEC section 4 including getBestWindow(). (4) Build src/lib/cache.js and
src/lib/utils.js. Write unit tests for snowQuality. No UI.”
Acceptance criteria:
fetchForecast(vailResort) returns correctly shaped data
getSnowQuality({temp_c: -8, wind_kmh: 20, snowfall_cm: 1.2, snowAgeHours: 1,
humidity_pct: 75}) returns {label: "Powder", ...}
resorts.json contains 50+ US resorts with correct schema
Agent 2: App Shell + Navigation
Prompt:
“Read SPEC.md. The data layer is built (src/data/resorts.json, src/lib/). Build: (1) Vite +
React project scaffold with Tailwind, react-router-dom, recharts, lucide-react. (2) App.jsx
with routing from SPEC section 8 (/, /compare, /resort/:id, /settings). (3) Global
AppContext from SPEC section 10 — wire up localStorage persistence for
savedResortIds, settings, alertLog. (4) App shell with top navigation bar. (5) Dark mode
as default using color tokens from SPEC section 9. No data fetching yet — use mock data
for layout.”
Acceptance criteria:
All 4 routes render without errors
Dark mode applied globally
AppContext accessible in all views
localStorage read/write working
Agent 3: Dashboard + Resort Cards
Prompt:
“Read SPEC.md. Shell and data layer are built. Build: (1) ResortCard.jsx — exact layout
from SPEC section 8.1 including powder/active snow border states. (2) SnowBar.jsx —
blue/orange/purple coloring logic from SPEC section 9. (3) QualityBadge.jsx. (4)
Dashboard.jsx — loads Tier 1 resort forecasts in batches (SPEC section 5 load strategy),
renders cards, sort options, filter options. (5) LoadingSkeleton.jsx for cards while
fetching.”
Acceptance criteria:
Dashboard shows live Open-Meteo data for 10+ resorts
Cards sort correctly by 24hr snowfall
Orange border appears on cards exceeding powder threshold
Batch loading doesn’t spike network requests
Agent 4: Comparison Table + Resort Detail
Prompt:
“Read SPEC.md. Dashboard is working. Build: (1) ComparisonTable.jsx — all columns
from SPEC section 8.2, sortable headers, mixed precip purple tinting. (2) ResortDetail.jsx
with 3-tab structure from SPEC section 8.3. (3) Forecast tab: 7-day Recharts bar chart
with correct color encoding, daily data table below, hourly accordion. (4) Conditions tab:
full current conditions display. (5) Snow Summary tab: placeholder for AI summary
(loading state), quality badge, snow depth.”
Acceptance criteria:
Comparison table sorts on all columns
Bar chart renders with correct colors
Resort detail route /resort/:id loads correct resort by ID
Tabs switch without remounting data
Agent 5: AI Summaries
Prompt:
“Read SPEC.md. All views are built. Build: (1) src/lib/aiSummary.js — exact Claude API call
from SPEC section 7 including the prompt. (2) Wire into Snow Summary tab with loading
state. (3) Implement per-resort-per-day cache from SPEC section 7. (4) Add error state
— if API call fails, show ‘Summary unavailable’ gracefully. Summaries should load lazily
(only when user opens the Snow Summary tab, not on dashboard load).”
Acceptance criteria:
Summary loads when Snow Summary tab is opened
Summary is cached — re-opening the tab doesn’t re-call the API
Graceful error state if API unavailable
3 sentences, no headers, no bullets in output
Agent 6: Alerts + Settings
Prompt:
“Read SPEC.md. App is feature-complete. Build: (1) src/lib/alerts.js — exact logic from
SPEC section 6. (2) Settings.jsx — threshold slider, per-resort overrides, notification
permission button, units toggle, dark mode toggle. (3) Wire alert checks to app load and
tab focus events. (4) Per-resort alert bell icon on ResortCard — click to configure that
resort’s threshold. (5) Test on at least one resort with manually lowered threshold to
confirm notification fires.”
Acceptance criteria:
Notification fires (with permission) when threshold is met
6-hour cooldown prevents spam
Settings persist across page reload
Per-resort threshold overrides work independently
13. Open Questions / Decisions Log
Question Decision Rationale
Backend? No — browser only Personal app, no auth needed
Resort data
source
OpenSkiMap GeoJSON Free, open, updated daily, has elevation
Weather API Open-Meteo Free, no key, CORS, good mountain
coverage
Alerts In-session polling Service Workers overkill for personal use
AI model
claude-sonnet-4-
20250514 Quality/cost balance for summaries
Component
library Tailwind only No shadcn dependency needed for this
scope
Scraping
OpenSnow
No ToS violation, fragile, blocked by rate
limiting
Maps Out of scope v1 Adds significant complexity, not core job
User accounts Out of scope v1 Personal app, localStorage is sufficient
SPEC version 1.0 — last updated 2026-02-27 All Claude Code agents should treat this
document as the source of truth. Any deviation from this spec should be documented in a
comment in the relevant file.