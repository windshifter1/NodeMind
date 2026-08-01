import React, { useState, useEffect } from 'react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import {
  GRAPH_ORIENTATIONS,
  LAYOUT_DENSITIES,
  LAYOUT_ON_ORIENTATION_CHANGE,
  normalizeLayoutOnOrientationChange,
  normalizeLayoutSettings,
  normalizeOrientation,
} from '@/lib/canvasConstants';
import { WORKSPACE_ICONS, WORKSPACE_ICON_KEYS, WORKSPACE_COLORS } from '@/lib/workspaceIcons';

function OrientationIcon({ orientation }) {
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
    <svg viewBox="0 0 36 44" className="h-10 w-10" fill="none" aria-hidden="true">
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

function optionStyle(selected, colour) {
  return {
    backgroundColor: selected ? colour + '22' : 'var(--nm-option)',
    borderColor: selected ? colour : 'var(--nm-border)',
    color: selected ? 'var(--nm-text)' : 'var(--nm-option-text)',
  };
}

export default function WorkspaceEditDialog({ workspace, open, onClose, onSave, onDelete, mode = 'edit' }) {
  const [name, setName] = useState('');
  const [colour, setColour] = useState(WORKSPACE_COLORS[0]);
  const [icon, setIcon] = useState('note');
  const [orientation, setOrientation] = useState(GRAPH_ORIENTATIONS.HORIZONTAL);
  const [layoutOnOrientationChange, setLayoutOnOrientationChange] = useState(LAYOUT_ON_ORIENTATION_CHANGE.PRESERVE);
  const [layoutSettings, setLayoutSettings] = useState(() => normalizeLayoutSettings());
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    if (workspace) {
      setName(workspace.name || '');
      setColour(workspace.colour || WORKSPACE_COLORS[0]);
      setIcon(workspace.icon || 'note');
      setOrientation(normalizeOrientation(workspace.orientation));
      setLayoutOnOrientationChange(normalizeLayoutOnOrientationChange(workspace.layoutOnOrientationChange));
      setLayoutSettings(normalizeLayoutSettings(workspace.layoutSettings));
    }
    if (open) setAdvancedOpen(false);
  }, [workspace, open]);

  if (!open || !workspace) return null;

  const updateLayoutSetting = (key, value) => {
    setLayoutSettings((current) => normalizeLayoutSettings({ ...current, [key]: value }));
  };

  const save = () => {
    onSave(workspace.id, {
      name: name.trim() || 'Untitled',
      colour,
      icon,
      orientation,
      layoutOnOrientationChange,
      layoutSettings,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-nm-overlay backdrop-blur-md" onClick={onClose} />
      <div
        className="relative w-full max-w-sm max-h-[88vh] rounded-2xl bg-nm-panel border border-nm-border shadow-2xl flex flex-col overflow-hidden"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 sm:px-4 py-3 border-b border-nm-border bg-nm-header">
          <h2 className="text-sm font-semibold text-nm-text">{mode === 'create' ? 'New workspace' : 'Edit workspace'}</h2>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-nm-text-faint hover:text-nm-text hover:bg-nm-hover transition active:scale-95"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-auto px-4 sm:px-5 py-4">
          <label className="text-sm font-medium text-nm-label">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            placeholder="Untitled"
            autoFocus
            className="w-full mt-1 mb-4 rounded-lg border border-nm-border bg-nm-input px-3 py-2 text-nm-text placeholder:text-nm-text-muted outline-none focus:border-indigo-400 focus:bg-nm-hover"
            style={{ fontSize: 16 }}
          />

          <label className="text-sm font-medium text-nm-label">Colour</label>
          <div className="flex flex-wrap gap-2 mt-2 mb-4">
            {WORKSPACE_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColour(c)}
                className="w-8 h-8 rounded-full border-2 transition-transform shadow-sm"
                style={{
                  backgroundColor: c,
                  borderColor: colour === c ? '#818cf8' : 'var(--nm-border-strong)',
                  transform: colour === c ? 'scale(1.12)' : 'none',
                }}
              />
            ))}
          </div>

          <label className="text-sm font-medium text-nm-label">Icon</label>
          <div className="grid grid-cols-5 gap-2 mt-2 mb-5">
            {WORKSPACE_ICON_KEYS.map((k) => {
              const Icon = WORKSPACE_ICONS[k];
              const selected = icon === k;
              return (
                <button
                  key={k}
                  onClick={() => setIcon(k)}
                  className="h-10 rounded-lg flex items-center justify-center border transition hover:bg-nm-hover"
                  style={{
                    backgroundColor: selected ? colour + '22' : 'var(--nm-option)',
                    borderColor: selected ? colour : 'var(--nm-border)',
                    color: selected ? colour : 'var(--nm-option-text)',
                  }}
                >
                  <Icon size={20} />
                </button>
              );
            })}
          </div>

          <label className="text-sm font-medium text-nm-label">Orientation</label>
          <div className="grid grid-cols-2 gap-2 mt-2 mb-5">
            {[
              { value: GRAPH_ORIENTATIONS.HORIZONTAL, label: 'Horizontal' },
              { value: GRAPH_ORIENTATIONS.VERTICAL, label: 'Vertical' },
            ].map((option) => {
              const selected = orientation === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => setOrientation(option.value)}
                  className="rounded-xl border px-3 py-3 text-left transition hover:bg-nm-hover"
                  style={optionStyle(selected, colour)}
                >
                  <div className="flex items-center gap-3">
                    <OrientationIcon orientation={option.value} />
                    <span className="text-sm font-medium">{option.label}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setAdvancedOpen((open) => !open)}
            className="w-full flex items-center justify-between rounded-xl border border-nm-border bg-nm-input px-4 py-3.5 text-sm font-medium text-nm-text hover:bg-nm-hover transition"
          >
            <span>Advanced settings</span>
            {advancedOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {advancedOpen && (
            <div className="mt-3 mb-5">
              <label className="text-sm font-medium text-nm-label">Layout on Orientation Change</label>
              <div className="grid grid-cols-2 gap-2 mt-2 mb-5">
                {[
                  { value: LAYOUT_ON_ORIENTATION_CHANGE.PRESERVE, label: 'Preserve Original Layout' },
                  { value: LAYOUT_ON_ORIENTATION_CHANGE.AUTO, label: 'Auto Organise' },
                ].map((option) => {
                  const selected = layoutOnOrientationChange === option.value;
                  return (
                    <button
                      key={option.value}
                      onClick={() => setLayoutOnOrientationChange(option.value)}
                      className="rounded-xl border px-3 py-3 text-left text-sm font-medium transition hover:bg-nm-hover"
                      style={optionStyle(selected, colour)}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>

              <label className="text-sm font-medium text-nm-label">Auto Organise Layout</label>
              <div className="grid grid-cols-3 gap-2 mt-2 mb-3">
                {[
                  { value: LAYOUT_DENSITIES.COMPACT, label: 'Compact' },
                  { value: LAYOUT_DENSITIES.DEFAULT, label: 'Default' },
                  { value: LAYOUT_DENSITIES.SPACIOUS, label: 'Spacious' },
                ].map((option) => {
                  const selected = layoutSettings.density === option.value;
                  return (
                    <button
                      key={option.value}
                      onClick={() => updateLayoutSetting('density', option.value)}
                      className="rounded-lg border px-2 py-2 text-xs font-medium transition hover:bg-nm-hover"
                      style={optionStyle(selected, colour)}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-3 gap-2">
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
                      className="mt-1 w-full rounded-lg border border-nm-border bg-nm-input px-2 py-1.5 text-sm text-nm-text outline-none focus:border-indigo-400"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between items-center mt-5">
            {mode === 'edit' ? (
              <button
                onClick={() => {
                  if (window.confirm('Delete this workspace and all its content?')) {
                    onDelete(workspace.id);
                    onClose();
                  }
                }}
                className="text-sm text-red-500 hover:text-red-400 font-medium transition"
              >
                Delete workspace
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-medium text-nm-text-faint hover:text-nm-text hover:bg-nm-hover transition"
              >
                Cancel
              </button>
              <button
                onClick={save}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-500 text-white hover:bg-indigo-400 transition active:scale-95"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
