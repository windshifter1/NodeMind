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
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{
        paddingTop: 'calc(1rem + var(--safe-top))',
        paddingRight: 'calc(1rem + var(--safe-right))',
        paddingBottom: 'calc(1rem + var(--safe-bottom))',
        paddingLeft: 'calc(1rem + var(--safe-left))',
      }}
    >
      <div className="absolute inset-0 bg-nm-overlay backdrop-blur-md" onClick={onClose} />
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-nm-border bg-nm-panel shadow-2xl"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-nm-border bg-nm-header px-4 py-3">
          {Icon ? <Icon size={16} className="shrink-0 text-nm-text-muted" /> : null}
          <p className="min-w-0 flex-1 text-sm font-medium text-nm-text">{title}</p>
          <button
            type="button"
            title="Close"
            onClick={onClose}
            className="rounded-lg p-1.5 text-nm-text-faint transition hover:bg-nm-hover hover:text-nm-text active:scale-95"
          >
            <X size={16} />
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
                className="flex w-full items-start gap-3 rounded-xl border border-nm-border bg-nm-option px-3 py-3 text-left transition hover:bg-nm-hover active:scale-[0.99]"
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
