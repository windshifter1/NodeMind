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
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 max-w-[94vw] overflow-x-auto rounded-2xl border border-white/10 bg-zinc-900/80 backdrop-blur-md px-2 py-2 shadow-xl">
      <button
        onClick={onCreate}
        title="New workspace"
        className="shrink-0 p-2.5 rounded-xl outline-none text-white/80 hover:text-white hover:bg-white/10 active:scale-95 transition"
      >
        <Plus size={18} />
      </button>
      <div className="shrink-0 w-px h-7 bg-white/10" />
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
            className={`relative shrink-0 p-2.5 rounded-xl outline-none transition ${isActive ? 'ring-2 ring-white/80' : 'opacity-80 hover:opacity-100'}`}
            style={
              isActive
                ? { backgroundColor: w.colour, color: '#ffffff' }
                : { backgroundColor: w.colour + '26', color: w.colour }
            }
          >
            <Icon size={18} />
            {shownId === w.id && (
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap rounded-md bg-zinc-900 text-white text-xs px-2 py-1 shadow-lg pointer-events-none z-50">
                {w.name}
              </span>
            )}
          </button>
        );
      })}
      <div className="shrink-0 w-px h-7 bg-white/10" />
      <button
        onClick={onEdit}
        title="Edit current workspace"
        className="shrink-0 p-2.5 rounded-xl outline-none text-white/80 hover:text-white hover:bg-white/10 active:scale-95 transition"
      >
        <Pencil size={18} />
      </button>
    </div>
  );
}