import { useCallback } from 'react';
import { useTheme } from '@/lib/liquid-glass/NodedLiquidGlassProvider';

const glassSpring = { type: 'spring', stiffness: 400, damping: 30 };
const liquidStiffSpring = { type: 'spring', stiffness: 420, damping: 38 };

export function useGlassOverlayRootStyle() {
  return useCallback(() => {}, []);
}

export function useLiquidTransition(override = {}) {
  const { stiff, ...rest } = override;
  const base = stiff ? liquidStiffSpring : glassSpring;
  return { ...base, ...rest };
}

export function useLiquidSlideVariants(position, options = {}) {
  const offset = '100%';
  const isX = position === 'left' || position === 'right';
  const isNegative = position === 'left' || position === 'top';
  const value = isNegative ? `-${offset}` : offset;
  const initial = isX ? { x: value } : { y: value };
  const animate = isX ? { x: 0 } : { y: 0 };
  const exit = initial;
  return { initial, animate, exit };
}

export function useLiquidTapScale() {
  const { mode } = useTheme();
  return mode === 'liquid-glass' ? 0.84 : 0.9;
}