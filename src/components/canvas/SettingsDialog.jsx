import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Download, Monitor, Moon, RotateCcw, Sun, Trash2, Upload, X } from 'lucide-react';
import OptionHelpRow from './OptionHelpRow';
import {
  readOnboardingReplayPending,
  setOnboardingCompleted,
  setOnboardingReplayPending,
} from '@/lib/onboarding';
import { emitTutorial } from '@/lib/tutorialEvents';
import { estimateStorage, formatBytes } from '@/lib/workspaceStore';

const REPLAY_HELP =
  'Resets the first-run flag. After the tour shows again, this option turns itself off automatically.';

export default function SettingsDialog({
  open,
  onClose,
  nodeTheme,
  onThemeChange,
  density = 'default',
  onDensityChange,
  a11yFont = 'default',
  onA11yFontChange,
  a11yContrast = 'default',
  onA11yContrastChange,
  workspaceCount = 1,
  onDeleteAllWorkspaces,
  persistStatus = {},
  onExportAll,
  onImportBackup,
  deviceName = '',
  onDeviceNameChange,
}) {
  const [section, setSection] = useState('style');
  const [replayPending, setReplayPending] = useState(() => readOnboardingReplayPending());
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [estimate, setEstimate] = useState(null);
  const backupInputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setReplayPending(readOnboardingReplayPending());
    setConfirmWipe(false);
  }, [open]);

  useEffect(() => {
    if (!open || section !== 'data') return undefined;
    let cancelled = false;
    estimateStorage().then((next) => {
      if (!cancelled) setEstimate(next);
    });
    return () => {
      cancelled = true;
    };
  }, [open, section, persistStatus.lastSavedAt, persistStatus.lastError]);

  useEffect(() => {
    setConfirmWipe(false);
  }, [section]);

  if (!open) return null;

  const themeOptions = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ];

  const setReplay = (enabled) => {
    setReplayPending(enabled);
    setOnboardingReplayPending(enabled);
    if (enabled) {
      setOnboardingCompleted(false);
    }
  };

  const wipeLabel =
    workspaceCount === 1 ? '1 canvas' : `${workspaceCount} canvases`;

  return (
    <div className="nm-dialog-root">
      <div className="nm-dialog-overlay" onClick={onClose} />
      <div
        className="nm-dialog-panel max-w-md"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="nm-dialog-head">
          <h2>Settings</h2>
          <div className="flex-1" />
          <button type="button" onClick={onClose} className="nm-dialog-close" title="Close">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <div className="grid min-h-64 grid-cols-[8rem_1fr] overflow-hidden">
          <aside className="border-r border-nm-border bg-nm-sidebar p-3">
            {[
              { id: 'style', label: 'Appearance' },
              { id: 'a11y', label: 'Accessibility' },
              { id: 'data', label: 'Data' },
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
                className={`nm-sidebar__item mb-1 w-full ${
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
                <div data-onboarding="settings-theme">
                  <h3 className="text-sm font-semibold text-nm-text">Theme</h3>
                  <p className="mt-1 text-xs text-nm-text-muted">
                    Light is the default. System follows this device.
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
                          className="flex min-h-11 items-center gap-3 rounded-lg border px-3 py-3 text-left transition hover:bg-nm-hover"
                          style={{
                            backgroundColor: selected ? 'color-mix(in srgb, var(--nm-accent) 16%, transparent)' : 'var(--nm-option)',
                            borderColor: selected ? 'var(--nm-accent)' : 'var(--nm-border)',
                            color: 'var(--nm-text)',
                          }}
                        >
                          <Icon size={18} strokeWidth={1.75} />
                          <span className="text-sm font-medium">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-nm-text">Density</h3>
                  <p className="mt-1 text-xs text-nm-text-muted">Compact tightens chrome and panels.</p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {[
                      { value: 'default', label: 'Default' },
                      { value: 'compact', label: 'Compact' },
                    ].map(({ value, label }) => {
                      const selected = density === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => onDensityChange?.(value)}
                          className="min-h-11 rounded-lg border px-3 py-2 text-sm font-medium"
                          style={{
                            backgroundColor: selected ? 'color-mix(in srgb, var(--nm-accent) 16%, transparent)' : 'var(--nm-option)',
                            borderColor: selected ? 'var(--nm-accent)' : 'var(--nm-border)',
                            color: 'var(--nm-text)',
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {section === 'a11y' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-nm-text">Accessibility</h3>
                  <p className="mt-1 text-xs text-nm-text-muted">
                    Type size and contrast apply on this device and persist locally.
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-nm-text">Font size</h3>
                  <p className="mt-1 text-xs text-nm-text-muted">
                    Scales chrome, dialogs, and node text.
                  </p>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {[
                      { value: 'default', label: 'Default' },
                      { value: 'large', label: 'Large' },
                      { value: 'xl', label: 'Extra large' },
                    ].map(({ value, label }) => {
                      const selected = a11yFont === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => onA11yFontChange?.(value)}
                          className="min-h-11 rounded-lg border px-2 py-2 text-sm font-medium"
                          style={{
                            backgroundColor: selected ? 'color-mix(in srgb, var(--nm-accent) 16%, transparent)' : 'var(--nm-option)',
                            borderColor: selected ? 'var(--nm-accent)' : 'var(--nm-border)',
                            color: 'var(--nm-text)',
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-nm-text">Contrast</h3>
                  <p className="mt-1 text-xs text-nm-text-muted">
                    High contrast strengthens text, borders, and the canvas grid.
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {[
                      { value: 'default', label: 'Default' },
                      { value: 'high', label: 'High contrast' },
                    ].map(({ value, label }) => {
                      const selected = a11yContrast === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => onA11yContrastChange?.(value)}
                          className="min-h-11 rounded-lg border px-3 py-2 text-sm font-medium"
                          style={{
                            backgroundColor: selected ? 'color-mix(in srgb, var(--nm-accent) 16%, transparent)' : 'var(--nm-option)',
                            borderColor: selected ? 'var(--nm-accent)' : 'var(--nm-border)',
                            color: 'var(--nm-text)',
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {section === 'data' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-nm-text">Storage</h3>
                  <p className="mt-1 text-xs text-nm-text-muted">
                    Canvases stay on this device in IndexedDB. Export a zip backup (canvases and
                    loaded files) before clearing browser data. Import skips canvases that already
                    match by name and contents.
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-nm-text">This device</h3>
                  <p className="mt-1 text-xs text-nm-text-muted">
                    Nearby Noded sessions see this name when you send a canvas.
                  </p>
                  <input
                    value={deviceName}
                    onChange={(e) => onDeviceNameChange?.(e.target.value)}
                    maxLength={32}
                    className="mt-2 w-full rounded-xl border border-nm-border bg-nm-option px-3 py-2 text-sm text-nm-text outline-none"
                  />
                </div>

                <dl className="space-y-2 text-xs">
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-nm-text-muted">Last saved</dt>
                    <dd className="text-right text-nm-text">
                      {persistStatus.lastSavedAt
                        ? new Date(persistStatus.lastSavedAt).toLocaleString()
                        : 'Not yet'}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-nm-text-muted">This site</dt>
                    <dd className="text-right text-nm-text">
                      {estimate
                        ? `${formatBytes(estimate.usage)} of ${formatBytes(estimate.quota)}`
                        : 'Measuring…'}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-nm-text-muted">Persistent storage</dt>
                    <dd className="text-right text-nm-text">
                      {persistStatus.persisted ? 'Requested' : 'Browser default'}
                    </dd>
                  </div>
                </dl>

                {persistStatus.lastError && (
                  <p className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                    {persistStatus.lastError}
                  </p>
                )}

                <div className="grid gap-2">
                  <button
                    type="button"
                    onClick={() => onExportAll?.()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-nm-border bg-nm-option px-3 py-2.5 text-sm font-medium text-nm-text transition hover:bg-nm-hover"
                  >
                    <Download size={16} />
                    Export backup
                  </button>
                  <button
                    type="button"
                    onClick={() => backupInputRef.current?.click()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-nm-border bg-nm-option px-3 py-2.5 text-sm font-medium text-nm-text transition hover:bg-nm-hover"
                  >
                    <Upload size={16} />
                    Import backup
                  </button>
                </div>
                <input
                  ref={backupInputRef}
                  type="file"
                  accept="application/zip,.zip,application/json,.json"
                  className="hidden"
                  onChange={onImportBackup}
                />
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

                <div className="mt-4 space-y-2">
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
                      <h4 className="text-sm font-semibold text-nm-text">Delete all canvases</h4>
                      <p className="mt-1 text-xs leading-relaxed text-nm-text-muted">
                        Removes every canvas, including the Tutorial board and attached files,
                        and starts a blank canvas. Currently {wipeLabel}.
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
                      Delete all canvases
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
