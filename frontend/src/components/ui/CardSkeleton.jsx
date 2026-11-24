import React from 'react';

// Placeholder while data loads, shaped like the cards it stands in for so
// the page does not jump when real content arrives.
export default function CardSkeleton({ count = 3 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-[#e1e3e4] p-5 h-48 animate-pulse">
          <div className="h-3 w-16 bg-[#e1e3e4] rounded mb-4" />
          <div className="h-5 w-3/4 bg-[#e1e3e4] rounded mb-2" />
          <div className="h-3 w-1/2 bg-[#eef0f0] rounded mb-8" />
          <div className="h-2 w-full bg-[#eef0f0] rounded-full" />
        </div>
      ))}
    </div>
  );
}
