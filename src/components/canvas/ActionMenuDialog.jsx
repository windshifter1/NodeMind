import React from 'react';
import { X } from 'lucide-react';

/**
 * Choice sheet matching NodeMind dialog chrome (Share / Save menus).
 * actions: { id, label, description?, icon, onClick, hidden? }[]
 */
export default function ActionMenuDialog({
  open,
  onClose,
  title,
  icon: Icon,
  description,
  actions = [],
}) {
  if (!open) return null;

  const visible = actions.filter((action) => !action.hidden);

  return (
    <div className="nm-dialog-root" style={{ zIndex: 100 }}>
      <div className="nm-dialog-overlay" onClick={onClose} />
      <div
        className="nm-dialog-panel max-w-md"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="nm-dialog-head">
          {Icon ? <Icon size={16} className="shrink-0 text-nm-text-muted" /> : null}
          <p className="min-w-0 flex-1">{title}</p>
          <button type="button" title="Close" onClick={onClose} className="nm-dialog-close">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>
        <div className="space-y-3 p-4">
          {description ? <p className="text-sm text-nm-text-secondary">{description}</p> : null}
          <div className="flex flex-col gap-2">
            {visible.map(({ id, label, description: actionDescription, icon: ActionIcon, onClick }) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  onClose();
                  onClick?.();
                }}
                className="flex w-full items-start gap-3 rounded-lg border border-nm-border bg-nm-option px-3 py-3 text-left transition hover:bg-nm-hover"
              >
                {ActionIcon ? (
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-nm-hover text-nm-text">
                    <ActionIcon size={18} />
                  </span>
                ) : null}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-nm-text">{label}</span>
                  {actionDescription ? (
                    <span className="mt-0.5 block text-xs text-nm-text-muted">{actionDescription}</span>
                  ) : null}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
