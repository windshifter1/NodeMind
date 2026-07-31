import React from 'react';

export default function BinIcon({ open, size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <g transform={open ? 'rotate(-28 3 7)' : undefined}>
        <path d="M3 7h18" />
        <path d="M9 7V4h6v3" />
      </g>
      <path d="M4 7l1 13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2l1-13" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}