import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { WORKSPACE_ICONS } from '@/lib/workspaceIcons';
import { isDesktopPlatform } from '@/lib/onboarding';
import { emitTutorial } from '@/lib/tutorialEvents';

function workspaceGlowShadow(colour, active) {
  if (!active) {
    return 'inset 0 0 0 0 transparent, inset 0 0 0 0 transparent, inset 0 0 0 0 transparent, 0 0 0 0 transparent';
  }
  return `inset 0 0 0 1px rgba(255,255,255,0.32), inset 0 0 0 2px ${colour}f5, inset 0 0 0 4px ${colour}80, 0 0 10px 1px ${colour}77`;
}

const WORKSPACE_BTN =
  'flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl outline-none transition active:scale-95';

const ICON_SIZE = 16;
const TAB_SIZE = 38;
const TAB_SIZE_ACTIVE = 30;
const SCROLL_THUMB_MIN = 24;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function WorkspaceScrollStrip({
  workspaces,
  activeId,
  buttonRefs,
  onSelect,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  onMouseEnter,
  onMouseLeave,
  onDragScrollStart,
}) {
  const scrollRef = useRef(null);
  const trackRef = useRef(null);
  const colRef = useRef(null);
  const dragRef = useRef(null);
  const panRef = useRef(null);
  const scrollableRef = useRef(false);
  const suppressClickRef = useRef(false);
  const [thumb, setThumb] = useState({ left: 0, width: 0, visible: false });

  const updateThumb = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollWidth, clientWidth, scrollLeft } = el;
    const overflow = scrollWidth - clientWidth;
    scrollableRef.current = overflow > 1;
    if (overflow <= 1) {
      setThumb({ left: 0, width: 0, visible: false });
      return;
    }
    const width = Math.max(SCROLL_THUMB_MIN, (clientWidth / scrollWidth) * clientWidth);
    const maxLeft = clientWidth - width;
    const left = maxLeft <= 0 ? 0 : (scrollLeft / overflow) * maxLeft;
    setThumb({ left, width, visible: true });
  }, []);

  useEffect(() => {
    updateThumb();
    const id = window.requestAnimationFrame(updateThumb);
    const el = scrollRef.current;
    if (!el) return () => window.cancelAnimationFrame(id);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateThumb) : null;
    ro?.observe(el);
    window.addEventListener('resize', updateThumb);
    return () => {
      window.cancelAnimationFrame(id);
      ro?.disconnect();
      window.removeEventListener('resize', updateThumb);
    };
  }, [workspaces.length, activeId, updateThumb]);

  useEffect(() => {
    const onMove = (e) => {
      const drag = dragRef.current;
      const scroll = scrollRef.current;
      if (drag && scroll) {
        const trackSpan = drag.trackWidth - drag.thumbWidth;
        if (trackSpan > 0) {
          const dx = e.clientX - drag.startX;
          scroll.scrollLeft = drag.startScrollLeft + (dx / trackSpan) * drag.overflow;
        }
      }

      const pan = panRef.current;
      if (!pan || pan.pointerId !== e.pointerId || !scroll) return;
      const dx = e.clientX - pan.startX;
      const dy = e.clientY - pan.startY;
      if (!pan.scrolling) {
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
        if (Math.abs(dx) <= Math.abs(dy)) {
          panRef.current = null;
          return;
        }
        pan.scrolling = true;
        onDragScrollStart?.();
        scroll.setPointerCapture?.(e.pointerId);
      }
      scroll.scrollLeft = pan.startScrollLeft - dx;
      updateThumb();
    };
    const onUp = (e) => {
      dragRef.current = null;
      const pan = panRef.current;
      if (pan && (!e || pan.pointerId === e.pointerId)) {
        if (pan.scrolling) {
          suppressClickRef.current = true;
          window.setTimeout(() => {
            suppressClickRef.current = false;
          }, 0);
        }
        panRef.current = null;
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [onDragScrollStart, updateThumb]);

  const onWheel = useCallback(
    (e) => {
      if (!scrollableRef.current) return;
      const scroll = scrollRef.current;
      if (!scroll) return;
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (!delta) return;
      e.preventDefault();
      e.stopPropagation();
      scroll.scrollLeft += delta;
      updateThumb();
    },
    [updateThumb]
  );

  useEffect(() => {
    const el = colRef.current;
    if (!el) return undefined;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  const onViewportPointerDown = (e) => {
    if (!scrollableRef.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.target.closest('.nm-workspace-scroll-thumb')) return;
    panRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startScrollLeft: scrollRef.current?.scrollLeft ?? 0,
      scrolling: false,
    };
  };

  const handleSelect = useCallback(
    (w) => {
      if (suppressClickRef.current) return;
      onSelect(w);
    },
    [onSelect]
  );

  const scrollToClientX = useCallback(
    (clientX, thumbWidth = thumb.width) => {
      const track = trackRef.current;
      const scroll = scrollRef.current;
      if (!track || !scroll) return;
      const rect = track.getBoundingClientRect();
      const overflow = scroll.scrollWidth - scroll.clientWidth;
      if (overflow <= 0) return;
      const span = rect.width - thumbWidth;
      if (span <= 0) {
        scroll.scrollLeft = 0;
        return;
      }
      const ratio = clamp((clientX - rect.left - thumbWidth / 2) / span, 0, 1);
      scroll.scrollLeft = ratio * overflow;
    },
    [thumb.width]
  );

  const onTrackPointerDown = (e) => {
    if (e.target.closest('.nm-workspace-scroll-thumb')) return;
    scrollToClientX(e.clientX);
  };

  const onThumbPointerDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const scroll = scrollRef.current;
    const track = trackRef.current;
    if (!scroll || !track) return;
    dragRef.current = {
      startX: e.clientX,
      startScrollLeft: scroll.scrollLeft,
      trackWidth: track.clientWidth,
      thumbWidth: thumb.width,
      overflow: scroll.scrollWidth - scroll.clientWidth,
    };
  };

  return (
    <div ref={colRef} className="nm-workspace-scroll-col min-w-0 flex-1">
      <div
        ref={scrollRef}
        className="nm-workspace-scroll-viewport h-[38px] overflow-x-auto overflow-y-hidden"
        onScroll={updateThumb}
        onPointerDown={onViewportPointerDown}
      >
        <div className="flex h-[38px] w-max items-center gap-1.5 px-2">
          {workspaces.map((w) => (
            <WorkspaceTab
              key={w.id}
              workspace={w}
              isActive={w.id === activeId}
              buttonRef={(el) => {
                if (el) buttonRefs.current.set(w.id, el);
                else buttonRefs.current.delete(w.id);
              }}
              onSelect={() => handleSelect(w)}
              onPointerDown={(e) => onPointerDown(w.id, e)}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerLeave}
              onMouseEnter={() => onMouseEnter(w.id)}
              onMouseLeave={onMouseLeave}
            />
          ))}
        </div>
      </div>
      <div
        ref={trackRef}
        className={`nm-workspace-scroll-track ${thumb.visible ? '' : 'pointer-events-none opacity-0'}`}
        onPointerDown={onTrackPointerDown}
      >
        <div
          className="nm-workspace-scroll-thumb"
          style={{ width: thumb.width, transform: `translateX(${thumb.left}px)` }}
          onPointerDown={onThumbPointerDown}
        />
      </div>
    </div>
  );
}

function WorkspaceTab({ workspace: w, isActive, buttonRef, onSelect, onPointerDown, onPointerUp, onPointerLeave, onMouseEnter, onMouseLeave }) {
  const Icon = WORKSPACE_ICONS[w.icon] || WORKSPACE_ICONS.note;
  const tabSize = isActive ? TAB_SIZE_ACTIVE : TAB_SIZE;
  const iconScale = tabSize / TAB_SIZE;

  return (
    <div className="relative flex h-[38px] w-[38px] shrink-0 items-center justify-center">
      <button
        ref={buttonRef}
        onClick={onSelect}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={`nm-workspace-icon-btn absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl outline-none ${
          isActive ? '' : 'opacity-80 hover:opacity-100'
        }`}
        style={{
          width: tabSize,
          height: tabSize,
          backgroundColor: isActive ? w.colour : `${w.colour}26`,
          color: isActive ? '#ffffff' : w.colour,
          boxShadow: workspaceGlowShadow(w.colour, isActive),
        }}
      >
        <Icon
          size={ICON_SIZE}
          className="nm-workspace-icon-glyph shrink-0"
          style={{ transform: `scale(${iconScale})` }}
        />
      </button>
    </div>
  );
}

export default function WorkspaceBar({ workspaces, activeId, onSelect, onCreate, onEdit }) {
  const [shownId, setShownId] = useState(null);
  const [tooltipPos, setTooltipPos] = useState(null);
  const [isDesktop, setIsDesktop] = useState(() => isDesktopPlatform());
  const holdTimer = useRef(null);
  const suppressMouse = useRef(false);
  const buttonRefs = useRef(new Map());

  useEffect(() => {
    const mq = window.matchMedia?.('(hover: hover) and (pointer: fine)');
    if (!mq) return undefined;
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);

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
        className="absolute left-1/2 z-50 flex w-max -translate-x-1/2 items-end gap-1.5 overflow-visible rounded-2xl border border-nm-border bg-nm-chrome px-2 pb-1.5 pt-2 shadow-xl backdrop-blur-md"
        style={{
          bottom: 'calc(1rem + var(--safe-bottom))',
          // Mobile: keep clear of the bottom-right bin; desktop can use more width.
          maxWidth: isDesktop
            ? 'min(70vw, calc(100% - 2rem - var(--safe-left) - var(--safe-right)))'
            : 'min(50vw, calc(100% - 2rem - var(--safe-left) - var(--safe-right)))',
        }}
      >
        <button
          data-onboarding="workspace-create"
          onClick={onCreate}
          title="New workspace"
          className={`${WORKSPACE_BTN} text-nm-text-secondary hover:bg-nm-hover hover:text-nm-text`}
        >
          <Plus size={16} />
        </button>
        <div className="h-[38px] w-px shrink-0 bg-nm-divider" />
        <WorkspaceScrollStrip
          workspaces={workspaces}
          activeId={activeId}
          buttonRefs={buttonRefs}
          onDragScrollStart={() => {
            clearHold();
            setShownId(null);
          }}
          onSelect={(w) => {
            if (w.id !== activeId) emitTutorial('workspace.switch');
            onSelect(w.id);
          }}
          onPointerDown={handleDown}
          onPointerUp={handleUp}
          onPointerLeave={handleUp}
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
        />
        <div className="h-[38px] w-px shrink-0 bg-nm-divider" />
        <button
          data-onboarding="workspace-edit"
          onClick={() => {
            onEdit();
            emitTutorial('workspace.edit.open');
          }}
          title="Edit current workspace"
          className={`${WORKSPACE_BTN} text-nm-text-secondary hover:bg-nm-hover hover:text-nm-text`}
        >
          <Pencil size={16} />
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
