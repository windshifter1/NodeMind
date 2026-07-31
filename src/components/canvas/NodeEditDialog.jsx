import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const COLORS = [
  '#6366f1', '#ef4444', '#f59e0b', '#10b981',
  '#06b6d4', '#ec4899', '#8b5cf6', '#14b8a6',
  '#f97316', '#64748b',
];

export default function NodeEditDialog({ node, open, onClose, onSave, onDelete }) {
  const [title, setTitle] = useState('');
  const [color, setColor] = useState('#6366f1');

  useEffect(() => {
    if (node) {
      setTitle(node.title || '');
      setColor(node.color || '#6366f1');
    }
  }, [node]);

  if (!open || !node) return null;

  const save = () => {
    onSave(node.id, { title: title.trim(), color });
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
          <h2 className="text-sm font-semibold text-zinc-100">Edit note</h2>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition active:scale-95"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-4 sm:px-5 py-4">
          <label className="text-sm font-medium text-zinc-300">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            placeholder="Untitled"
            autoFocus
            className="w-full mt-1 mb-4 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-indigo-400 focus:bg-white/10"
            style={{ fontSize: 16 }}
          />

          <label className="text-sm font-medium text-zinc-300">Outline colour</label>
          <div className="flex flex-wrap gap-2 mt-2 mb-5">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className="w-8 h-8 rounded-full border-2 transition-transform shadow-sm"
                style={{
                  backgroundColor: c,
                  borderColor: color === c ? '#e0e7ff' : 'rgba(255,255,255,0.16)',
                  transform: color === c ? 'scale(1.12)' : 'none',
                }}
              />
            ))}
          </div>

          <div className="flex justify-between items-center">
            <button
              onClick={() => {
                onDelete(node.id);
                onClose();
              }}
              className="text-sm text-red-300 hover:text-red-200 font-medium transition"
            >
              Delete note
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