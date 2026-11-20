import { useCallback, useRef, useState } from 'react';

/**
 * iOS-like glass control feedback: shrink while held, spring back on release.
 * Uses pointer capture so press state survives small finger movement.
 */
export function glassPressClasses(...parts) {
  return parts.filter(Boolean).join(' ');
}

export function glassPressState({ pressed, glass = false, tile = false, segment = false, solid = false } = {}) {
  return glassPressClasses(
    'nm-glass-press',
    glass && 'nm-glass-press--chrome',
    tile && 'nm-glass-press--tile',
    segment && 'nm-glass-press--segment',
    solid && 'nm-glass-press--solid',
    pressed && 'is-glass-pressed',
  );
}

export function useGlassPress({ disabled = false } = {}) {
  const [pressed, setPressed] = useState(false);
  const pointerIdRef = useRef(null);

  const endPress = useCallback(() => {
    pointerIdRef.current = null;
    setPressed(false);
  }, []);

  const onPointerDown = useCallback(
    (event) => {
      if (disabled) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;

      pointerIdRef.current = event.pointerId;
      setPressed(true);

      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        /* no-op */
      }
    },
    [disabled],
  );

  const onPointerUp = useCallback(
    (event) => {
      if (pointerIdRef.current !== event.pointerId) return;
      endPress();
    },
    [endPress],
  );

  const onPointerCancel = useCallback(
    (event) => {
      if (pointerIdRef.current !== event.pointerId) return;
      endPress();
    },
    [endPress],
  );

  const onLostPointerCapture = useCallback(
    (event) => {
      if (pointerIdRef.current !== event.pointerId) return;
      endPress();
    },
    [endPress],
  );

  return {
    pressed,
    pressProps: disabled
      ? {}
      : {
          onPointerDown,
          onPointerUp,
          onPointerCancel,
          onLostPointerCapture,
        },
  };
}