import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

const MENU_WIDTH = 320;

export default function SelectionOpMenu({ open, x = 0, y = 0, ops = [], onClose, onPick }) {
  const [fieldOp, setFieldOp] = useState(null);
  const [fieldValue, setFieldValue] = useState('');
  /** null = root list; otherwise the submenu item currently shown. */
  const [submenu, setSubmenu] = useState(null);
  const submenuRef = useRef(null);
  submenuRef.current = submenu;

  useEffect(() => {
    if (!open) {
      setFieldOp(null);
      setFieldValue('');
      setSubmenu(null);
      return undefined;
    }
    setSubmenu(null);
    setFieldOp(null);
    setFieldValue('');
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      if (submenuRef.current) {
        setSubmenu(null);
        setFieldOp(null);
        return;
      }
      onClose();
    };
    const onPointer = (e) => {
      if (e.target?.closest?.('[data-selection-op-menu]')) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer, true);
    };
  }, [open, onClose]);

  if (!open) return null;

  const left = Math.max(8, Math.min(x, window.innerWidth - MENU_WIDTH - 8));
  const top = Math.max(8, Math.min(y, window.innerHeight - 80));
  const visibleOps = submenu?.submenu || ops;
  const title = submenu ? submenu.label : 'Apply to selection';

  const choose = (op) => {
    if (op.submenu?.length) {
      setSubmenu(op);
      setFieldOp(null);
      setFieldValue('');
      return;
    }
    if (op.extra?.needsField) {
      setFieldOp(op);
      setFieldValue('');
      return;
    }
    onPick(op, '');
  };

  return (
    <div
      data-selection-op-menu
      className="fixed overflow-hidden rounded-2xl border border-nm-border bg-nm-chrome shadow-xl backdrop-blur-md"
      style={{ left, top, width: MENU_WIDTH, zIndex: 1_000_001, maxHeight: 'min(420px, 70vh)' }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1 border-b border-nm-divider px-3 py-2">
        {submenu && (
          <button
            type="button"
            title="Back"
            onClick={() => {
              setSubmenu(null);
              setFieldOp(null);
            }}
            className="rounded-lg p-1 text-nm-text-faint transition hover:bg-nm-hover hover:text-nm-text active:scale-95"
          >
            <ChevronLeft size={14} />
          </button>
        )}
        <p className="min-w-0 flex-1 text-xs font-medium tracking-wide text-nm-text-muted">{title}</p>
        <button
          type="button"
          title="Close"
          onClick={onClose}
          className="rounded-lg p-1 text-nm-text-faint transition hover:bg-nm-hover hover:text-nm-text active:scale-95"
        >
          <X size={14} />
        </button>
      </div>
      <div className="flex max-h-[380px] min-h-[80px] flex-col gap-1 overflow-y-auto p-2">
        {visibleOps.length === 0 && (
          <p className="px-3 py-2 text-sm text-nm-text-faint">No operations apply to this selection.</p>
        )}
        {visibleOps.map((op) => (
          <div key={op.id}>
            <button
              type="button"
              onClick={() => choose(op)}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-nm-text-secondary transition hover:bg-nm-hover hover:text-nm-text active:scale-[0.98]"
            >
              <span className="min-w-0 flex-1">{op.label}</span>
              {op.submenu?.length ? <ChevronRight size={14} className="shrink-0 opacity-60" /> : null}
            </button>
            {fieldOp?.id === op.id && (
              <form
                className="flex gap-2 px-3 pb-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  onPick(op, fieldValue);
                }}
              >
                <input
                  autoFocus
                  value={fieldValue}
                  onChange={(e) => setFieldValue(e.target.value)}
                  placeholder={op.extra?.fieldPlaceholder || ''}
                  className="min-w-0 flex-1 rounded-lg border border-nm-border bg-black/20 px-2 py-1.5 text-sm text-nm-text outline-none"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-500/40 px-2.5 py-1.5 text-sm font-medium text-indigo-100"
                >
                  Apply
                </button>
              </form>
            )}
          </div>
        ))}
        {submenu && (
          <button
            type="button"
            onClick={() => {
              setSubmenu(null);
              setFieldOp(null);
            }}
            className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-nm-text-faint transition hover:bg-nm-hover hover:text-nm-text"
          >
            Back
          </button>
        )}
      </div>
    </div>
  );
}
