import React, { useState, useEffect } from 'react';
import { WORKSPACE_ICONS, WORKSPACE_ICON_KEYS, WORKSPACE_COLORS } from '@/lib/workspaceIcons';

export default function WorkspaceEditDialog({ workspace, open, onClose, onSave, onDelete }) {
  const [name, setName] = useState('');
  const [colour, setColour] = useState(WORKSPACE_COLORS[0]);
  const [icon, setIcon] = useState('note');

  useEffect(() => {
    if (workspace) {
      setName(workspace.name || '');
      setColour(workspace.colour || WORKSPACE_COLORS[0]);
      setIcon(workspace.icon || 'note');
    }
  }, [workspace]);

  if (!open || !workspace) return null;

  const save = () => {
    onSave(workspace.id, { name: name.trim() || 'Untitled', colour, icon });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onPointerDown={onClose}
    >
      <div
        className="w-[90vw] max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4 text-slate-800">Edit workspace</h2>

        <label className="text-sm font-medium text-slate-600">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder="Untitled"
          autoFocus
          className="w-full mt-1 mb-4 rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-indigo-400"
          style={{ fontSize: 16 }}
        />

        <label className="text-sm font-medium text-slate-600">Colour</label>
        <div className="flex flex-wrap gap-2 mt-2 mb-4">
          {WORKSPACE_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColour(c)}
              className="w-8 h-8 rounded-full border-2 transition-transform"
              style={{
                backgroundColor: c,
                borderColor: colour === c ? '#0f172a' : 'transparent',
                transform: colour === c ? 'scale(1.12)' : 'none',
              }}
            />
          ))}
        </div>

        <label className="text-sm font-medium text-slate-600">Icon</label>
        <div className="grid grid-cols-5 gap-2 mt-2 mb-5">
          {WORKSPACE_ICON_KEYS.map((k) => {
            const Icon = WORKSPACE_ICONS[k];
            const selected = icon === k;
            return (
              <button
                key={k}
                onClick={() => setIcon(k)}
                className="h-10 rounded-lg flex items-center justify-center transition"
                style={{
                  backgroundColor: selected ? colour + '22' : 'transparent',
                  border: selected ? `1.5px solid ${colour}` : '1.5px solid transparent',
                  color: selected ? colour : '#64748b',
                }}
              >
                <Icon size={20} />
              </button>
            );
          })}
        </div>

        <div className="flex justify-between items-center">
          <button
            onClick={() => {
              if (window.confirm('Delete this workspace and all its content?')) {
                onDelete(workspace.id);
                onClose();
              }
            }}
            className="text-sm text-red-500 hover:text-red-600 font-medium"
          >
            Delete workspace
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              onClick={save}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-500 text-white hover:bg-indigo-600"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}