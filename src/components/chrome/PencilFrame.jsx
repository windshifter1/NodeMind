import React from 'react';
import { hashSeed, irand, scribbleLine, wobbleRect } from '@/lib/pencilPath';
import { UI_STYLE } from '@/lib/uiStyle';
import { useUiStyle } from '@/hooks/useUiStyle';

export function PencilOutline({ seed = 1, w = 120, h = 80, amp = 2.2, className = '' }) {
  const lead = wobbleRect(seed, w, h, { amp, pad: 5 });
  const ghost = wobbleRect(seed + 53, w, h, { amp: amp * 0.7, pad: 5.6 });
  return (
    <svg
      className={`nm-wb__outline ${className}`}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path className="nm-wb__ghost" d={ghost} vectorEffect="nonScalingStroke" />
      <path className="nm-wb__lead" d={lead} vectorEffect="nonScalingStroke" />
    </svg>
  );
}

export function HatchFill({ seed = 1, color = '#6366f1', w = 248, h = 168 }) {
  const lines = [];
  const gap = 14;
  const count = Math.ceil((w + h) / gap) + 2;
  for (let i = 0; i < count; i += 1) {
    const x = -24 + i * gap;
    lines.push(scribbleLine(seed + i * 3, [[x, h + 16], [x + h + 28, -14]], 1.8));
  }
  return (
    <svg className="nm-wb__hatch" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      {lines.map((d, i) => (
        <path
          key={`${seed}-${i}`}
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={0.85}
          opacity={0.22 + irand(seed + i) * 0.12}
          vectorEffect="nonScalingStroke"
        />
      ))}
    </svg>
  );
}

export function PencilFrame({ seed = 1, hatchColor = null, amp = 2.2, className = '' }) {
  const style = useUiStyle();
  if (style !== UI_STYLE.WHITEBOARD) return null;
  return (
    <>
      {hatchColor ? <HatchFill seed={hashSeed(seed) + 9} color={hatchColor} /> : null}
      <PencilOutline seed={hashSeed(seed)} w={240} h={160} amp={amp} className={className} />
    </>
  );
}
