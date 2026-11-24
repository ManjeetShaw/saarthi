import React from 'react';

// Class-wide progress as one bar: acknowledged / pending / overdue.
// Widths are relative to `total`; an empty course renders a neutral track.
export default function StackedProgress({ acknowledged = 0, pending = 0, overdue = 0, size = 'md', className = '' }) {
  const total = acknowledged + pending + overdue;
  const pct = (n) => (total ? (n / total) * 100 : 0);
  const height = size === 'sm' ? 'h-1.5' : 'h-2.5';

  return (
    <div
      className={`flex w-full ${height} rounded-full overflow-hidden bg-[#e1e3e4] ${className}`}
      role="img"
      aria-label={`${acknowledged} acknowledged, ${pending} pending, ${overdue} overdue`}
    >
      {total > 0 && (
        <>
          <div className="progress-fill bg-[#2D6A4F]" style={{ width: `${pct(acknowledged)}%` }} />
          <div className="progress-fill bg-[#4361EE]/70" style={{ width: `${pct(pending)}%` }} />
          <div className="progress-fill bg-[#D90429]" style={{ width: `${pct(overdue)}%` }} />
        </>
      )}
    </div>
  );
}
