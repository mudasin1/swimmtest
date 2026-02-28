/**
 * src/components/QualityBadge.jsx
 *
 * Pill badge for snow quality — used in resort cards and resort detail.
 * Uses dynamic color/bgColor from the quality object (not Tailwind classes).
 * Conforms to SPEC.md Deliverable 3.
 *
 * Props:
 *   quality  {{ label, color, bgColor, emoji, priority }}  — from getSnowQuality()
 *   size     {'sm' | 'md' | 'lg'}                         — default 'md'
 */

const SIZE_STYLES = {
  sm: {
    fontSize: '11px',
    padding: '2px 6px',
    fontWeight: 500,
  },
  md: {
    fontSize: '13px',
    padding: '3px 9px',
    fontWeight: 500,
  },
  lg: {
    fontSize: '16px',
    padding: '6px 14px',
    fontWeight: 600,
  },
};

export default function QualityBadge({ quality, size = 'md' }) {
  if (!quality) return null;

  const sizeStyle = SIZE_STYLES[size] ?? SIZE_STYLES.md;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        borderRadius: 9999,
        color: quality.color,
        backgroundColor: quality.bgColor,
        whiteSpace: 'nowrap',
        lineHeight: 1.4,
        ...sizeStyle,
      }}
    >
      <span role="img" aria-label={quality.label}>{quality.emoji}</span>
      {quality.label}
    </span>
  );
}
