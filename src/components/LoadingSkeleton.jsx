/**
 * src/components/LoadingSkeleton.jsx
 *
 * Animated pulse skeleton card matching the resort card dimensions.
 * Used by Agent 3's Dashboard while forecast data is loading.
 * SPEC.md Deliverable 7.
 *
 * Layout mirrors the resort card (SPEC.md section 8.1):
 *   - Wide bar  → resort name
 *   - Narrow bar → region/country
 *   - 4 short bars in a row → NOW / 24HR / 48HR / 72HR slots
 *   - Two medium bars → High/Wind row
 */

export default function LoadingSkeleton() {
  return (
    <div
      className="animate-pulse rounded-lg p-4 w-full"
      style={{
        backgroundColor: 'var(--color-bg-card)',
        minHeight: '160px',
      }}
      aria-hidden="true"
    >
      {/* Resort name */}
      <div
        className="h-5 rounded mb-2"
        style={{
          backgroundColor: 'var(--color-bg-card-hover)',
          width: '65%',
        }}
      />

      {/* Region */}
      <div
        className="h-3.5 rounded mb-4"
        style={{
          backgroundColor: 'var(--color-bg-card-hover)',
          width: '40%',
        }}
      />

      {/* Snow data row: NOW / 24HR / 48HR / 72HR */}
      <div className="flex gap-2 mb-4">
        {[48, 56, 56, 56].map((w, i) => (
          <div
            key={i}
            className="h-10 rounded flex-1"
            style={{
              backgroundColor: 'var(--color-bg-card-hover)',
              maxWidth: `${w}px`,
            }}
          />
        ))}
      </div>

      {/* High / Wind row */}
      <div className="flex gap-4">
        <div
          className="h-3.5 rounded"
          style={{
            backgroundColor: 'var(--color-bg-card-hover)',
            width: '30%',
          }}
        />
        <div
          className="h-3.5 rounded"
          style={{
            backgroundColor: 'var(--color-bg-card-hover)',
            width: '30%',
          }}
        />
      </div>
    </div>
  )
}
