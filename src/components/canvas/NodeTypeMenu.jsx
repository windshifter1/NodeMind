import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { NODE_CATEGORIES, mathTypesByGroup, typesForCategory } from '@/lib/nodeTypes';

const MENU_WIDTH = 300;

export default function NodeTypeMenu({
  open,
  x = 0,
  y = 0,
  onClose,
  onSelect,
  /** When set, Math list is filtered to these kind ids (CAS applicability). */
  allowedMathKinds = null,
  /** Prefer opening on this category when the menu mounts. */
  initialCategory = 'text',
  /** Hide Values (Number/Expression) under Math — used when dragging from a Math output. */
  hideValueSources = false,
  /** Only show Value sources under Math — used when dragging into a Math input. */
  valuesOnly = false,
}) {
  const [category, setCategory] = useState(initialCategory);

  useEffect(() => {
    if (!open) return undefined;
    setCategory(initialCategory);
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, initialCategory]);

  const mathGroups = useMemo(() => {
    if (category !== 'math') return null;
    let groups = mathTypesByGroup();

    if (valuesOnly) {
      return groups
        .map((group) => ({
          ...group,
          types: group.types.filter((type) => type.group === 'values'),
        }))
        .filter((group) => group.types.length);
    }

    if (allowedMathKinds != null) {
      const allow = new Set(allowedMathKinds);
      return groups
        .map((group) => ({
          ...group,
          types: group.types.filter((type) => allow.has(type.id)),
        }))
        .filter((group) => group.types.length);
    }

    if (hideValueSources) {
      groups = groups
        .map((group) => ({
          ...group,
          types: group.types.filter((type) => type.group !== 'values'),
        }))
        .filter((group) => group.types.length);
    }

    return groups;
  }, [category, allowedMathKinds, hideValueSources, valuesOnly]);

  if (!open) return null;

  const types = category === 'math' ? null : typesForCategory(category);
  const emptyMath = category === 'math' && mathGroups && mathGroups.length === 0;
  const mathOnly = allowedMathKinds != null || valuesOnly;
  const visibleCategories = mathOnly
    ? NODE_CATEGORIES.filter((cat) => cat.id === 'math')
    : NODE_CATEGORIES;

  return (
    <div
      data-node-type-menu
      className="absolute overflow-hidden rounded-2xl border border-nm-border bg-nm-chrome shadow-xl backdrop-blur-md"
      style={{ left: x, top: y, width: MENU_WIDTH, zIndex: 1_000_000 }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1 border-b border-nm-divider px-3 py-2">
        <p className="min-w-0 flex-1 text-xs font-medium tracking-wide text-nm-text-muted">
          {allowedMathKinds != null ? 'Applicable ops' : valuesOnly ? 'Add a value' : 'Add a node'}
        </p>
        <button
          type="button"
          title="Close"
          onClick={onClose}
          className="rounded-lg p-1 text-nm-text-faint transition hover:bg-nm-hover hover:text-nm-text active:scale-95"
        >
          <X size={14} />
        </button>
      </div>
      <div className="flex max-h-[420px] min-h-[120px]">
        {!mathOnly && (
          <>
            <div className="flex w-[92px] shrink-0 flex-col gap-1 p-2">
              {visibleCategories.map((cat) => (
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
          </>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1 overflow-y-auto p-2">
          {types?.map((type) => (
            <button
              key={type.id}
              type="button"
              onClick={() => onSelect(type.id)}
              className="rounded-xl px-3 py-2.5 text-left text-sm font-medium text-nm-text-secondary transition hover:bg-nm-hover hover:text-nm-text active:scale-[0.98]"
            >
              {type.label}
            </button>
          ))}
          {emptyMath && (
            <p className="px-3 py-2 text-sm text-nm-text-faint">No operations apply to this expression.</p>
          )}
          {mathGroups?.map((group) => (
            <div key={group.id} className="pb-1">
              <p className="px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-nm-text-faint">
                {group.label}
              </p>
              {group.types.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => onSelect(type.id)}
                  className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-nm-text-secondary transition hover:bg-nm-hover hover:text-nm-text active:scale-[0.98]"
                >
                  {type.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
