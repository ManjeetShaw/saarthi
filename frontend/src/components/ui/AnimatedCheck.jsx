import React from 'react';

// A circle that draws itself, then a tick. Used wherever something has just
// been acknowledged. `animate={false}` renders the finished state without
// motion (for rows that were already acknowledged when the page loaded).
export default function AnimatedCheck({ size = 48, animate = true, color = '#2D6A4F', delay = 0, label }) {
  const circleClass = animate ? 'check-circle' : '';
  const tickClass = animate ? 'check-tick' : '';
  const style = animate ? { animationDelay: `${delay}ms` } : undefined;
  const tickStyle = animate ? { animationDelay: `${delay + 450}ms` } : undefined;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 52 52"
      fill="none"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <circle
        className={circleClass}
        style={style}
        cx="26" cy="26" r="24"
        stroke={color} strokeWidth="3"
        strokeDasharray={animate ? undefined : 'none'}
        strokeDashoffset={animate ? undefined : 0}
      />
      <path
        className={tickClass}
        style={tickStyle}
        d="M15 27l8 8 15-16"
        stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray={animate ? undefined : 'none'}
        strokeDashoffset={animate ? undefined : 0}
      />
    </svg>
  );
}
