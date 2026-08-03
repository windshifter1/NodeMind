import React from 'react';
import { Moon, Sun, X } from 'lucide-react';

export default function SettingsDialog({ open, onClose, nodeTheme, onThemeChange }) {
  if (!open) return null;

  const options = [
    { value: 'light', label: 'Light Theme', icon: Sun },
    { value: 'dark', label: 'Dark Theme', icon: Moon },
  ];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{
        paddingTop: 'calc(var(--app-bleed-y, 0px) + 1rem + var(--safe-top))',
        paddingRight: 'calc(var(--app-bleed-x, 0px) + 1rem + var(--safe-right))',
        paddingBottom: 'calc(var(--app-bleed-y, 0px) + 1rem + var(--safe-bottom))',
        paddingLeft: 'calc(var(--app-bleed-x, 0px) + 1rem + var(--safe-left))',
      }}
    >
      <div className="absolute inset-0 bg-nm-overlay backdrop-blur-md" onClick={onClose} />
      <div
        className="relative flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-nm-border bg-nm-panel shadow-2xl"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-nm-border bg-nm-header px-3 py-3 sm:px-4">
          <h2 className="text-sm font-semibold text-nm-text">Settings</h2>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-nm-text-faint transition hover:bg-nm-hover hover:text-nm-text active:scale-95"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid min-h-64 grid-cols-[8rem_1fr] overflow-hidden">
          <aside className="border-r border-nm-border bg-nm-sidebar p-3">
            <button className="w-full rounded-xl bg-nm-hover px-3 py-2 text-left text-sm font-medium text-nm-text">
              Style
            </button>
          </aside>

          <section className="overflow-auto p-4">
            <h3 className="text-sm font-semibold text-nm-text">Style</h3>
            <p className="mt-1 text-xs text-nm-text-muted">Choose how notes and application windows are displayed.</p>
            <div className="mt-4 grid gap-2">
              {options.map(({ value, label, icon: Icon }) => {
                const selected = nodeTheme === value;
                return (
                  <button
                    key={value}
                    onClick={() => onThemeChange(value)}
                    className="flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition hover:bg-nm-hover"
                    style={{
                      backgroundColor: selected ? 'rgba(99,102,241,0.18)' : 'var(--nm-option)',
                      borderColor: selected ? '#818cf8' : 'var(--nm-border)',
                      color: selected ? 'var(--nm-text)' : 'var(--nm-option-text)',
                    }}
                  >
                    <Icon size={18} />
                    <span className="text-sm font-medium">{label}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
