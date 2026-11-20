import { useCallback, useEffect, useRef } from 'react';

const DISMISS_DISTANCE = 88;
const DISMISS_VELOCITY = 0.85; // px / ms
const UP_STRETCH_MAX = 64;
const UP_STRETCH_GAIN = 38;
const UP_SCALE_MAX = 0.045; // extra scaleY while stretched up

/** Rubber-band pull upward (negative translate). */
function stretchUp(pullPx) {
  const pull = Math.max(0, pullPx);
  return -UP_STRETCH_MAX * (1 - Math.exp(-pull / UP_STRETCH_GAIN));
}

function applySheetTransform(sheet, dy) {
  if (!sheet) return;
  if (dy >= 0) {
    sheet.style.transformOrigin = '';
    sheet.style.transform = `translate3d(0, ${dy}px, 0)`;
    return;
  }
  // Slight vertical stretch while pulling up (origin at bottom edge).
  const t = Math.min(1, -dy / UP_STRETCH_MAX);
  const scaleY = 1 + UP_SCALE_MAX * t;
  sheet.style.transformOrigin = '50% 100%';
  sheet.style.transform = `translate3d(0, ${dy}px, 0) scaleY(${scaleY})`;
}

/**
 * Drag the sheet handle downward to dismiss (mobile bottom sheets).
 * Dragging up applies a light stretch that springs back.
 * Attach `sheetRef` to the sheet panel and `{...handleProps}` to the handle hit target.
 */
export function useSheetDragDismiss(onClose, { open = true } = {}) {
  const sheetRef = useRef(null);
  const backdropRef = useRef(null);
  const dragRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const resetVisual = useCallback(() => {
    const sheet = sheetRef.current;
    const backdrop = backdropRef.current;
    if (sheet) {
      sheet.style.transition = '';
      sheet.style.transform = '';
      sheet.style.transformOrigin = '';
      sheet.style.opacity = '';
    }
    if (backdrop) {
      backdrop.style.transition = '';
      backdrop.style.opacity = '';
    }
  }, []);

  useEffect(() => {
    if (open) resetVisual();
  }, [open, resetVisual]);

  const onPointerDown = (e) => {
    if (!open) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const sheet = sheetRef.current;
    if (!sheet) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
    dragRef.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      lastY: e.clientY,
      lastT: performance.now(),
      dy: 0,
      vy: 0,
    };
    sheet.style.transition = 'none';
    if (backdropRef.current) backdropRef.current.style.transition = 'none';
  };

  const onPointerMove = (e) => {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    const now = performance.now();
    const raw = e.clientY - drag.startY;
    const dy = raw >= 0 ? raw : stretchUp(-raw);
    const dt = Math.max(1, now - drag.lastT);
    drag.vy = (e.clientY - drag.lastY) / dt;
    drag.lastY = e.clientY;
    drag.lastT = now;
    drag.dy = dy;
    applySheetTransform(sheetRef.current, dy);
    const backdrop = backdropRef.current;
    if (backdrop) {
      const down = Math.max(0, dy);
      backdrop.style.opacity = String(Math.max(0.15, 1 - down / 280));
    }
  };

  const finish = (e) => {
    const drag = dragRef.current;
    if (!drag || (e && e.pointerId !== drag.pointerId)) return;
    dragRef.current = null;
    const sheet = sheetRef.current;
    const backdrop = backdropRef.current;
    const pulledDown = drag.dy > 0;
    const shouldClose =
      pulledDown && (drag.dy >= DISMISS_DISTANCE || drag.vy >= DISMISS_VELOCITY);
    if (shouldClose) {
      if (sheet) {
        sheet.style.transformOrigin = '';
        sheet.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out';
        sheet.style.transform = 'translate3d(0, 110%, 0)';
        sheet.style.opacity = '0';
      }
      if (backdrop) {
        backdrop.style.transition = 'opacity 0.2s ease-out';
        backdrop.style.opacity = '0';
      }
      window.setTimeout(() => {
        onCloseRef.current?.();
        resetVisual();
      }, 200);
      return;
    }
    if (sheet) {
      sheet.style.transition =
        'transform 0.32s cubic-bezier(0.22, 1.45, 0.36, 1), opacity 0.2s ease-out';
      sheet.style.transform = '';
      sheet.style.transformOrigin = '';
    }
    if (backdrop) {
      backdrop.style.transition = 'opacity 0.22s ease-out';
      backdrop.style.opacity = '';
    }
  };

  return {
    sheetRef,
    backdropRef,
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finish,
      onPointerCancel: finish,
      role: 'button',
      tabIndex: 0,
      'aria-label': 'Drag down to close',
      title: 'Drag down to close',
      'data-no-liquid': '',
    },
  };
}
