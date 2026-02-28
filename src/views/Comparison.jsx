/**
 * src/views/Comparison.jsx
 *
 * /compare route — renders the sortable comparison table.
 * SPEC.md section 8.2.
 */

import ComparisonTable from '../components/ComparisonTable.jsx';

export default function Comparison() {
  return (
    <div className="p-6">
      <h1
        className="text-2xl font-bold mb-6"
        style={{ color: 'var(--color-text-primary)' }}
      >
        Compare Resorts
      </h1>
      <ComparisonTable />
    </div>
  );
}
