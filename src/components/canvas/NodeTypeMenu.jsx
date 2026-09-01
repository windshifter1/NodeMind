import React, { useEffect, useState } from 'react';
import { NODE_CATEGORIES, typesForCategory } from '@/lib/nodeTypes';

const MENU_WIDTH = 280;
const MENU_MIN_HEIGHT = 164;

function clampMenuPosition(x, y) {
  const pad = 12;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = Math.min(Math.max(pad, x), Math.max(pad, vw - MENU_WIDTH - pad));
  const top = Math.min(Math.max(pad, y), Math.max(pad, vh - MENU_MIN_HEIGHT - pad));
  return { left, top };
}

export default function NodeTypeMenu({ open, x = 0, y = 0, onClose, onSelect }) {
  const [category, setCategory] = useState('text');

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const types = typesForCategory(category);
  const pos = clampMenuPosition(x, y);

  return (
    <div className="fixed inset-0 z-[240]">
      <div className="absolute inset-0" onPointerDown={onClose} />
      <div
        data-node-type-menu
        className="absolute overflow-hidden rounded-2xl border border-nm-border bg-nm-chrome shadow-xl backdrop-blur-md"
        style={{ left: pos.left, top: pos.top, width: MENU_WIDTH, minHeight: MENU_MIN_HEIGHT }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-nm-divider px-3 py-2">
          <p className="text-xs font-medium tracking-wide text-nm-text-muted">Add a node</p>
        </div>
        <div className="flex min-h-[120px]">
          <div className="flex w-[92px] shrink-0 flex-col gap-1 p-2">
            {NODE_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={`rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  category === cat.id
                    ? 'bg-indigo-500/35 text-indigo-100 shadow-[0_0_0_1px_rgba(165,180,252,0.45)]'
                    : 'text-nm-text-secondary hover:bg-nm-hover hover:text-nm-text'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
          <div className="w-px self-stretch bg-nm-divider" />
          <div className="flex min-w-0 flex-1 flex-col gap-1 p-2">
            {types.map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => onSelect(type.id)}
                className="rounded-xl px-3 py-2.5 text-left text-sm font-medium text-nm-text-secondary transition hover:bg-nm-hover hover:text-nm-text active:scale-[0.98]"
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
