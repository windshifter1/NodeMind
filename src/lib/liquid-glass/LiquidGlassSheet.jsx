import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/liquid-glass/cn';
import {
  useGlassOverlayRootStyle,
  useLiquidSlideVariants,
  useLiquidTransition,
} from '@/lib/liquid-glass/useLiquidMotion';

export function LiquidGlassSheet({
  isOpen,
  onClose,
  children,
  className,
  title,
  maxHeight = '70vh',
  variant = 'default',
  header,
}) {
  const isFullScreen = variant === 'full';
  const isDetached = variant === 'detached';
  const isInset = variant === 'inset';
  const isCompact = variant === 'compact';
  const slideVariants = useLiquidSlideVariants('bottom', { stiff: true });
  const transition = useLiquidTransition({ stiff: true });
  const overlayRef = useGlassOverlayRootStyle(isOpen);

  return (
    <AnimatePresence>
      {isOpen ? (
        <div
          ref={overlayRef}
          className={cn(
            'nm-mobile__sheet-host flex items-end justify-center',
            isDetached && 'p-4',
            isInset && 'p-3',
          )}
        >
          <motion.button
            type="button"
            initial={{ opacity: 0.2 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="glass-backdrop-overlay absolute inset-0 border-0 p-0 cursor-default"
            aria-label="Close sheet"
          />
          <motion.div
            {...slideVariants}
            transition={transition}
            role="dialog"
            aria-label={title}
            className={cn(
              'relative w-full overflow-hidden',
              'glass-blur-xl glass-surface-strong glass-border glass-highlight-strong',
              isFullScreen
                ? 'h-full rounded-none'
                : isDetached || isInset
                  ? 'max-w-lg mx-auto rounded-3xl'
                  : isCompact
                    ? 'max-w-lg mx-auto rounded-t-3xl'
                    : 'max-w-lg mx-auto rounded-t-3xl',
              className,
            )}
            style={isFullScreen ? undefined : { maxHeight }}
          >
            {!isFullScreen ? (
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-[var(--lg-border)]" />
              </div>
            ) : null}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px glass-top-highlight" />
            <div className="pointer-events-none absolute -top-10 -right-10 h-24 w-24 rounded-full bg-[var(--lg-reflection)] blur-2xl" />
            {header ||
              (title ? (
                <div className="px-6 pt-2 pb-3">
                  <h3 className="text-lg font-semibold text-[var(--lg-text)] text-center">{title}</h3>
                </div>
              ) : null)}
            <div className={cn('overflow-y-auto', isCompact ? 'px-6 pb-6' : 'px-6 pb-8')}>{children}</div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}