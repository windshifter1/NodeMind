import React from 'react';
import { motion } from 'framer-motion';

export function LiquidGlassPressSplash({
  press,
  size = 140,
  tint = 'light',
  className,
  duration = 0.55,
}) {
  const splashBackground =
    tint === 'light'
      ? 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.22) 26%, rgba(255,255,255,0.06) 50%, transparent 72%)'
      : 'radial-gradient(circle at 35% 35%, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.16) 26%, rgba(0,0,0,0.04) 50%, transparent 72%)';

  return (
    <motion.div
      className={`pointer-events-none absolute mix-blend-soft-light ${className || ''}`}
      initial={false}
      initial={{ opacity: 0, scale: 0.35, borderRadius: '50%' }}
      animate={
        press.isPressed
          ? { opacity: 0.28, scale: 1.12, borderRadius: '50%' }
          : { opacity: 0, scale: 0.35, borderRadius: '50%' }
      }
      transition={
        press.isPressed
          ? { type: 'spring', stiffness: 420, damping: 32, mass: 0.85 }
          : { duration, ease: [0.25, 0.46, 0.45, 0.94] }
      }
      style={{
        left: `${press.x}%`,
        top: `${press.y}%`,
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        background: splashBackground,
        filter: 'blur(1.5px)',
      }}
    />
  );
}