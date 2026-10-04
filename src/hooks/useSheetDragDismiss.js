import { useCallback, useEffect, useRef } from 'react';

const DISMISS_DISTANCE = 88;
const DISMISS_VELOCITY = 0.85; // px / ms

/**
 * Drag the sheet handle downward to dismiss (mobile bottom sheets).
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
    const dy = Math.max(0, e.clientY - drag.startY);
    const dt = Math.max(1, now - drag.lastT);
    drag.vy = (e.clientY - drag.lastY) / dt;
    drag.lastY = e.clientY;
    drag.lastT = now;
    drag.dy = dy;
    const sheet = sheetRef.current;
    if (sheet) {
      sheet.style.transform = `translate3d(0, ${dy}px, 0)`;
    }
    const backdrop = backdropRef.current;
    if (backdrop) {
      backdrop.style.opacity = String(Math.max(0.15, 1 - dy / 280));
    }
  };

  const finish = (e) => {
    const drag = dragRef.current;
    if (!drag || (e && e.pointerId !== drag.pointerId)) return;
    dragRef.current = null;
    const sheet = sheetRef.current;
    const backdrop = backdropRef.current;
    const shouldClose = drag.dy >= DISMISS_DISTANCE || drag.vy >= DISMISS_VELOCITY;
    if (shouldClose) {
      if (sheet) {
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
      sheet.style.transition = 'transform 0.22s ease-out';
      sheet.style.transform = '';
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
    },
  };
}
