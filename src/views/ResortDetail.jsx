/**
 * src/views/ResortDetail.jsx — stub
 *
 * Reads :id param, finds the resort in context, displays name + coordinates.
 * Full 3-tab detail view built by Agent 4.
 * SPEC.md section 8.3.
 */

import { useParams } from 'react-router-dom'
import { useApp } from '../context/AppContext'

export default function ResortDetail() {
  const { id } = useParams()
  const { resorts } = useApp()
  const resort = resorts.find((r) => r.id === id)

  if (!resort) {
    return (
      <div className="p-6">
        <h1
          className="text-2xl font-semibold mb-2"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Resort not found
        </h1>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          No resort with id: <code>{id}</code>
        </p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1
        className="text-2xl font-semibold mb-1"
        style={{ color: 'var(--color-text-primary)' }}
      >
        {resort.name}
      </h1>
      <p
        className="text-sm mb-4"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {resort.region && `${resort.region}, `}{resort.country}
      </p>
      <dl
        className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm max-w-sm"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        <dt>Latitude</dt>
        <dd style={{ color: 'var(--color-text-primary)' }}>{resort.lat}</dd>
        <dt>Longitude</dt>
        <dd style={{ color: 'var(--color-text-primary)' }}>{resort.lng}</dd>
        <dt>Summit elevation</dt>
        <dd style={{ color: 'var(--color-text-primary)' }}>
          {resort.summitElevation} m
        </dd>
        <dt>Vertical drop</dt>
        <dd style={{ color: 'var(--color-text-primary)' }}>
          {resort.verticalDrop} m
        </dd>
      </dl>
      <p
        className="mt-6 text-sm"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        Full resort detail view (tabs: Snow Summary | Forecast | Conditions) coming in Agent 4.
      </p>
    </div>
  )
}
