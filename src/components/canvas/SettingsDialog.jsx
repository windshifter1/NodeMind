import React, { useEffect, useState } from 'react';
import { AlertTriangle, Moon, RotateCcw, Sun, Trash2, X } from 'lucide-react';
import OptionHelpRow from './OptionHelpRow';
import {
  readOnboardingReplayPending,
  setOnboardingCompleted,
  setOnboardingReplayPending,
} from '@/lib/onboarding';
import { emitTutorial } from '@/lib/tutorialEvents';
import { UI_STYLE_OPTIONS } from '@/lib/uiStyle';

const REPLAY_HELP =
  'Resets the first-run flag. After the tour shows again, this option turns itself off automatically.';

export default function SettingsDialog({
  open,
  onClose,
  nodeTheme,
  onThemeChange,
  uiStyle,
  onUiStyleChange,
  workspaceCount = 1,
  onDeleteAllWorkspaces,
}) {
  const [section, setSection] = useState('style');
  const [replayPending, setReplayPending] = useState(() => readOnboardingReplayPending());
  const [confirmWipe, setConfirmWipe] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReplayPending(readOnboardingReplayPending());
    setConfirmWipe(false);
  }, [open]);

  useEffect(() => {
    setConfirmWipe(false);
  }, [section]);

  if (!open) return null;

  const themeOptions = [
    { value: 'light', label: 'Light Theme', icon: Sun },
    { value: 'dark', label: 'Dark Theme', icon: Moon },
  ];

  const setReplay = (enabled) => {
    setReplayPending(enabled);
    setOnboardingReplayPending(enabled);
    if (enabled) {
      setOnboardingCompleted(false);
    }
  };

  const wipeLabel =
    workspaceCount === 1 ? '1 workspace' : `${workspaceCount} workspaces`;

  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center"
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
              { id: 'danger', label: 'Danger' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                data-onboarding={item.id === 'help' ? 'settings-help' : undefined}
                onClick={() => {
                  setSection(item.id);
                  if (item.id === 'help') emitTutorial('settings.replay.find');
                }}
                className={`mb-1 w-full rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                  section === item.id
                    ? item.id === 'danger'
                      ? 'bg-rose-500/15 text-rose-400'
                      : 'bg-nm-hover text-nm-text'
                    : item.id === 'danger'
                      ? 'text-rose-400/80 hover:bg-rose-500/10 hover:text-rose-400'
                      : 'text-nm-text-secondary hover:bg-nm-hover/60 hover:text-nm-text'
                }`}
              >
                {item.label}
              </button>
            ))}
          </aside>

          <section className="overflow-auto p-4">
            {section === 'style' && (
              <div className="space-y-6">
                <div data-onboarding="settings-ui-style">
                  <h3 className="text-sm font-semibold text-nm-text">Interface style</h3>
                  <p className="mt-1 text-xs text-nm-text-muted">
                    Complete chrome overhauls. Glass styles share liquid motion; the rest are independent materials.
                  </p>
                  <div className="mt-4 grid gap-2">
                    {UI_STYLE_OPTIONS.map(({ value, label, blurb }) => {
                      const selected = uiStyle === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => {
                            if (value !== uiStyle) emitTutorial('settings.ui-style');
                            onUiStyleChange(value);
                          }}
                          className="flex flex-col items-start gap-0.5 rounded-xl border px-3 py-3 text-left transition hover:bg-nm-hover"
                          style={{
                            backgroundColor: selected ? 'rgba(99,102,241,0.18)' : 'var(--nm-option)',
                            borderColor: selected ? '#818cf8' : 'var(--nm-border)',
                            color: selected ? 'var(--nm-text)' : 'var(--nm-option-text)',
                          }}
                        >
                          <span className="text-sm font-medium">{label}</span>
                          <span className="text-[11px] leading-snug opacity-75">{blurb}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div data-onboarding="settings-theme">
                  <h3 className="text-sm font-semibold text-nm-text">Theme</h3>
                  <p className="mt-1 text-xs text-nm-text-muted">
                    Light or dark colour palette. Each interface style keeps its own material.
                  </p>
                  <div className="mt-4 grid gap-2">
                    {themeOptions.map(({ value, label, icon: Icon }) => {
                      const selected = nodeTheme === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => {
                            if (value !== nodeTheme) emitTutorial('settings.theme');
                            onThemeChange(value);
                          }}
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
                </div>
              </div>
            )}

            {section === 'help' && (
              <div data-onboarding="settings-help">
                <h3 className="text-sm font-semibold text-nm-text">Help</h3>
                <p className="mt-1 text-xs text-nm-text-muted">
                  First-run guidance for desktop and mobile. Enabling replay does not start the tour
                  now — it runs automatically the next time you reload. Open the Terminal and run{' '}
                  <span className="font-mono text-nm-text">tutorial</span> for an interactive
                  command walkthrough.
                </p>

                <div className="mt-4">
                  <OptionHelpRow
                    icon={RotateCcw}
                    label="Replay Onboarding on Next Reload"
                    compactLabel
                    selected={replayPending}
                    onToggle={() => setReplay(!replayPending)}
                    helpText={REPLAY_HELP}
                  />
                </div>
              </div>
            )}

            {section === 'danger' && (
              <div>
                <h3 className="text-sm font-semibold text-nm-text">Danger</h3>
                <p className="mt-1 text-xs text-nm-text-muted">
                  Permanent actions. They cannot be undone.
                </p>

                <div className="mt-4 rounded-xl border border-rose-500/35 bg-rose-500/10 p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0 text-rose-400" />
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-nm-text">Delete all workspaces</h4>
                      <p className="mt-1 text-xs leading-relaxed text-nm-text-muted">
                        Removes every workspace, including the Tutorial board, and starts a blank canvas.
                        Currently {wipeLabel}.
                      </p>
                    </div>
                  </div>

                  {!confirmWipe ? (
                    <button
                      type="button"
                      onClick={() => setConfirmWipe(true)}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/15 px-3 py-2.5 text-sm font-medium text-rose-400 transition hover:bg-rose-500/25 active:scale-[0.98]"
                    >
                      <Trash2 size={16} />
                      Delete all workspaces
                    </button>
                  ) : (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-medium text-rose-300">
                        Permanently delete {wipeLabel}? This cannot be undone.
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmWipe(false)}
                          className="flex-1 rounded-xl border border-nm-border px-3 py-2 text-sm font-medium text-nm-text-secondary transition hover:bg-nm-hover hover:text-nm-text"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteAllWorkspaces?.();
                            setConfirmWipe(false);
                          }}
                          className="flex-1 rounded-xl bg-rose-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-rose-400 active:scale-[0.98]"
                        >
                          Yes, delete all
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
