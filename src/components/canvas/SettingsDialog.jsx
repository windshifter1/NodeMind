import React from 'react';
import { Moon, Sun, X } from 'lucide-react';

export default function SettingsDialog({ open, onClose, nodeTheme, onThemeChange }) {
  if (!open) return null;

  const options = [
    { value: 'light', label: 'Light Theme', icon: Sun },
    { value: 'dark', label: 'Dark Theme', icon: Moon },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-md" onClick={onClose} />
      <div
        className="relative flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-white/10 bg-white/5 px-3 py-3 sm:px-4">
          <h2 className="text-sm font-semibold text-zinc-100">Settings</h2>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-white/70 transition hover:bg-white/10 hover:text-white active:scale-95"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid min-h-64 grid-cols-[8rem_1fr] overflow-hidden">
          <aside className="border-r border-white/10 bg-white/[0.03] p-3">
            <button className="w-full rounded-xl bg-white/10 px-3 py-2 text-left text-sm font-medium text-white">
              Style
            </button>
          </aside>

          <section className="overflow-auto p-4">
            <h3 className="text-sm font-semibold text-zinc-100">Style</h3>
            <p className="mt-1 text-xs text-zinc-400">Choose how notes and application windows are displayed.</p>
            <div className="mt-4 grid gap-2">
              {options.map(({ value, label, icon: Icon }) => {
                const selected = nodeTheme === value;
                return (
                  <button
                    key={value}
                    onClick={() => onThemeChange(value)}
                    className="flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition hover:bg-white/10"
                    style={{
                      backgroundColor: selected ? 'rgba(99,102,241,0.18)' : 'rgba(255,255,255,0.03)',
                      borderColor: selected ? '#818cf8' : 'rgba(255,255,255,0.1)',
                      color: selected ? '#ffffff' : '#d4d4d8',
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
