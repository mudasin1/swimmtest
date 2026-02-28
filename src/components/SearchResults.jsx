/**
 * src/components/SearchResults.jsx
 *
 * Lightweight search results list shown when the Dashboard search has a value.
 * Renders simple rows for both Tier 1 (with forecast data) and Tier 2 (no data yet).
 *
 * Props:
 *   results  {Resort[]}  — filtered resort objects (any tier)
 *   forecasts {object}   — from context — keyed by resort.id
 *   query    {string}    — current search string for highlight
 */

import { useNavigate } from 'react-router-dom';
import { toInches } from '../lib/utils.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function toFeet(m) {
  return Math.round(m * 3.28084);
}

/**
 * Wrap the matching substring of `text` in a <mark> element.
 * Returns a React fragment when there is a match, plain string otherwise.
 */
function highlightMatch(text, query) {
  if (!query) return text;
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark
        style={{
          backgroundColor: 'rgba(56,189,248,0.25)',
          color: 'var(--color-accent)',
          borderRadius: 2,
          padding: '0 1px',
        }}
      >
        {text.slice(index, index + query.length)}
      </mark>
      {text.slice(index + query.length)}
    </>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SearchResults({ results, forecasts, query }) {
  const navigate = useNavigate();

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (results.length === 0) {
    return (
      <div
        style={{
          padding: '48px 24px',
          textAlign: 'center',
          color: 'var(--color-text-secondary)',
          fontSize: 14,
        }}
      >
        No resorts found matching &ldquo;{query}&rdquo;
      </div>
    );
  }

  return (
    <div style={{ padding: '8px 0' }}>
      {results.map((resort) => {
        const forecast = forecasts[resort.id] ?? null;
        const isTier1 = resort.tier === 1;

        // 24hr snowfall: only show if forecast is already loaded
        let snow24Display = '—';
        if (forecast?.daily?.snowfall_sum?.[0] != null) {
          snow24Display = `${toInches(forecast.daily.snowfall_sum[0])}"`;
        }

        return (
          <div
            key={resort.id}
            onClick={() => navigate(`/resort/${resort.slug}`)}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = 'var(--color-bg-card-hover)')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = 'transparent')
            }
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 16px',
              cursor: 'pointer',
              borderBottom: '1px solid var(--color-bg-card)',
              transition: 'background-color 0.1s',
            }}
          >
            {/* Left: name + location/elevation details */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'var(--color-text-primary)',
                  marginBottom: 2,
                }}
              >
                {highlightMatch(resort.name, query)}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--color-text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  flexWrap: 'wrap',
                }}
              >
                {resort.region && <span>{resort.region}, {resort.country}</span>}
                {resort.summitElevation > 0 && (
                  <>
                    <span style={{ opacity: 0.4 }}>·</span>
                    <span>Summit {toFeet(resort.summitElevation).toLocaleString()}ft</span>
                  </>
                )}
                {resort.verticalDrop > 0 && (
                  <>
                    <span style={{ opacity: 0.4 }}>·</span>
                    <span>Drop {toFeet(resort.verticalDrop).toLocaleString()}ft</span>
                  </>
                )}
              </div>
            </div>

            {/* Right: 24hr snow + tier badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexShrink: 0,
                marginLeft: 12,
              }}
            >
              {/* 24hr snowfall (or dash for unloaded Tier 2) */}
              <div style={{ textAlign: 'right' }}>
                <div
                  style={{
                    fontSize: 13,
                    color:
                      snow24Display === '—'
                        ? 'var(--color-text-secondary)'
                        : 'var(--color-text-primary)',
                    fontWeight: snow24Display === '—' ? 400 : 600,
                  }}
                >
                  {snow24Display}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--color-text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  24hr
                </div>
              </div>

              {/* Tier badge */}
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '2px 7px',
                  borderRadius: 4,
                  color: isTier1 ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                  border: `1px solid ${isTier1 ? 'var(--color-accent)' : 'var(--color-bg-card-hover)'}`,
                  whiteSpace: 'nowrap',
                }}
              >
                {isTier1 ? 'Tier 1' : 'Tier 2'}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
