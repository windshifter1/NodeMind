import React, { useState, useRef } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { WORKSPACE_ICONS } from '@/lib/workspaceIcons';

export default function WorkspaceBar({ workspaces, activeId, onSelect, onCreate, onEdit }) {
  const [shownId, setShownId] = useState(null);
  const holdTimer = useRef(null);
  const suppressMouse = useRef(false);

  const clearHold = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  const handleDown = (id, e) => {
    if (e.pointerType === 'mouse') return; // desktop hover handles it
    suppressMouse.current = true;
    clearHold();
    holdTimer.current = setTimeout(() => setShownId(id), 400);
  };

  const handleUp = () => {
    clearHold();
    setShownId(null);
    // Suppress emulated mouse events that browsers fire after a touch tap.
    setTimeout(() => {
      suppressMouse.current = false;
    }, 600);
  };

  const handleEnter = (id) => {
    if (suppressMouse.current) return;
    setShownId(id);
  };

  const handleLeave = () => {
    if (suppressMouse.current) return;
    setShownId(null);
  };

  return (
    <div
      className="absolute left-1/2 z-50 flex max-w-[min(94vw,calc(100%-2rem-var(--safe-left)-var(--safe-right)))] -translate-x-1/2 items-center gap-2 overflow-x-auto rounded-2xl border border-nm-border bg-nm-chrome px-2 py-2 shadow-xl backdrop-blur-md"
      style={{ bottom: 'calc(1rem + var(--safe-bottom))' }}
    >
      <button
        onClick={onCreate}
        title="New workspace"
        className="shrink-0 p-2.5 rounded-xl outline-none text-nm-text-secondary hover:text-nm-text hover:bg-nm-hover active:scale-95 transition"
      >
        <Plus size={18} />
      </button>
      <div className="shrink-0 w-px h-7 bg-nm-divider" />
      {workspaces.map((w) => {
        const Icon = WORKSPACE_ICONS[w.icon] || WORKSPACE_ICONS.note;
        const isActive = w.id === activeId;
        return (
          <button
            key={w.id}
            onClick={() => onSelect(w.id)}
            onPointerDown={(e) => handleDown(w.id, e)}
            onPointerUp={handleUp}
            onPointerLeave={handleUp}
            onMouseEnter={() => handleEnter(w.id)}
            onMouseLeave={handleLeave}
            className={`relative shrink-0 p-2.5 rounded-xl outline-none transition ${isActive ? 'ring-2 ring-nm-text/70' : 'opacity-80 hover:opacity-100'}`}
            style={
              isActive
                ? { backgroundColor: w.colour, color: '#ffffff' }
                : { backgroundColor: w.colour + '26', color: w.colour }
            }
          >
            <Icon size={18} />
            {shownId === w.id && (
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap rounded-md bg-nm-tooltip text-nm-tooltip-text text-xs px-2 py-1 shadow-lg border border-nm-border pointer-events-none z-50">
                {w.name}
              </span>
            )}
          </button>
        );
      })}
      <div className="shrink-0 w-px h-7 bg-nm-divider" />
      <button
        onClick={onEdit}
        title="Edit current workspace"
        className="shrink-0 p-2.5 rounded-xl outline-none text-nm-text-secondary hover:text-nm-text hover:bg-nm-hover active:scale-95 transition"
      >
        <Pencil size={18} />
      </button>
    </div>
  );
}
