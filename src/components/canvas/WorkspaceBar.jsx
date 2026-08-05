import React, { useState, useRef, useEffect } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { WORKSPACE_ICONS } from '@/lib/workspaceIcons';

function workspaceActiveGlow(colour) {
  return `0 0 0 2px ${colour}f0, 0 0 0 5px ${colour}70, 0 0 16px 2px ${colour}88`;
}

export default function WorkspaceBar({ workspaces, activeId, onSelect, onCreate, onEdit }) {
  const [shownId, setShownId] = useState(null);
  const [tooltipPos, setTooltipPos] = useState(null);
  const holdTimer = useRef(null);
  const suppressMouse = useRef(false);
  const buttonRefs = useRef(new Map());

  const clearHold = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  const handleDown = (id, e) => {
    if (e.pointerType === 'mouse') return;
    suppressMouse.current = true;
    clearHold();
    holdTimer.current = setTimeout(() => setShownId(id), 400);
  };

  const handleUp = () => {
    clearHold();
    setShownId(null);
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

  useEffect(() => {
    if (!shownId) {
      setTooltipPos(null);
      return undefined;
    }

    const update = () => {
      const el = buttonRefs.current.get(shownId);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setTooltipPos({
        top: rect.top - 8,
        left: rect.left + rect.width / 2,
      });
    };

    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [shownId]);

  const shownWorkspace = workspaces.find((w) => w.id === shownId);

  return (
    <>
      <div
        data-onboarding="workspace-bar"
        className="absolute left-1/2 z-50 flex max-w-[min(94vw,calc(100%-2rem-var(--safe-left)-var(--safe-right)))] -translate-x-1/2 items-center gap-2 overflow-x-auto overflow-y-hidden rounded-2xl border border-nm-border bg-nm-chrome px-2 py-2 shadow-xl backdrop-blur-md"
        style={{ bottom: 'calc(1rem + var(--safe-bottom))' }}
      >
        <button
          onClick={onCreate}
          title="New workspace"
          className="shrink-0 rounded-xl p-2.5 outline-none text-nm-text-secondary transition hover:bg-nm-hover hover:text-nm-text active:scale-95"
        >
          <Plus size={18} />
        </button>
        <div className="h-7 w-px shrink-0 bg-nm-divider" />
        {workspaces.map((w) => {
          const Icon = WORKSPACE_ICONS[w.icon] || WORKSPACE_ICONS.note;
          const isActive = w.id === activeId;
          return (
            <button
              key={w.id}
              ref={(el) => {
                if (el) buttonRefs.current.set(w.id, el);
                else buttonRefs.current.delete(w.id);
              }}
              onClick={() => onSelect(w.id)}
              onPointerDown={(e) => handleDown(w.id, e)}
              onPointerUp={handleUp}
              onPointerLeave={handleUp}
              onMouseEnter={() => handleEnter(w.id)}
              onMouseLeave={handleLeave}
              className={`relative shrink-0 rounded-xl p-2.5 outline-none transition ${isActive ? '' : 'opacity-80 hover:opacity-100'}`}
              style={
                isActive
                  ? {
                      backgroundColor: w.colour,
                      color: '#ffffff',
                      boxShadow: workspaceActiveGlow(w.colour),
                    }
                  : { backgroundColor: w.colour + '26', color: w.colour }
              }
            >
              <Icon size={18} />
            </button>
          );
        })}
        <div className="h-7 w-px shrink-0 bg-nm-divider" />
        <button
          onClick={onEdit}
          title="Edit current workspace"
          className="shrink-0 rounded-xl p-2.5 outline-none text-nm-text-secondary transition hover:bg-nm-hover hover:text-nm-text active:scale-95"
        >
          <Pencil size={18} />
        </button>
      </div>

      {shownWorkspace && tooltipPos && (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-[60] -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-nm-border bg-nm-tooltip px-2 py-1 text-xs text-nm-tooltip-text"
          style={{ top: tooltipPos.top, left: tooltipPos.left }}
        >
          {shownWorkspace.name}
        </div>
      )}
    </>
  );
}
