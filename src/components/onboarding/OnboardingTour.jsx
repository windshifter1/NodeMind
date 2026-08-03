import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  acknowledgeOnboardingReplay,
  completeOnboarding,
  getOnboardingSteps,
  isDesktopPlatform,
} from '@/lib/onboarding';

const PAD = 10;
const CARD_WIDTH = 320;

function readTargetRect(target) {
  if (!target) return null;
  const el = document.querySelector(`[data-onboarding="${target}"]`);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width < 1 && rect.height < 1) return null;

  // Full-bleed targets (the canvas) don't make a useful hole — use a soft
  // centre focus region instead so the callout stays readable.
  const vw = window.innerWidth || 1;
  const vh = window.innerHeight || 1;
  if (rect.width > vw * 0.85 && rect.height > vh * 0.7) {
    const focusW = Math.min(280, vw * 0.55);
    const focusH = Math.min(180, vh * 0.28);
    return {
      top: (vh - focusH) / 2,
      left: (vw - focusW) / 2,
      width: focusW,
      height: focusH,
      bottom: (vh - focusH) / 2 + focusH,
      right: (vw - focusW) / 2 + focusW,
    };
  }

  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    bottom: rect.bottom,
    right: rect.right,
  };
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function placeCard(rect, cardH = 200) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const safeTop = 12;
  const safeBottom = 12;
  const safeX = 12;

  if (!rect) {
    return {
      top: Math.max(safeTop, (vh - cardH) / 2),
      left: Math.max(safeX, (vw - CARD_WIDTH) / 2),
      placement: 'center',
    };
  }

  const spaceBelow = vh - rect.bottom - PAD;
  const spaceAbove = rect.top - PAD;
  const preferBelow = spaceBelow >= cardH + 16 || spaceBelow >= spaceAbove;

  let top;
  if (preferBelow) {
    top = rect.bottom + PAD + 8;
  } else {
    top = rect.top - cardH - PAD - 8;
  }
  top = clamp(top, safeTop, Math.max(safeTop, vh - cardH - safeBottom));

  const left = clamp(rect.left + rect.width / 2 - CARD_WIDTH / 2, safeX, vw - CARD_WIDTH - safeX);
  return { top, left, placement: preferBelow ? 'below' : 'above' };
}

export default function OnboardingTour({ open, onClose }) {
  const platform = useMemo(() => (isDesktopPlatform() ? 'desktop' : 'mobile'), []);
  const steps = useMemo(() => getOnboardingSteps(platform), [platform]);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const [visible, setVisible] = useState(false);
  const [cardPos, setCardPos] = useState({ top: 0, left: 0 });

  const step = steps[index] || null;
  const total = steps.length;
  const isLast = index >= total - 1;

  const finish = useCallback(() => {
    completeOnboarding();
    setVisible(false);
    window.setTimeout(() => onClose?.(), 180);
  }, [onClose]);

  const measure = useCallback(() => {
    if (!step) return;
    const nextRect = readTargetRect(step.target);
    setRect(nextRect);
    setCardPos(placeCard(nextRect));
  }, [step]);

  useEffect(() => {
    if (!open) return undefined;
    acknowledgeOnboardingReplay();
    setIndex(0);
    const t = window.setTimeout(() => setVisible(true), 40);
    return () => window.clearTimeout(t);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !step) return undefined;
    measure();
    const id = window.requestAnimationFrame(measure);
    return () => window.cancelAnimationFrame(id);
  }, [open, step, measure, index]);

  useEffect(() => {
    if (!open) return undefined;
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
    };
  }, [open, measure]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        finish();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        if (isLast) finish();
        else setIndex((i) => Math.min(total - 1, i + 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setIndex((i) => Math.max(0, i - 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, finish, isLast, total]);

  if (!open || !step) return null;

  const highlight = rect
    ? {
        top: rect.top - PAD,
        left: rect.left - PAD,
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
      }
    : null;

  const node = (
    <div
      className="fixed inset-0 z-[200]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="nm-onboarding-title"
      style={{
        opacity: visible ? 1 : 0,
        transition: 'opacity 200ms ease',
        paddingTop: 'var(--safe-top)',
        paddingBottom: 'var(--safe-bottom)',
      }}
    >
      {/* Dim layer with spotlight hole */}
      {highlight ? (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-2xl transition-all duration-300 ease-out"
          style={{
            top: highlight.top,
            left: highlight.left,
            width: highlight.width,
            height: highlight.height,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.62), 0 0 0 2px rgba(165, 180, 252, 0.9), 0 0 28px 4px rgba(99, 102, 241, 0.55)',
          }}
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-black/62 transition-opacity duration-300" />
      )}

      {/* Block interaction with the app while touring */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

      <div
        className="absolute z-10 w-[min(320px,calc(100vw-1.5rem))] rounded-2xl border border-nm-border bg-nm-panel p-4 shadow-2xl transition-all duration-300 ease-out"
        style={{
          top: cardPos.top,
          left: cardPos.left,
          transform: visible ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.98)',
          opacity: visible ? 1 : 0,
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-300">
            {platform === 'desktop' ? 'Desktop' : 'Mobile'} tip
          </span>
          <span className="text-[11px] tabular-nums text-nm-text-muted">
            {index + 1} / {total}
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={finish}
            className="text-xs font-medium text-nm-text-muted transition hover:text-nm-text"
          >
            Skip
          </button>
        </div>

        <h2 id="nm-onboarding-title" className="text-base font-semibold text-nm-text">
          {step.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-nm-text-secondary">{step.body}</p>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            className="rounded-xl px-3 py-2 text-sm text-nm-text-secondary transition hover:bg-nm-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            Back
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => {
              if (isLast) finish();
              else setIndex((i) => Math.min(total - 1, i + 1));
            }}
            className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-400 active:scale-[0.98]"
          >
            {isLast ? 'Done' : 'Next'}
          </button>
        </div>

        <div className="mt-3 flex justify-center gap-1.5" aria-hidden>
          {steps.map((s, i) => (
            <span
              key={s.id}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === index ? 16 : 6,
                backgroundColor: i === index ? '#818cf8' : 'var(--nm-border-strong)',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
