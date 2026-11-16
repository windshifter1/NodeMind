import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Database,
  Download,
  Eye,
  Monitor,
  Moon,
  RotateCcw,
  Sun,
  Trash2,
  Upload,
} from 'lucide-react';
import OptionHelpRow from './OptionHelpRow';
import {
  readOnboardingReplayPending,
  setOnboardingCompleted,
  setOnboardingReplayPending,
} from '@/lib/onboarding';
import { emitTutorial } from '@/lib/tutorialEvents';
import { estimateStorage, formatBytes } from '@/lib/workspaceStore';
import {
  SettingsDialogBody,
  SettingsDialogFrame,
  SettingsNavGroup,
  SettingsNavItem,
  SettingsNavSearch,
  SettingsPage,
  SettingsRow,
  SettingsSection,
  SettingsSegmented,
} from '@/components/settings/SettingsChrome';

const REPLAY_HELP =
  'Resets the first-run flag. After the tour shows again, this option turns itself off automatically.';

const NAV = [
  { id: 'style', label: 'Appearance', icon: Sun, group: 'Preferences' },
  { id: 'a11y', label: 'Accessibility', icon: Eye, group: 'Preferences' },
  { id: 'data', label: 'Data & backup', icon: Database, group: 'Workspace' },
  { id: 'help', label: 'Help', icon: RotateCcw, group: 'Workspace' },
  { id: 'danger', label: 'Danger zone', icon: AlertTriangle, group: 'Workspace', danger: true },
];

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
  const [navQuery, setNavQuery] = useState('');
  const [replayPending, setReplayPending] = useState(() => readOnboardingReplayPending());
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [estimate, setEstimate] = useState(null);
  const backupInputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setReplayPending(readOnboardingReplayPending());
    setConfirmWipe(false);
    setNavQuery('');
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

  const filteredNav = useMemo(() => {
    const q = navQuery.trim().toLowerCase();
    if (!q) return NAV;
    return NAV.filter((item) => item.label.toLowerCase().includes(q));
  }, [navQuery]);

  const navGroups = useMemo(() => {
    const map = new Map();
    filteredNav.forEach((item) => {
      const g = item.group || 'General';
      if (!map.has(g)) map.set(g, []);
      map.get(g).push(item);
    });
    return [...map.entries()];
  }, [filteredNav]);

  if (!open) return null;

  const wipeLabel = workspaceCount === 1 ? '1 canvas' : `${workspaceCount} canvases`;

  const setReplay = (enabled) => {
    setReplayPending(enabled);
    setOnboardingReplayPending(enabled);
    if (enabled) setOnboardingCompleted(false);
  };

  const themeOptions = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ];

  return (
    <SettingsDialogFrame open onClose={onClose}>
      <SettingsDialogBody
        sidebar={
          <>
            <SettingsNavSearch value={navQuery} onChange={setNavQuery} />
            {navGroups.map(([group, items]) => (
              <SettingsNavGroup key={group} label={group}>
                {items.map((item) => (
                  <SettingsNavItem
                    key={item.id}
                    icon={item.icon}
                    label={item.label}
                    danger={item.danger}
                    active={section === item.id}
                    data-onboarding={item.id === 'help' ? 'settings-help' : undefined}
                    onClick={() => {
                      setSection(item.id);
                      if (item.id === 'help') emitTutorial('settings.replay.find');
                    }}
                  />
                ))}
              </SettingsNavGroup>
            ))}
          </>
        }
      >
        {section === 'style' && (
          <SettingsPage
            title="Appearance"
            description="Choose how Noded looks and how dense the chrome feels around your canvas."
          >
            <SettingsSection title="Theme">
              <SettingsRow
                label="Color mode"
                description="Light is the default. System follows this device."
              >
                <div data-onboarding="settings-theme" className="contents">
                <SettingsSegmented
                  options={themeOptions}
                  value={nodeTheme}
                  onChange={(value) => {
                    if (value !== nodeTheme) emitTutorial('settings.theme');
                    onThemeChange(value);
                  }}
                />
                </div>
              </SettingsRow>
              <SettingsRow label="Density" description="Compact tightens toolbars, sidebar, and panels.">
                <SettingsSegmented
                  options={[
                    { value: 'default', label: 'Default' },
                    { value: 'compact', label: 'Compact' },
                  ]}
                  value={density}
                  onChange={onDensityChange}
                />
              </SettingsRow>
            </SettingsSection>
          </SettingsPage>
        )}

        {section === 'a11y' && (
          <SettingsPage
            title="Accessibility"
            description="Type size and contrast apply on this device and persist locally."
          >
            <SettingsSection>
              <SettingsRow label="Font size" description="Scales chrome, dialogs, and node text.">
                <SettingsSegmented
                  options={[
                    { value: 'default', label: 'Default' },
                    { value: 'large', label: 'Large' },
                    { value: 'xl', label: 'Extra large' },
                  ]}
                  value={a11yFont}
                  onChange={onA11yFontChange}
                />
              </SettingsRow>
              <SettingsRow
                label="Contrast"
                description="High contrast strengthens text, borders, and the canvas grid."
              >
                <SettingsSegmented
                  options={[
                    { value: 'default', label: 'Default' },
                    { value: 'high', label: 'High' },
                  ]}
                  value={a11yContrast}
                  onChange={onA11yContrastChange}
                />
              </SettingsRow>
            </SettingsSection>
          </SettingsPage>
        )}

        {section === 'data' && (
          <SettingsPage
            title="Data & backup"
            description="Canvases stay on this device in IndexedDB. Export before clearing browser data."
          >
            <SettingsSection>
              <SettingsRow label="Device name" description="Nearby sessions see this name when you share a canvas.">
                <input
                  value={deviceName}
                  onChange={(e) => onDeviceNameChange?.(e.target.value)}
                  maxLength={32}
                  className="nm-settings-input"
                />
              </SettingsRow>
              <SettingsRow label="Last saved">
                <span className="text-sm text-nm-text">
                  {persistStatus.lastSavedAt
                    ? new Date(persistStatus.lastSavedAt).toLocaleString()
                    : 'Not yet'}
                </span>
              </SettingsRow>
              <SettingsRow label="Storage for this site">
                <span className="text-sm text-nm-text">
                  {estimate ? `${formatBytes(estimate.usage)} of ${formatBytes(estimate.quota)}` : 'Measuring…'}
                </span>
              </SettingsRow>
              <SettingsRow label="Persistent storage">
                <span className="text-sm text-nm-text">
                  {persistStatus.persisted ? 'Requested' : 'Browser default'}
                </span>
              </SettingsRow>
            </SettingsSection>

            {persistStatus.lastError ? (
              <p className="mt-2 rounded-lg border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
                {persistStatus.lastError}
              </p>
            ) : null}

            <SettingsSection title="Backup">
              <SettingsRow label="Export" description="Zip of canvases and loaded files.">
                <button
                  type="button"
                  onClick={() => onExportAll?.()}
                  className="nm-settings-segmented__btn"
                >
                  <Download size={15} />
                  Export
                </button>
              </SettingsRow>
              <SettingsRow label="Import" description="Skips canvases that already match by name and contents.">
                <button
                  type="button"
                  onClick={() => backupInputRef.current?.click()}
                  className="nm-settings-segmented__btn"
                >
                  <Upload size={15} />
                  Import
                </button>
              </SettingsRow>
            </SettingsSection>
            <input
              ref={backupInputRef}
              type="file"
              accept="application/zip,.zip,application/json,.json"
              className="hidden"
              onChange={onImportBackup}
            />
          </SettingsPage>
        )}

        {section === 'help' && (
          <SettingsPage
            title="Help"
            description="First-run guidance for desktop and mobile. Open Terminal and run tutorial for commands."
          >
            <div data-onboarding="settings-help" className="nm-settings-section__rows">
              <OptionHelpRow
                icon={RotateCcw}
                label="Replay onboarding on next reload"
                compactLabel
                selected={replayPending}
                onToggle={() => setReplay(!replayPending)}
                helpText={REPLAY_HELP}
              />
            </div>
          </SettingsPage>
        )}

        {section === 'danger' && (
          <SettingsPage title="Danger zone" description="Permanent actions. They cannot be undone.">
            <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-rose-400" />
                <div className="min-w-0">
                  <h4 className="text-sm font-medium text-nm-text">Delete all canvases</h4>
                  <p className="mt-1 text-xs leading-relaxed text-nm-text-muted">
                    Removes every canvas, including the Tutorial board and attached files, and starts a
                    blank canvas. Currently {wipeLabel}.
                  </p>
                </div>
              </div>

              {!confirmWipe ? (
                <button
                  type="button"
                  onClick={() => setConfirmWipe(true)}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-2.5 text-sm font-medium text-rose-400 transition hover:bg-rose-500/25"
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
                      className="flex-1 rounded-lg border border-nm-border px-3 py-2 text-sm font-medium text-nm-text-secondary hover:bg-nm-hover"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteAllWorkspaces?.();
                        setConfirmWipe(false);
                      }}
                      className="flex-1 rounded-lg bg-rose-500 px-3 py-2 text-sm font-medium text-white hover:bg-rose-400"
                    >
                      Yes, delete all
                    </button>
                  </div>
                </div>
              )}
            </div>
          </SettingsPage>
        )}
      </SettingsDialogBody>
    </SettingsDialogFrame>
  );
}