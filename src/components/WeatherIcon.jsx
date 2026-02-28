/**
 * src/components/WeatherIcon.jsx
 *
 * Renders a WMO weather code as an emoji icon with a tooltip.
 * Conforms to SPEC.md Deliverable 4.
 *
 * Props:
 *   code  {number}  — WMO weather code
 *   size  {number}  — font-size in px (default 20)
 */

import { getWeatherInfo } from '../lib/utils.js';

export default function WeatherIcon({ code, size = 20 }) {
  const { label, icon } = getWeatherInfo(code ?? -1);

  return (
    <span
      title={label}
      aria-label={label}
      role="img"
      style={{ fontSize: size, lineHeight: 1, display: 'inline-block' }}
    >
      {icon}
    </span>
  );
}
