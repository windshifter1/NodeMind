import React, { useState, useEffect } from 'react';

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
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onPointerDown={onClose}
    >
      <div
        className="w-[90vw] max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4 text-slate-800">Edit note</h2>

        <label className="text-sm font-medium text-slate-600">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder="Untitled"
          autoFocus
          className="w-full mt-1 mb-4 rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-indigo-400"
          style={{ fontSize: 16 }}
        />

        <label className="text-sm font-medium text-slate-600">Outline colour</label>
        <div className="flex flex-wrap gap-2 mt-2 mb-5">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className="w-8 h-8 rounded-full border-2 transition-transform"
              style={{
                backgroundColor: c,
                borderColor: color === c ? '#0f172a' : 'transparent',
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
            className="text-sm text-red-500 hover:text-red-600 font-medium"
          >
            Delete note
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