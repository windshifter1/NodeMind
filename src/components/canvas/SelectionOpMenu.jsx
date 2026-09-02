import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

const MENU_WIDTH = 320;

export default function SelectionOpMenu({ open, x = 0, y = 0, ops = [], onClose, onPick }) {
  const [fieldOp, setFieldOp] = useState(null);
  const [fieldValue, setFieldValue] = useState('');

  useEffect(() => {
    if (!open) {
      setFieldOp(null);
      setFieldValue('');
      return undefined;
    }
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
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

  const choose = (op) => {
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
        <p className="min-w-0 flex-1 text-xs font-medium tracking-wide text-nm-text-muted">
          Apply to selection
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
      <div className="flex max-h-[380px] min-h-[80px] flex-col gap-1 overflow-y-auto p-2">
        {ops.length === 0 && (
          <p className="px-3 py-2 text-sm text-nm-text-faint">No operations apply to this selection.</p>
        )}
        {ops.map((op) => (
          <div key={op.id}>
            <button
              type="button"
              onClick={() => choose(op)}
              className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-nm-text-secondary transition hover:bg-nm-hover hover:text-nm-text active:scale-[0.98]"
            >
              {op.label}
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
      </div>
    </div>
  );
}
