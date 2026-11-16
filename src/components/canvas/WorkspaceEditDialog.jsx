import React, { useState, useEffect, useRef } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import {
  GRAPH_ORIENTATIONS,
  LAYOUT_DENSITIES,
  LAYOUT_ON_ORIENTATION_CHANGE,
  layoutSettingsForDensity,
  normalizeLayoutOnOrientationChange,
  normalizeLayoutSettings,
  normalizeOrientation,
} from '@/lib/canvasConstants';
import { WORKSPACE_COLORS, normalizeWorkspaceIconId } from '@/lib/workspaceIcons';
import WorkspaceColourPicker from '@/components/shell/WorkspaceColourPicker';
import WorkspaceIcon from '@/components/shell/WorkspaceIcon';
import { isDesktopPlatform } from '@/lib/onboarding';
import { emitTutorial } from '@/lib/tutorialEvents';
import LucideIconPicker from '@/components/shell/LucideIconPicker';
import {
  SettingsDialogFrame,
  SettingsFooter,
  SettingsRow,
  SettingsSection,
  SettingsSegmented,
} from '@/components/settings/SettingsChrome';

function OrientationIcon({ orientation, colour, className = 'h-[15px] w-[15px] shrink-0' }) {
  const vertical = orientation === GRAPH_ORIENTATIONS.VERTICAL;
  const nodes = vertical
    ? [
        { cx: 18, cy: 9 },
        { cx: 18, cy: 22 },
        { cx: 18, cy: 35 },
      ]
    : [
        { cx: 7, cy: 22 },
        { cx: 18, cy: 22 },
        { cx: 29, cy: 22 },
      ];

  return (
    <svg viewBox="0 0 36 44" className={className} fill="none" aria-hidden="true" style={{ color: colour }}>
      <path
        d={vertical ? 'M18 13V31' : 'M11 22H25'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {nodes.map((node, index) => (
        <circle key={index} cx={node.cx} cy={node.cy} r="4.5" fill="currentColor" />
      ))}
    </svg>
  );
}

export default function WorkspaceEditDialog({ workspace, open, onClose, onSave, onDelete, mode = 'edit' }) {
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [customDensityOpen, setCustomDensityOpen] = useState(false);
  const [name, setName] = useState('');
  const [colour, setColour] = useState(WORKSPACE_COLORS[0]);
  const [icon, setIcon] = useState('sticky-note');
  const [orientation, setOrientation] = useState(GRAPH_ORIENTATIONS.HORIZONTAL);
  const [layoutOnOrientationChange, setLayoutOnOrientationChange] = useState(
    LAYOUT_ON_ORIENTATION_CHANGE.PRESERVE,
  );
  const [layoutSettings, setLayoutSettings] = useState(() => normalizeLayoutSettings());
  const generalSectionRef = useRef(null);
  const appearanceDrawerRef = useRef(null);
  const densityDrawerRef = useRef(null);

  const resetDrawers = () => {
    setAppearanceOpen(false);
    setCustomDensityOpen(false);
  };

  useEffect(() => {
    if (!open) {
      resetDrawers();
      return;
    }
    if (workspace) {
      setName(workspace.name || '');
      setColour(workspace.colour || WORKSPACE_COLORS[0]);
      setIcon(normalizeWorkspaceIconId(workspace.icon));
      setOrientation(normalizeOrientation(workspace.orientation));
      setLayoutOnOrientationChange(normalizeLayoutOnOrientationChange(workspace.layoutOnOrientationChange));
      setLayoutSettings(normalizeLayoutSettings(workspace.layoutSettings));
    }
  }, [workspace, open]);

  useEffect(() => {
    if (!open) return undefined;
    const drawerEl = appearanceOpen
      ? appearanceDrawerRef.current
      : customDensityOpen
        ? densityDrawerRef.current
        : null;
    if (!drawerEl) return undefined;

    const scroller = drawerEl.closest('.nm-ws-edit-scroll');
    if (!scroller) return undefined;

    const scrollTargetEl =
      appearanceOpen && generalSectionRef.current ? generalSectionRef.current : drawerEl;

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const GLIDE_MS = 280;

    const centerScrollForTarget = () => {
      const scrollRect = scroller.getBoundingClientRect();
      const blockRect = scrollTargetEl.getBoundingClientRect();
      const blockTopInContent = scroller.scrollTop + (blockRect.top - scrollRect.top);
      const max = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      const pad = 12;
      let target;
      if (blockRect.height <= scroller.clientHeight - pad * 2) {
        const centerY = blockTopInContent + blockRect.height / 2;
        target = centerY - scroller.clientHeight / 2;
      } else {
        target = blockTopInContent - pad;
      }
      return Math.max(0, Math.min(target, max));
    };

    const easeGlide = (t) => 1 - (1 - t) ** 2.65;

    if (reducedMotion) {
      scroller.scrollTop = centerScrollForTarget();
      return undefined;
    }

    const startScroll = scroller.scrollTop;
    const t0 = performance.now();
    let raf = 0;

    const tick = (now) => {
      const raw = Math.min(1, (now - t0) / GLIDE_MS);
      const eased = easeGlide(raw);
      const goal = centerScrollForTarget();
      scroller.scrollTop = startScroll + (goal - startScroll) * eased;
      if (raw < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open, appearanceOpen, customDensityOpen]);

  if (!open || !workspace) return null;

  const updateLayoutSetting = (key, value) => {
    setLayoutSettings((current) =>
      normalizeLayoutSettings({
        ...current,
        [key]: value,
        density: LAYOUT_DENSITIES.CUSTOM,
      }),
    );
  };

  const close = () => {
    resetDrawers();
    if (mode === 'edit') emitTutorial('workspace.edit.close');
    onClose();
  };

  const save = () => {
    const nextName = name.trim() || 'Untitled';
    const patch = {
      name: nextName,
      colour,
      icon: normalizeWorkspaceIconId(icon),
      orientation,
      layoutOnOrientationChange,
      layoutSettings,
    };
    onSave(workspace.id, patch);
    resetDrawers();
    if (mode === 'create') {
      emitTutorial('workspace.create.save');
      onClose();
      return;
    }
    emitTutorial('workspace.edit.close');
    onClose();
  };

  const toggleAppearance = () => {
    setAppearanceOpen((open) => !open);
    if (!appearanceOpen) setCustomDensityOpen(false);
  };

  const onDensityChange = (value) => {
    if (value === LAYOUT_DENSITIES.CUSTOM) {
      if (layoutSettings.density === LAYOUT_DENSITIES.CUSTOM && customDensityOpen) {
        setCustomDensityOpen(false);
        return;
      }
      setLayoutSettings((current) =>
        normalizeLayoutSettings({ ...current, density: LAYOUT_DENSITIES.CUSTOM }),
      );
      setCustomDensityOpen(true);
      setAppearanceOpen(false);
      return;
    }
    setLayoutSettings(layoutSettingsForDensity(value));
    setCustomDensityOpen(false);
  };

  const densityValue =
    layoutSettings.density === LAYOUT_DENSITIES.CUSTOM
      ? LAYOUT_DENSITIES.CUSTOM
      : layoutSettings.density;

  const pageTitle = mode === 'create' ? 'New canvas' : 'Canvas Settings';

  return (
    <SettingsDialogFrame open onClose={close} panelClassName="nm-ws-edit-panel max-w-lg">
      <header className="nm-ws-edit-chrome">
        <h2 className="nm-ws-edit-chrome__title">{pageTitle}</h2>
      </header>

      <div className="nm-ws-edit-scroll nm-scrollbar">
        <div ref={generalSectionRef} className="nm-ws-edit-general">
          <h3 className="nm-ws-edit-section__title">General</h3>
          <div className="nm-ws-edit-top-row">
            <button
              type="button"
              className={`nm-ws-edit-card nm-ws-edit-card--appearance ${appearanceOpen ? 'is-on' : ''}`}
              style={{ borderColor: appearanceOpen ? colour : undefined }}
              aria-label="Canvas colour and icon"
              aria-expanded={appearanceOpen}
              onClick={toggleAppearance}
            >
              <span
                className="nm-ws-edit-appearance__colour"
                style={{ backgroundColor: colour }}
                aria-hidden
              />
              <span
                className="nm-ws-edit-appearance__icon"
                style={{
                  backgroundColor: `${colour}18`,
                  color: colour,
                }}
              >
                <WorkspaceIcon icon={icon} colour={colour} size={20} strokeWidth={1.75} />
              </span>
            </button>

            <div className="nm-ws-edit-card nm-ws-edit-card--name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && save()}
                placeholder="Untitled"
                autoFocus={isDesktopPlatform()}
                className="nm-ws-edit-name-input"
                aria-label="Canvas name"
              />
            </div>
          </div>

          <div
            ref={appearanceDrawerRef}
            className={`nm-ws-edit-card nm-ws-edit-glide ${appearanceOpen ? 'is-open' : ''}`}
            aria-hidden={!appearanceOpen}
          >
            <div className="nm-ws-edit-glide__inner nm-ws-edit-appearance-panel">
              <WorkspaceColourPicker value={colour} onChange={setColour} compact />
              <div className="nm-ws-edit-appearance-panel__divider" role="separator" />
              <LucideIconPicker
                value={icon}
                onChange={setIcon}
                accentColour={colour}
                fullWidth
                compact
              />
            </div>
          </div>
        </div>

        <hr className="nm-ws-edit-section-divider" />

        <div className="nm-ws-edit-layout">
          <h3 className="nm-ws-edit-section__title">Layout</h3>
          <div className="nm-ws-edit-layout-stack">
          <div className="nm-ws-edit-card nm-ws-edit-card--flat">
            <SettingsSection>
              <SettingsRow label="Direction">
                <SettingsSegmented
                  accentColour={colour}
                  options={[
                    {
                      value: GRAPH_ORIENTATIONS.HORIZONTAL,
                      label: 'Horizontal',
                      icon: ({ active, accentColour: accent }) => (
                        <OrientationIcon
                          orientation={GRAPH_ORIENTATIONS.HORIZONTAL}
                          colour={active ? accent : undefined}
                        />
                      ),
                    },
                    {
                      value: GRAPH_ORIENTATIONS.VERTICAL,
                      label: 'Vertical',
                      icon: ({ active, accentColour: accent }) => (
                        <OrientationIcon
                          orientation={GRAPH_ORIENTATIONS.VERTICAL}
                          colour={active ? accent : undefined}
                        />
                      ),
                    },
                  ]}
                  value={orientation}
                  onChange={setOrientation}
                />
              </SettingsRow>
              <SettingsRow label="On orientation change">
                <SettingsSegmented
                  accentColour={colour}
                  options={[
                    { value: LAYOUT_ON_ORIENTATION_CHANGE.PRESERVE, label: 'Preserve' },
                    { value: LAYOUT_ON_ORIENTATION_CHANGE.AUTO, label: 'Auto' },
                  ]}
                  value={layoutOnOrientationChange}
                  onChange={setLayoutOnOrientationChange}
                />
              </SettingsRow>
              <SettingsRow label="Density">
                <SettingsSegmented
                  accentColour={colour}
                  options={[
                    { value: LAYOUT_DENSITIES.COMPACT, label: 'Compact' },
                    { value: LAYOUT_DENSITIES.DEFAULT, label: 'Default' },
                    { value: LAYOUT_DENSITIES.SPACIOUS, label: 'Spacious' },
                    { value: LAYOUT_DENSITIES.CUSTOM, label: 'Custom' },
                  ]}
                  value={densityValue}
                  onChange={onDensityChange}
                />
              </SettingsRow>
            </SettingsSection>
          </div>

          <div
            ref={densityDrawerRef}
            className={`nm-ws-edit-card nm-ws-edit-glide ${customDensityOpen ? 'is-open' : ''}`}
            aria-hidden={!customDensityOpen}
          >
            <div className="nm-ws-edit-glide__inner nm-ws-edit-density-panel">
              <div className="grid w-full grid-cols-3 gap-2">
                {[
                  { key: 'horizontalSpacing', label: 'Horizontal' },
                  { key: 'verticalSpacing', label: 'Vertical' },
                  { key: 'graphSpacing', label: 'Graphs' },
                ].map((field) => (
                  <label key={field.key} className="text-xs text-nm-text-muted">
                    {field.label}
                    <input
                      type="number"
                      min="40"
                      step="10"
                      value={layoutSettings[field.key]}
                      onChange={(e) => updateLayoutSetting(field.key, e.target.value)}
                      className="nm-settings-input mt-1 w-full max-w-none"
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>

      <SettingsFooter
        leading={
          mode === 'edit' ? (
            <button
              type="button"
              onClick={() => {
                onDelete?.(workspace);
                close();
              }}
              className="text-sm font-medium text-rose-500 hover:text-rose-400"
            >
              Delete canvas
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-nm-text-muted">
              <SlidersHorizontal size={14} />
              Layout defaults apply to this canvas only
            </span>
          )
        }
        trailing={
          <>
            <button type="button" onClick={close} className="nm-settings-segmented__btn">
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              className="nm-settings-segmented__btn is-on"
              style={{
                borderColor: colour,
                backgroundColor: colour,
                color: '#fff',
              }}
            >
              Save
            </button>
          </>
        }
      />
    </SettingsDialogFrame>
  );
}