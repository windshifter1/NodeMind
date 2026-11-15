import React, { useState } from 'react';
import { Sparkles, X } from 'lucide-react';

export default function AgentDock({ variant = 'float' }) {
  const [open, setOpen] = useState(false);
  const iconOnly = variant === 'icon';

  return (
    <div className={`nm-agent ${iconOnly ? 'nm-agent--bar' : ''}`}>
      {open ? (
        <div className="nm-agent__panel" role="dialog" aria-label="Agent">
          <div className="nm-dialog-head">
            <Sparkles size={14} strokeWidth={1.75} className="text-nm-text-muted" />
            <p className="min-w-0 flex-1 text-[13px] font-semibold text-nm-text">Agent</p>
            <button type="button" className="nm-dialog-close" title="Close" onClick={() => setOpen(false)}>
              <X size={16} strokeWidth={1.75} />
            </button>
          </div>
          <div className="nm-agent__body">
            <p className="text-[13px] font-medium text-nm-text">Coming soon</p>
            <p className="mt-1 text-xs leading-relaxed text-nm-text-muted">
              An AI chat for this workspace. It will sit here — same corner as the rest of your tools.
            </p>
          </div>
        </div>
      ) : null}
      <button
        type="button"
        className={`nm-agent__btn ${open ? 'nm-agent__btn--on' : ''} ${iconOnly ? 'nm-agent__btn--icon' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Agent"
        title="Agent"
      >
        <Sparkles size={15} strokeWidth={1.75} />
        {iconOnly ? null : 'Agent'}
      </button>
    </div>
  );
}
