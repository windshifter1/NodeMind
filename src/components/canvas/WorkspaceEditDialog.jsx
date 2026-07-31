import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { GRAPH_ORIENTATIONS, normalizeOrientation } from '@/lib/canvasConstants';
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

export default function WorkspaceEditDialog({ workspace, open, onClose, onSave, onDelete, mode = 'edit' }) {
  const [name, setName] = useState('');
  const [colour, setColour] = useState(WORKSPACE_COLORS[0]);
  const [icon, setIcon] = useState('note');
  const [orientation, setOrientation] = useState(GRAPH_ORIENTATIONS.HORIZONTAL);

  useEffect(() => {
    if (workspace) {
      setName(workspace.name || '');
      setColour(workspace.colour || WORKSPACE_COLORS[0]);
      setIcon(workspace.icon || 'note');
      setOrientation(normalizeOrientation(workspace.orientation));
    }
  }, [workspace]);

  if (!open || !workspace) return null;

  const save = () => {
    onSave(workspace.id, { name: name.trim() || 'Untitled', colour, icon, orientation });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-md" onClick={onClose} />
      <div
        className="relative w-full max-w-sm max-h-[88vh] rounded-2xl bg-zinc-900 border border-white/10 shadow-2xl flex flex-col overflow-hidden"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 sm:px-4 py-3 border-b border-white/10 bg-white/5">
          <h2 className="text-sm font-semibold text-zinc-100">{mode === 'create' ? 'New workspace' : 'Edit workspace'}</h2>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition active:scale-95"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-auto px-4 sm:px-5 py-4">
          <label className="text-sm font-medium text-zinc-300">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            placeholder="Untitled"
            autoFocus
            className="w-full mt-1 mb-4 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-indigo-400 focus:bg-white/10"
            style={{ fontSize: 16 }}
          />

          <label className="text-sm font-medium text-zinc-300">Colour</label>
          <div className="flex flex-wrap gap-2 mt-2 mb-4">
            {WORKSPACE_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColour(c)}
                className="w-8 h-8 rounded-full border-2 transition-transform shadow-sm"
                style={{
                  backgroundColor: c,
                  borderColor: colour === c ? '#e0e7ff' : 'rgba(255,255,255,0.16)',
                  transform: colour === c ? 'scale(1.12)' : 'none',
                }}
              />
            ))}
          </div>

          <label className="text-sm font-medium text-zinc-300">Icon</label>
          <div className="grid grid-cols-5 gap-2 mt-2 mb-5">
            {WORKSPACE_ICON_KEYS.map((k) => {
              const Icon = WORKSPACE_ICONS[k];
              const selected = icon === k;
              return (
                <button
                  key={k}
                  onClick={() => setIcon(k)}
                  className="h-10 rounded-lg flex items-center justify-center border transition hover:bg-white/10"
                  style={{
                    backgroundColor: selected ? colour + '22' : 'rgba(255,255,255,0.03)',
                    borderColor: selected ? colour : 'rgba(255,255,255,0.1)',
                    color: selected ? colour : '#d4d4d8',
                  }}
                >
                  <Icon size={20} />
                </button>
              );
            })}
          </div>

          <label className="text-sm font-medium text-zinc-300">Orientation</label>
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
                  className="rounded-xl border px-3 py-3 text-left transition hover:bg-white/10"
                  style={{
                    backgroundColor: selected ? colour + '22' : 'rgba(255,255,255,0.03)',
                    borderColor: selected ? colour : 'rgba(255,255,255,0.1)',
                    color: selected ? '#ffffff' : '#d4d4d8',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <OrientationIcon orientation={option.value} />
                    <span className="text-sm font-medium">{option.label}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex justify-between items-center">
            {mode === 'edit' ? (
              <button
                onClick={() => {
                  if (window.confirm('Delete this workspace and all its content?')) {
                    onDelete(workspace.id);
                    onClose();
                  }
                }}
                className="text-sm text-red-300 hover:text-red-200 font-medium transition"
              >
                Delete workspace
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition"
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