/**
 * scripts/buildResortData.js
 *
 * Fetches OpenSkiMap GeoJSON, filters to qualifying Americas downhill resorts,
 * maps to the SPEC.md section 2 schema, assigns tiers, and writes
 * src/data/resorts.json.
 *
 * Run with: node scripts/buildResortData.js
 *
 * Data source: https://tiles.openskimap.org/geojson/ski_areas.geojson
 *
 * Note on field mapping vs SPEC:
 *  - SPEC says properties.type === "downhill" but actual data always has
 *    properties.type === "skiArea"; downhill check is via properties.activities.
 *  - SPEC says properties.country; actual field is properties.places[0].iso3166_1Alpha2.
 *  - SPEC says properties.statistics.verticalDrop; field is absent — computed as
 *    statistics.maxElevation - statistics.minElevation (SPEC-approved fallback).
 */

import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Configure native fetch to honour the HTTPS_PROXY env var that this sandbox sets.
// undici's ProxyAgent is used when the env var is present.
const proxyUrl = process.env.https_proxy || process.env.HTTPS_PROXY;
if (proxyUrl) {
  const { ProxyAgent, setGlobalDispatcher } = await import('undici');
  setGlobalDispatcher(new ProxyAgent(proxyUrl));
}

const __dirname = dirname(fileURLToPath(import.meta.url));

const OPENSKIMAP_URL = 'https://tiles.openskimap.org/geojson/ski_areas.geojson';

const AMERICAS_COUNTRIES = new Set(['US', 'CA', 'MX', 'AR', 'CL', 'BR', 'BO', 'PE', 'CO']);

/** Round a number to n decimal places. */
const round = (n, decimals) => Math.round(n * 10 ** decimals) / 10 ** decimals;

/**
 * Compute {lat, lng} from a GeoJSON geometry.
 * Point → direct coords; Polygon/MultiPolygon → centroid of outer ring.
 */
function getCentroid(geometry) {
  if (!geometry) return { lat: null, lng: null };

  if (geometry.type === 'Point') {
    return { lng: geometry.coordinates[0], lat: geometry.coordinates[1] };
  }

  let ring;
  if (geometry.type === 'Polygon') {
    ring = geometry.coordinates[0];
  } else if (geometry.type === 'MultiPolygon') {
    ring = geometry.coordinates[0][0];
  } else {
    return { lat: null, lng: null };
  }

  if (!ring || ring.length === 0) return { lat: null, lng: null };
  const sum = ring.reduce((acc, c) => ({ lng: acc.lng + c[0], lat: acc.lat + c[1] }), { lng: 0, lat: 0 });
  return { lng: sum.lng / ring.length, lat: sum.lat / ring.length };
}

/**
 * Derive the country code (ISO 3166-1 alpha-2) from the places array.
 * Prefer the first place entry.
 */
function getCountry(places) {
  return places?.[0]?.iso3166_1Alpha2 ?? null;
}

/**
 * Derive region name from the places array (English localization).
 */
function getRegion(places) {
  return places?.[0]?.localized?.en?.region ?? null;
}

/**
 * Compute vertical drop (meters).
 * Uses statistics.maxElevation - statistics.minElevation as SPEC-approved proxy.
 */
function getVerticalDrop(stats) {
  if (!stats) return 0;
  if (
    stats.maxElevation != null &&
    stats.minElevation != null &&
    stats.maxElevation > stats.minElevation
  ) {
    return stats.maxElevation - stats.minElevation;
  }
  return 0;
}

/**
 * Build a SPEC-style ID for a resort feature.
 * Prefer the "openstreetmap-way-<osmId>" format when an OSM source is present.
 */
function buildId(props) {
  const osmSource = props.sources?.find((s) => s.type === 'openstreetmap');
  if (osmSource?.id) {
    // osmSource.id is like "way/12345678" or "relation/12345678"
    return `openstreetmap-${osmSource.id.replace('/', '-')}`;
  }
  return props.id; // fall back to the openskimap UUID
}

async function main() {
  console.log('Fetching OpenSkiMap GeoJSON…');
  let response;
  try {
    response = await fetch(OPENSKIMAP_URL);
  } catch (err) {
    throw new Error(`Network error fetching OpenSkiMap: ${err.message}`);
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching OpenSkiMap GeoJSON`);
  }

  const geojson = await response.json();
  console.log(`Total features in source: ${geojson.features.length}`);

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = geojson.features.filter((f) => {
    const p = f.properties;
    if (!p) return false;
    if (p.status !== 'operating') return false;

    // SPEC says type === "downhill"; actual field uses activities array.
    if (!Array.isArray(p.activities) || !p.activities.includes('downhill')) return false;

    const country = getCountry(p.places);
    if (!AMERICAS_COUNTRIES.has(country)) return false;

    if (!p.name || p.name.trim() === '') return false;

    const vDrop = getVerticalDrop(p.statistics);
    if (vDrop < 150) return false;

    return true;
  });

  console.log(`Qualifying resorts after filter: ${filtered.length}`);

  // ── Map to SPEC.md section 2 schema ───────────────────────────────────────
  const resorts = filtered.map((f) => {
    const p = f.properties;
    const stats = p.statistics;
    const { lat, lng } = getCentroid(f.geometry);
    const vDrop = getVerticalDrop(stats);

    return {
      id: buildId(p),
      name: p.name.trim(),
      country: getCountry(p.places),
      region: getRegion(p.places),
      lat: lat != null ? round(lat, 4) : null,
      lng: lng != null ? round(lng, 4) : null,
      summitElevation: round(stats?.maxElevation ?? 0, 1),
      baseElevation: round(stats?.minElevation ?? 0, 1),
      verticalDrop: Math.round(vDrop),
      website: p.websites?.[0] ?? null,
      tier: 2, // will be updated below
    };
  });

  // ── Tier assignment ───────────────────────────────────────────────────────
  const sortedByVDrop = (codes) =>
    resorts
      .filter((r) => (Array.isArray(codes) ? codes.includes(r.country) : r.country === codes))
      .sort((a, b) => b.verticalDrop - a.verticalDrop);

  const tier1Ids = new Set([
    ...sortedByVDrop('US').slice(0, 50).map((r) => r.id),
    ...sortedByVDrop('CA').slice(0, 25).map((r) => r.id),
    ...sortedByVDrop('MX').slice(0, 10).map((r) => r.id),
    ...sortedByVDrop(['AR', 'CL']).slice(0, 15).map((r) => r.id),
  ]);

  resorts.forEach((r) => {
    r.tier = tier1Ids.has(r.id) ? 1 : 2;
  });

  // ── Write output ──────────────────────────────────────────────────────────
  const outDir = join(__dirname, '..', 'src', 'data');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'resorts.json');
  writeFileSync(outPath, JSON.stringify(resorts, null, 2));

  // ── Summary ───────────────────────────────────────────────────────────────
  const countByCountry = {};
  resorts.forEach((r) => {
    countByCountry[r.country] = (countByCountry[r.country] || 0) + 1;
  });

  const tier1Count = resorts.filter((r) => r.tier === 1).length;
  const tier2Count = resorts.filter((r) => r.tier === 2).length;

  console.log('\n=== Summary ===');
  console.log(`Total resorts written: ${resorts.length}`);
  console.log('By country:');
  Object.entries(countByCountry)
    .sort((a, b) => b[1] - a[1])
    .forEach(([c, n]) => console.log(`  ${c}: ${n}`));
  console.log(`Tier 1: ${tier1Count}`);
  console.log(`Tier 2: ${tier2Count}`);
  console.log(`\nOutput → ${outPath}`);
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
