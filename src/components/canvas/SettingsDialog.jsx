import React, { useEffect, useState } from 'react';
import { Moon, Sun, X } from 'lucide-react';
import {
  readOnboardingReplayPending,
  setOnboardingCompleted,
  setOnboardingReplayPending,
} from '@/lib/onboarding';

export default function SettingsDialog({ open, onClose, nodeTheme, onThemeChange }) {
  const [section, setSection] = useState('style');
  const [replayPending, setReplayPending] = useState(() => readOnboardingReplayPending());

  useEffect(() => {
    if (!open) return;
    setReplayPending(readOnboardingReplayPending());
  }, [open]);

  if (!open) return null;

  const themeOptions = [
    { value: 'light', label: 'Light Theme', icon: Sun },
    { value: 'dark', label: 'Dark Theme', icon: Moon },
  ];

  const setReplay = (enabled) => {
    setReplayPending(enabled);
    setOnboardingReplayPending(enabled);
    if (enabled) {
      // Clear completion so the tour runs on the next reload.
      setOnboardingCompleted(false);
    }
  };

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
            {[
              { id: 'style', label: 'Style' },
              { id: 'help', label: 'Help' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`mb-1 w-full rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                  section === item.id
                    ? 'bg-nm-hover text-nm-text'
                    : 'text-nm-text-secondary hover:bg-nm-hover/60 hover:text-nm-text'
                }`}
              >
                {item.label}
              </button>
            ))}
          </aside>

          <section className="overflow-auto p-4">
            {section === 'style' && (
              <>
                <h3 className="text-sm font-semibold text-nm-text">Style</h3>
                <p className="mt-1 text-xs text-nm-text-muted">
                  Choose how notes and application windows are displayed.
                </p>
                <div className="mt-4 grid gap-2">
                  {themeOptions.map(({ value, label, icon: Icon }) => {
                    const selected = nodeTheme === value;
                    return (
                      <button
                        key={value}
                        type="button"
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
              </>
            )}

            {section === 'help' && (
              <>
                <h3 className="text-sm font-semibold text-nm-text">Help</h3>
                <p className="mt-1 text-xs text-nm-text-muted">
                  First-run guidance for desktop and mobile. Enabling replay does not start the tour
                  now — it runs automatically the next time you reload.
                </p>

                <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-nm-border bg-nm-option px-3 py-3 transition hover:bg-nm-hover">
                  <input
                    type="checkbox"
                    checked={replayPending}
                    onChange={(e) => setReplay(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-nm-border accent-indigo-500"
                  />
                  <span>
                    <span className="block text-sm font-medium text-nm-text">
                      Replay Onboarding on Next Reload
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-nm-text-muted">
                      Resets the first-run flag. After the tour shows again, this option turns itself
                      off automatically.
                    </span>
                  </span>
                </label>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
