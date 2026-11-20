import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  onClose,
  onConfirm,
}) {
  if (!open) return null;

  return (
    <div className="nm-dialog-root">
      <div className="nm-dialog-overlay" onClick={onClose} />
      <div
        className="nm-dialog-panel max-w-sm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="nm-confirm-title"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="nm-dialog-head">
          <h2 id="nm-confirm-title">{title}</h2>
          <div className="flex-1" />
          <button type="button" onClick={onClose} className="nm-dialog-close" title="Close">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>
        <div className="px-4 py-4 sm:px-5">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-rose-400" />
            <p className="text-sm leading-relaxed text-nm-text-muted">{body}</p>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-nm-border px-3 py-2 text-sm font-medium text-nm-text-secondary transition hover:bg-nm-hover hover:text-nm-text"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="flex-1 rounded-lg bg-rose-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-rose-400 active:scale-[0.98]"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
