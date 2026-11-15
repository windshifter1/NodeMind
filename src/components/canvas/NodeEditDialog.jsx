import React, { useState, useEffect } from 'react';
import { Pin, X } from 'lucide-react';
import OptionHelpRow from './OptionHelpRow';
import { emitTutorial } from '@/lib/tutorialEvents';

const COLORS = [
  '#6366f1', '#ef4444', '#f59e0b', '#10b981',
  '#06b6d4', '#ec4899', '#8b5cf6', '#14b8a6',
  '#f97316', '#64748b',
];

const PIN_HELP =
  'Pinned nodes stay in their current position when using Auto Organise or Auto Organise Selected. Other connected nodes will reorganise around them.';

export default function NodeEditDialog({ node, open, onClose, onSave, onDelete }) {
  const [color, setColor] = useState('#6366f1');
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    if (node) {
      setColor(node.color || '#6366f1');
      setPinned(!!node.pinned);
    }
  }, [node]);

  if (!open || !node) return null;

  const close = () => {
    emitTutorial('node.edit.close');
    onClose();
  };

  const save = () => {
    onSave(node.id, { color, pinned });
    close();
  };

  return (
    <div className="nm-dialog-root">
      <div className="nm-dialog-overlay" onClick={close} />
      <div
        className="nm-dialog-panel max-w-sm"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="nm-dialog-head">
          <h2>Edit node</h2>
          <div className="flex-1" />
          <button type="button" onClick={close} className="nm-dialog-close" title="Close">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <div className="px-4 sm:px-5 py-4">
          <OptionHelpRow
            icon={Pin}
            label="Pin node position"
            selected={pinned}
            onToggle={() => setPinned((value) => !value)}
            helpText={PIN_HELP}
            ariaLabel={pinned ? 'Unpin node position' : 'Pin node position'}
          />

          <label className="mt-4 block text-sm font-medium text-nm-label">Outline colour</label>
          <div className="flex flex-wrap gap-2 mt-2 mb-5">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className="w-8 h-8 rounded-full border-2 transition-transform shadow-sm"
                style={{
                  backgroundColor: c,
                  borderColor: color === c ? '#818cf8' : 'var(--nm-border-strong)',
                  transform: color === c ? 'scale(1.12)' : 'none',
                }}
              />
            ))}
          </div>

          <div className="flex justify-between items-center">
            <button
              onClick={() => {
                onDelete(node.id);
                close();
              }}
              className="text-sm text-red-500 hover:text-red-400 font-medium transition"
            >
              Delete node
            </button>
            <div className="flex gap-2">
              <button
                onClick={close}
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
