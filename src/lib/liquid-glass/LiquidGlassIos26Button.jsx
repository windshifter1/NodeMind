import React, { useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/liquid-glass/cn';
import { useLiquidPress } from '@/lib/liquid-glass/useLiquidPress';
import { LiquidGlassPressSplash } from '@/lib/liquid-glass/LiquidGlassPressSplash';
import { GlassTopHighlight } from '@/lib/liquid-glass/GlassTopHighlight';
import { useLiquidTapScale } from '@/lib/liquid-glass/useLiquidMotion';

const sizeClasses = {
  sm: 'px-4 py-2 text-sm rounded-2xl gap-1.5',
  md: 'px-6 py-3 text-sm rounded-3xl gap-2',
  lg: 'px-8 py-4 text-base rounded-3xl gap-2.5',
};

export function LiquidGlassIos26Button({
  children,
  className,
  size = 'md',
  icon,
  disabled,
  onClick,
  fullWidth,
  fluid = true,
  motionPress = true,
  onPointerDown: onPointerDownProp,
  onPointerUp: onPointerUpProp,
  onPointerLeave: onPointerLeaveProp,
  onPointerCancel: onPointerCancelProp,
  ...rest
}) {
  const tapScale = useLiquidTapScale();
  const [ripples, setRipples] = useState([]);
  const { state: press, onPointerDown, onPointerUp, onPointerLeave, onPointerCancel } =
    useLiquidPress(disabled);

  const createRipple = useCallback(
    (e) => {
      if (disabled) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const id = Date.now();
      setRipples((prev) => [
        ...prev,
        { id, x: e.clientX - rect.left, y: e.clientY - rect.top },
      ]);
      window.setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 900);
    },
    [disabled],
  );

  const useTapMotion = motionPress && fluid;

  return (
    <motion.button
      whileHover={useTapMotion && !disabled ? { scale: 1.03 } : undefined}
      whileTap={useTapMotion && !disabled ? { scale: tapScale } : undefined}
      disabled={disabled}
      onPointerDown={(e) => {
        onPointerDown(e);
        onPointerDownProp?.(e);
      }}
      onPointerUp={(e) => {
        onPointerUp();
        onPointerUpProp?.(e);
      }}
      onPointerLeave={(e) => {
        onPointerLeave();
        onPointerLeaveProp?.(e);
      }}
      onPointerCancel={(e) => {
        onPointerCancel();
        onPointerCancelProp?.(e);
      }}
      onClick={(e) => {
        if (fluid) createRipple(e);
        onClick?.();
      }}
      className={cn(
        'relative inline-flex items-center justify-center font-semibold overflow-hidden isolate',
        'glass-blur-lg glass-surface-strong glass-border',
        'text-[var(--lg-text)] shadow-2xl shadow-black/20',
        sizeClasses[size],
        fullWidth && 'w-full',
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
      {...rest}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-liquid-blue/25 via-liquid-purple/15 to-liquid-pink/10 opacity-80" />
      <GlassTopHighlight className="inset-x-3 top-0.5 z-20" opacity={0.4} />
      <div className="pointer-events-none absolute -top-6 -left-4 h-16 w-16 rounded-full bg-[var(--lg-border)] blur-2xl" />
      <div className="pointer-events-none absolute -bottom-6 -right-4 h-16 w-16 rounded-full bg-liquid-blue/15 blur-2xl" />
      {fluid ? <LiquidGlassPressSplash press={press} size={160} /> : null}
      {fluid ? (
        <motion.div
          animate={{ opacity: press.isPressed ? 0.55 : 0 }}
          transition={{ duration: 0.15 }}
          className="absolute inset-0 z-0"
          style={{
            boxShadow:
              'inset 0 8px 24px rgba(0,0,0,0.28), inset 0 -2px 8px rgba(255,255,255,0.14)',
          }}
        />
      ) : null}
      <AnimatePresence>
        {ripples.map((ripple) => (
          <motion.span
            key={ripple.id}
            initial={{
              scale: 0,
              opacity: 0.5,
              borderRadius: '45% 55% 50% 50% / 55% 45% 50% 50%',
            }}
            animate={{ scale: 3, opacity: 0, borderRadius: '50%' }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="absolute pointer-events-none z-10"
            style={{
              left: ripple.x,
              top: ripple.y,
              width: 60,
              height: 60,
              marginLeft: -30,
              marginTop: -30,
              background: 'radial-gradient(circle, rgba(255,255,255,0.35) 0%, transparent 65%)',
            }}
          />
        ))}
      </AnimatePresence>
      {icon ? <span className="relative z-20">{icon}</span> : null}
      {children ? <span className="relative z-20">{children}</span> : null}
    </motion.button>
  );
}