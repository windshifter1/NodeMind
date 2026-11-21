import { useCallback, useState } from 'react';

export function useLiquidPress(disabled = false) {
  const [state, setState] = useState({
    isPressed: false,
    x: 50,
    y: 50,
  });

  const onPointerDown = useCallback(
    (e) => {
      if (disabled) return;
      const rect = e.currentTarget.getBoundingClientRect();
      setState({
        isPressed: true,
        x: ((e.clientX - rect.left) / rect.width) * 100,
        y: ((e.clientY - rect.top) / rect.height) * 100,
      });
    },
    [disabled],
  );

  const onPointerUp = useCallback(() => {
    setState((s) => ({ ...s, isPressed: false }));
  }, []);

  const onPointerLeave = useCallback(() => {
    setState((s) => ({ ...s, isPressed: false }));
  }, []);

  const onPointerCancel = useCallback(() => {
    setState((s) => ({ ...s, isPressed: false }));
  }, []);

  return {
    state,
    onPointerDown,
    onPointerUp,
    onPointerLeave,
    onPointerCancel,
  };
}