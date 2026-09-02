import React, { useRef } from 'react';

/**
 * Left/right scrub handles (←| and |→). Horizontal drag adjusts a numeric value.
 * Hidden by the parent when the field is a non-number expression.
 */
export default function GraphParamScrub({
  side,
  valueText,
  onCommit,
  darkNodes = true,
  title,
}) {
  const dragRef = useRef(null);

  const onPointerDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget;
    el.setPointerCapture?.(e.pointerId);
    const raw = String(valueText ?? '').trim();
    const startVal = raw === '' ? 1 : Number(raw);
    dragRef.current = {
      x: e.clientX,
      value: Number.isFinite(startVal) ? startVal : 1,
    };
  };

  const onPointerMove = (e) => {
    if (!dragRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const dx = e.clientX - dragRef.current.x;
    if (dx === 0) return;
    const base = Math.abs(dragRef.current.value);
    const step = base >= 100 ? 1 : base >= 10 ? 0.1 : base >= 1 ? 0.01 : 0.001;
    const next = dragRef.current.value + dx * step;
    dragRef.current = { x: e.clientX, value: next };
    const decimals = step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3;
    const rounded = Number(next.toFixed(decimals));
    onCommit?.(String(rounded));
  };

  const onPointerUp = (e) => {
    e.stopPropagation();
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const color = darkNodes ? 'text-zinc-300' : 'text-slate-600';
  const hover = darkNodes ? 'hover:bg-white/10' : 'hover:bg-black/5';

  return (
    <button
      type="button"
      tabIndex={-1}
      title={title || (side === 'left' ? 'Drag left to decrease' : 'Drag right to increase')}
      className={`flex h-7 w-6 shrink-0 select-none items-center justify-center rounded ${color} ${hover} cursor-ew-resize touch-none`}
      style={{ touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      aria-label={side === 'left' ? 'Decrease value' : 'Increase value'}
    >
      {side === 'left' ? (
        // ←|
        <svg width="16" height="18" viewBox="0 0 16 18" aria-hidden="true">
          <path
            d="M10 1 V17 M10 9 H3 M5.5 5.5 L2 9 L5.5 12.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        // |→
        <svg width="16" height="18" viewBox="0 0 16 18" aria-hidden="true">
          <path
            d="M6 1 V17 M6 9 H13 M10.5 5.5 L14 9 L10.5 12.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}
