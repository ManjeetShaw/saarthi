import React from 'react';

// Styled native <select> that matches Input. Native keeps it accessible and
// mobile-friendly (the OS picker opens on phones).
export default function Select({ label, error, helperText, children, className = '', id, ...props }) {
  const selectId = id || (label ? `select-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={selectId} className="block text-sm font-semibold text-[#414844]">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`w-full rounded-xl bg-white border ${
          error ? 'border-[#D90429]' : 'border-[#c1c8c2] focus:border-[#012d1d] focus:ring-2 focus:ring-[#012d1d]/10'
        } px-3.5 py-2.5 text-sm text-[#191c1d] outline-none transition-all ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-[#D90429] font-medium">{error}</p>}
      {helperText && !error && <p className="text-xs text-[#717973]">{helperText}</p>}
    </div>
  );
}
