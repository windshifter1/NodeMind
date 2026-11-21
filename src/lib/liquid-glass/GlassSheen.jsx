import React from 'react';
import { cn } from '@/lib/liquid-glass/cn';

export function GlassSheen({ className, opacity = 0.12 }) {
  return (
    <div
      className={cn('pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]', className)}
      aria-hidden
      style={{
        background: `linear-gradient(
          105deg,
          transparent 38%,
          rgba(255, 255, 255, ${opacity}) 50%,
          transparent 62%
        )`,
      }}
    />
  );
}