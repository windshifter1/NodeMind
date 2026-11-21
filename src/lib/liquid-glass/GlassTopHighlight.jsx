import React from 'react';
import { cn } from '@/lib/liquid-glass/cn';

export function GlassTopHighlight({ className, opacity = 0.2 }) {
  return (
    <div
      className={cn('pointer-events-none absolute h-px glass-top-highlight rounded-full', className)}
      style={{ opacity }}
    />
  );
}