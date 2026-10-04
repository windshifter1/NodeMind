import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { NODE_CATEGORIES, isValueSourceKind, mathTypesByGroup, typesForCategory } from '@/lib/nodeTypes';
import { suppressNodePickerOpen } from '@/lib/nodePickerGesture';
import { useSheetDragDismiss } from '@/hooks/useSheetDragDismiss';
import './mobileChrome.css';

const MENU_WIDTH = 300;

function dismissAway(onClose) {
  // Canvas board may still treat this gesture as a click-to-add after a
  // capture-phase close; suppress that reopen for the rest of the tap.
  suppressNodePickerOpen();
  onClose();
}

function TypeList({
  types,
  mathGroups,
  emptyMath,
  onSelect,
  itemClassName = 'rounded-xl px-3 py-2.5 text-left text-sm font-medium text-nm-text-secondary transition hover:bg-nm-hover hover:text-nm-text active:scale-[0.98]',
}) {
  return (
    <>
      {types?.map((type) => (
        <button key={type.id} type="button" onClick={() => onSelect(type.id)} className={itemClassName}>
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
    </>
  );
}

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
  /** Use viewport-fixed placement (e.g. older mobile toolbar popup). */
  fixed = false,
  /** Bottom sheet chrome — same pattern as mobile More actions. */
  sheet = false,
}) {
  const [category, setCategory] = useState(initialCategory);
  const closeSheet = useCallback(() => dismissAway(onClose), [onClose]);
  const { sheetRef, backdropRef, handleProps } = useSheetDragDismiss(closeSheet, {
    open: open && sheet,
  });

  useEffect(() => {
    if (!open) return undefined;
    setCategory(initialCategory);
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      dismissAway(onClose);
    };
    // Sheet uses its own backdrop; skip global pointer dismiss there.
    if (sheet) {
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }
    const onPointer = (e) => {
      if (e.target?.closest?.('[data-node-type-menu]')) return;
      // Mobile chrome / sheets should also count as "away" and just close.
      dismissAway(onClose);
    };
    window.addEventListener('keydown', onKey);
    // Defer so the opening tap does not immediately dismiss the menu.
    let removePointer = () => {};
    const timer = window.setTimeout(() => {
      window.addEventListener('pointerdown', onPointer, true);
      removePointer = () => window.removeEventListener('pointerdown', onPointer, true);
    }, 0);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(timer);
      removePointer();
    };
  }, [open, onClose, initialCategory, sheet]);

  const mathGroups = useMemo(() => {
    if (category !== 'math') return null;
    let groups = mathTypesByGroup();

    if (valuesOnly) {
      return groups
        .map((group) => ({
          ...group,
          types: group.types.filter((type) => isValueSourceKind(type.id)),
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
  const title =
    allowedMathKinds != null ? 'Applicable ops' : valuesOnly ? 'Add a value' : 'Add a node';

  if (sheet) {
    const sheetUi = (
      <>
        <button
          ref={backdropRef}
          type="button"
          className="nm-mobile__sheet-backdrop"
          style={{ position: 'fixed', zIndex: 1_000_000 }}
          aria-label="Close sheet"
          onClick={closeSheet}
        />
        <div
          ref={sheetRef}
          data-node-type-menu
          className="nm-mobile__sheet nm-mobile__chrome"
          style={{ position: 'fixed', zIndex: 1_000_001, maxHeight: 'min(72%, 480px)' }}
          role="dialog"
          aria-label={title}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          <div className="nm-mobile__sheet-handle-hit" {...handleProps}>
            <div className="nm-mobile__sheet-handle" />
          </div>
          <div className="nm-mobile__sheet-head">
            <p className="nm-mobile__sheet-title">{title}</p>
            <button
              type="button"
              title="Close"
              aria-label="Close"
              onClick={closeSheet}
              className="nm-mobile__btn nm-mobile__sheet-close"
            >
              <X size={16} />
            </button>
          </div>
          {!mathOnly && (
            <div className="mb-2 flex gap-1 overflow-x-auto px-0.5 pb-1">
              {visibleCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`shrink-0 rounded-xl px-3 py-2 text-sm font-medium transition ${
                    category === cat.id
                      ? 'bg-indigo-500/35 text-indigo-100 shadow-[0_0_0_1px_rgba(165,180,252,0.45)]'
                      : 'text-nm-text-secondary hover:bg-nm-hover hover:text-nm-text'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          )}
          <div className="nm-mobile__sheet-stack min-h-0 flex-1 overflow-y-auto">
            {types?.map((type) => (
              <button
                key={type.id}
                type="button"
                className="nm-mobile__sheet-item !min-h-0 !flex-row !justify-start gap-2 px-3 py-3"
                onClick={() => onSelect(type.id)}
              >
                <span className="text-sm font-medium text-nm-text-secondary">{type.label}</span>
              </button>
            ))}
            {emptyMath && (
              <p className="px-3 py-2 text-sm text-nm-text-faint">No operations apply to this expression.</p>
            )}
            {mathGroups?.map((group) => (
              <div key={group.id} className="pb-1">
                <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-nm-text-faint">
                  {group.label}
                </p>
                <div className="flex flex-col gap-1">
                  {group.types.map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      className="nm-mobile__sheet-item !min-h-0 !flex-row !justify-start gap-2 px-3 py-3"
                      onClick={() => onSelect(type.id)}
                    >
                      <span className="text-sm font-medium text-nm-text-secondary">{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </>
    );
    return typeof document !== 'undefined' ? createPortal(sheetUi, document.body) : sheetUi;
  }

  const menuWidth = Math.min(
    MENU_WIDTH,
    Math.max(240, (typeof window !== 'undefined' ? window.innerWidth : MENU_WIDTH) - 16)
  );
  const left = fixed
    ? Math.max(8, Math.min(x, (typeof window !== 'undefined' ? window.innerWidth : x) - menuWidth - 8))
    : x;
  const top = fixed
    ? Math.max(8, Math.min(y, (typeof window !== 'undefined' ? window.innerHeight : y) - 80))
    : y;

  const menu = (
    <div
      data-node-type-menu
      className={`${fixed ? 'fixed' : 'absolute'} overflow-hidden rounded-2xl border border-nm-border bg-nm-chrome shadow-xl backdrop-blur-md`}
      style={{
        left,
        top,
        width: menuWidth,
        zIndex: fixed ? 1_000_001 : 1_000_000,
        maxHeight: fixed ? 'min(420px, 70vh)' : undefined,
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1 border-b border-nm-divider px-3 py-2">
        <p className="min-w-0 flex-1 text-xs font-medium tracking-wide text-nm-text-muted">{title}</p>
        <button
          type="button"
          title="Close"
          onClick={() => dismissAway(onClose)}
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
          <TypeList types={types} mathGroups={mathGroups} emptyMath={emptyMath} onSelect={onSelect} />
        </div>
      </div>
    </div>
  );

  if (fixed && typeof document !== 'undefined') {
    return createPortal(menu, document.body);
  }
  return menu;
}
