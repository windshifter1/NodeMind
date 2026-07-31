import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-md" onClick={onClose} />
      <div
        className="relative w-full max-w-sm rounded-2xl bg-zinc-900 border border-white/10 shadow-2xl flex flex-col overflow-hidden"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 sm:px-4 py-3 border-b border-white/10 bg-white/5">
          <h2 className="text-sm font-semibold text-zinc-100">Edit workspace</h2>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition active:scale-95"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-4 sm:px-5 py-4">
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

          <div className="flex justify-between items-center">
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