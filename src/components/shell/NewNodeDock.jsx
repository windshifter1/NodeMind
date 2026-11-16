import React from 'react';
import { Plus } from 'lucide-react';

export default function NewNodeDock({ onAdd, lift = false }) {
  return (
    <div className={`nm-agent ${lift ? 'is-lifted' : ''}`}>
      <button
        type="button"
        className="nm-agent__btn nm-agent__btn--create"
        data-onboarding="toolbar-add"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          onAdd?.({
            clientX: rect.left + rect.width / 2,
            clientY: rect.top,
          });
        }}
        aria-label="New node"
        title="New node"
      >
        <span className="nm-dock-chip__inner">
          <Plus size={18} strokeWidth={1.75} />
        </span>
      </button>
    </div>
  );
}
