import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Space-to-pan navigation (Figma/Photoshop-style).
 *
 * Activation only when:
 * 1. Pointer is over the canvas board (not chrome / overlays)
 * 2. No text field is focused
 * 3. No modal / dialog overlay is open
 *
 * Uses Pointer Lock when available for edge-unbounded panning via movementX/Y.
 * Falls back to Space + drag with 1:1 client deltas.
 */

function isTextEntryTarget(el) {
  if (!el || el === document.body || el === document.documentElement) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return Boolean(el.closest?.('input, textarea, select, [contenteditable="true"]'));
}

function isBlockingUiOpen() {
  // The canvas onboarding tour is non-blocking (canvas stays interactable).
  const skip = ':not([data-onboarding-tour])';
  if (document.querySelector(`[aria-modal="true"]${skip}`)) return true;
  if (document.querySelector(`[role="dialog"]${skip}`)) return true;
  return false;
}

function isPointerOverBoard(boardEl, clientX, clientY) {
  if (!boardEl) return false;
  const top = document.elementFromPoint(clientX, clientY);
  if (!top) return false;
  // Must hit the board (or a node/edge inside it), not toolbar / workspace bar / overlays.
  return boardEl.contains(top);
}

export default function useSpacePan({ boardRef, setPan, onPanGesture }) {
  const [cursor, setCursor] = useState(null); // 'grab' | 'grabbing' | null
  const stateRef = useRef({
    armed: false, // Space held under valid conditions
    dragging: false, // Fallback: pointer down while armed
    locked: false,
    lastX: 0,
    lastY: 0,
    tutorialEmitted: false,
  });
  const pointerRef = useRef({ x: 0, y: 0, overBoard: false });
  const onPanGestureRef = useRef(onPanGesture);
  onPanGestureRef.current = onPanGesture;

  const applyDelta = useCallback(
    (dx, dy) => {
      if (!dx && !dy) return;
      setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
      const st = stateRef.current;
      if (!st.tutorialEmitted) {
        st.tutorialEmitted = true;
        onPanGestureRef.current?.();
      }
    },
    [setPan]
  );

  const releasePointerLock = useCallback(() => {
    if (document.pointerLockElement) {
      try {
        document.exitPointerLock();
      } catch {
        /* ignore */
      }
    }
    stateRef.current.locked = false;
  }, []);

  const endSpacePan = useCallback(() => {
    const st = stateRef.current;
    st.armed = false;
    st.dragging = false;
    st.tutorialEmitted = false;
    releasePointerLock();
    setCursor(null);
  }, [releasePointerLock]);

  const tryRequestPointerLock = useCallback(() => {
    const el = boardRef.current;
    if (!el?.requestPointerLock) return false;
    try {
      const result = el.requestPointerLock();
      // Some browsers return a Promise
      if (result && typeof result.catch === 'function') {
        result.catch(() => {
          stateRef.current.locked = false;
        });
      }
      return true;
    } catch {
      return false;
    }
  }, [boardRef]);

  const canActivate = useCallback(() => {
    if (isTextEntryTarget(document.activeElement)) return false;
    if (isBlockingUiOpen()) return false;
    const { x, y } = pointerRef.current;
    return isPointerOverBoard(boardRef.current, x, y);
  }, [boardRef]);

  // Track pointer position relative to the board (for activation checks).
  useEffect(() => {
    const onMove = (e) => {
      pointerRef.current.x = e.clientX;
      pointerRef.current.y = e.clientY;
      pointerRef.current.overBoard = isPointerOverBoard(boardRef.current, e.clientX, e.clientY);

      const st = stateRef.current;
      if (!st.armed) return;

      // Pointer Lock path: relative deltas, unbounded by screen edges.
      if (document.pointerLockElement === boardRef.current) {
        st.locked = true;
        setCursor('grabbing');
        applyDelta(e.movementX || 0, e.movementY || 0);
        return;
      }

      // Fallback: Space + drag (1:1 with cursor, same as middle-mouse pan).
      if (st.dragging) {
        const dx = e.clientX - st.lastX;
        const dy = e.clientY - st.lastY;
        st.lastX = e.clientX;
        st.lastY = e.clientY;
        applyDelta(dx, dy);
      }
    };

    const onPointerDown = (e) => {
      const st = stateRef.current;
      if (!st.armed || e.button !== 0) return;
      if (!boardRef.current?.contains(e.target) && document.pointerLockElement !== boardRef.current) {
        return;
      }
      // Prefer Pointer Lock once the user intentionally starts a drag in Space mode.
      // Stop propagation so node select/drag and marquee do not steal the gesture.
      st.dragging = true;
      st.lastX = e.clientX;
      st.lastY = e.clientY;
      setCursor('grabbing');
      tryRequestPointerLock();
      e.preventDefault();
      e.stopPropagation();
    };

    const onPointerUp = () => {
      const st = stateRef.current;
      if (!st.armed) return;
      // Keep Space armed; only end the drag. Lock stays until Space releases (if acquired).
      if (!document.pointerLockElement) {
        st.dragging = false;
        setCursor(st.armed ? 'grab' : null);
      }
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('pointerup', onPointerUp, true);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('pointerup', onPointerUp, true);
    };
  }, [applyDelta, boardRef, tryRequestPointerLock]);

  // Space key activation / teardown.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code !== 'Space' && e.key !== ' ') return;
      if (e.repeat) {
        // Prevent page scroll while Space-pan is active.
        if (stateRef.current.armed) e.preventDefault();
        return;
      }
      if (!canActivate()) return;

      e.preventDefault(); // Avoid browser scroll-jump
      const st = stateRef.current;
      st.armed = true;
      st.dragging = false;
      st.tutorialEmitted = false;
      setCursor('grab');

      // Request lock on intentional Space activation when supported.
      // If the browser rejects (needs click gesture), fallback drag still works.
      tryRequestPointerLock();
    };

    const onKeyUp = (e) => {
      if (e.code !== 'Space' && e.key !== ' ') return;
      if (stateRef.current.armed) {
        e.preventDefault();
        endSpacePan();
      }
    };

    const onBlur = () => endSpacePan();
    const onVisibility = () => {
      if (document.hidden) endSpacePan();
    };
    const onLockChange = () => {
      const locked = document.pointerLockElement === boardRef.current;
      stateRef.current.locked = locked;
      if (!locked && stateRef.current.armed) {
        setCursor(stateRef.current.dragging ? 'grabbing' : 'grab');
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('pointerlockchange', onLockChange);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('pointerlockchange', onLockChange);
      endSpacePan();
    };
  }, [boardRef, canActivate, endSpacePan, tryRequestPointerLock]);

  // If a modal opens while armed, drop Space pan immediately.
  useEffect(() => {
    const mo = new MutationObserver(() => {
      if (stateRef.current.armed && isBlockingUiOpen()) endSpacePan();
    });
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-modal', 'role'] });
    return () => mo.disconnect();
  }, [endSpacePan]);

  return {
    /** 'grab' | 'grabbing' | null — override board cursor while Space-pan is active */
    spacePanCursor: cursor,
    /** True while Space pan mode is armed (Space held under valid conditions) */
    isSpacePanArmed: () => stateRef.current.armed,
    /** True while actively translating the canvas via Space pan */
    isSpacePanning: () =>
      stateRef.current.armed && (stateRef.current.dragging || stateRef.current.locked),
  };
}
