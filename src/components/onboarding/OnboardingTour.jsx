import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  acknowledgeOnboardingReplay,
  completeOnboarding,
  getOnboardingSteps,
  isDesktopPlatform,
} from '@/lib/onboarding';

const PAD = 10;
const CARD_WIDTH = 320;
const GAP = 12;
const SAFE = 12;

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function asBox(top, left, width, height) {
  return {
    top,
    left,
    width,
    height,
    bottom: top + height,
    right: left + width,
  };
}

function overlapArea(a, b, margin = 0) {
  if (!a || !b) return 0;
  const left = Math.max(a.left - margin, b.left - margin);
  const right = Math.min(a.right + margin, b.right + margin);
  const top = Math.max(a.top - margin, b.top - margin);
  const bottom = Math.min(a.bottom + margin, b.bottom + margin);
  const w = right - left;
  const h = bottom - top;
  return w > 0 && h > 0 ? w * h : 0;
}

function readElBox(selector) {
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 1 && r.height < 1) return null;
  return asBox(r.top, r.left, r.width, r.height);
}

/**
 * Full-bleed canvas gets a viewport-scaled work-area spotlight that clears
 * the toolbar and workspace bar, instead of a tiny fixed centre blob.
 */
function readCanvasSpotlight(canvasRect) {
  const vw = window.innerWidth || 1;
  const vh = window.innerHeight || 1;
  const toolbar = readElBox('[data-onboarding="toolbar"]');
  const workspace = readElBox('[data-onboarding="workspace-bar"]');

  const topLimit = toolbar ? toolbar.bottom + GAP : Math.max(canvasRect.top + 72, 72);
  const bottomLimit = workspace ? workspace.top - GAP : Math.min(canvasRect.bottom - 72, vh - 72);
  const sidePad = clamp(vw * 0.06, 20, 56);

  let top = Math.max(canvasRect.top + 8, topLimit);
  let bottom = Math.min(canvasRect.bottom - 8, bottomLimit);
  let left = canvasRect.left + sidePad;
  let right = canvasRect.right - sidePad;

  // Reserve a band under the spotlight for the tour card so it doesn't
  // cover the interactive canvas focus (scales with viewport height).
  const available = bottom - top;
  const cardReserve = clamp(available * 0.3, 160, 240);
  if (available > cardReserve + 140) {
    bottom -= cardReserve;
  }

  // Keep a readable focus region that still scales with the viewport.
  const minW = Math.min(320, vw * 0.72);
  const minH = Math.min(200, vh * 0.32);
  if (right - left < minW) {
    const mid = (left + right) / 2;
    left = clamp(mid - minW / 2, SAFE, vw - minW - SAFE);
    right = left + minW;
  }
  if (bottom - top < minH) {
    const mid = (top + bottom) / 2;
    top = clamp(mid - minH / 2, SAFE, vh - minH - SAFE);
    bottom = top + minH;
  }

  return asBox(top, left, Math.max(120, right - left), Math.max(100, bottom - top));
}

function readTargetRect(target) {
  if (!target) return null;
  const el = document.querySelector(`[data-onboarding="${target}"]`);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width < 1 && rect.height < 1) return null;

  const box = asBox(rect.top, rect.left, rect.width, rect.height);
  const vw = window.innerWidth || 1;
  const vh = window.innerHeight || 1;
  if (rect.width > vw * 0.85 && rect.height > vh * 0.7) {
    return readCanvasSpotlight(box);
  }
  return box;
}

function chromeAvoidRects(target) {
  const avoid = [];
  const toolbar = readElBox('[data-onboarding="toolbar"]');
  const workspace = readElBox('[data-onboarding="workspace-bar"]');
  // Don't push the card off chrome we're currently spotlighting.
  if (toolbar && target !== 'toolbar' && !String(target || '').startsWith('toolbar-')) {
    avoid.push(toolbar);
  }
  if (workspace && target !== 'workspace-bar') {
    avoid.push(workspace);
  }
  return avoid;
}

function placeCard(rect, cardW, cardH, avoidRects = []) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (!rect) {
    return {
      top: Math.max(SAFE, (vh - cardH) / 2),
      left: Math.max(SAFE, (vw - cardW) / 2),
      placement: 'center',
    };
  }

  const centerX = () => clamp(rect.left + rect.width / 2 - cardW / 2, SAFE, vw - cardW - SAFE);
  const alignMidY = () =>
    clamp(rect.top + rect.height / 2 - cardH / 2, SAFE, Math.max(SAFE, vh - cardH - SAFE));

  const candidates = [
    { placement: 'below', top: rect.bottom + PAD + 8, left: centerX() },
    { placement: 'above', top: rect.top - cardH - PAD - 8, left: centerX() },
    { placement: 'right', top: alignMidY(), left: rect.right + PAD + 8 },
    { placement: 'left', top: alignMidY(), left: rect.left - cardW - PAD - 8 },
    { placement: 'below-left', top: rect.bottom + PAD + 8, left: clamp(rect.left, SAFE, vw - cardW - SAFE) },
    { placement: 'below-right', top: rect.bottom + PAD + 8, left: clamp(rect.right - cardW, SAFE, vw - cardW - SAFE) },
    { placement: 'above-left', top: rect.top - cardH - PAD - 8, left: clamp(rect.left, SAFE, vw - cardW - SAFE) },
    { placement: 'above-right', top: rect.top - cardH - PAD - 8, left: clamp(rect.right - cardW, SAFE, vw - cardW - SAFE) },
    // Large canvas: dock to a lower corner of the spotlight so the work area stays free.
    {
      placement: 'inside-bottom',
      top: clamp(rect.bottom - cardH - 16, rect.top + 16, vh - cardH - SAFE),
      left: centerX(),
    },
    {
      placement: 'viewport-bottom',
      top: vh - cardH - SAFE - 8,
      left: centerX(),
    },
    {
      placement: 'viewport-top',
      top: SAFE + 8,
      left: centerX(),
    },
  ];

  let best = null;
  let bestScore = -Infinity;

  for (const raw of candidates) {
    const top = clamp(raw.top, SAFE, Math.max(SAFE, vh - cardH - SAFE));
    const left = clamp(raw.left, SAFE, Math.max(SAFE, vw - cardW - SAFE));
    const cardBox = asBox(top, left, cardW, cardH);

    const targetHit = overlapArea(cardBox, rect, 6);
    let chromeHit = 0;
    for (const a of avoidRects) chromeHit += overlapArea(cardBox, a, 4);

    // Prefer slots that clear the spotlight and chrome; slight bias to below/above.
    const sideBias =
      raw.placement === 'below' || raw.placement === 'above'
        ? 40
        : raw.placement.startsWith('below') || raw.placement.startsWith('above')
          ? 20
          : 0;
    const inView =
      top >= SAFE - 1 &&
      left >= SAFE - 1 &&
      top + cardH <= vh - SAFE + 1 &&
      left + cardW <= vw - SAFE + 1
        ? 80
        : -200;

    const score = inView + sideBias - targetHit * 2.5 - chromeHit * 3;
    if (score > bestScore) {
      bestScore = score;
      best = { top, left, placement: raw.placement };
    }
  }

  return best || { top: SAFE, left: SAFE, placement: 'fallback' };
}

function MaskPanels({ highlight }) {
  // Dim is visual-only so the app stays interactable (menus, pan/zoom, etc.).
  // Welcome / finish steps keep a blocking scrim so the card stays focused.
  if (!highlight) {
    return <div aria-hidden className="pointer-events-auto absolute inset-0 bg-black/62" />;
  }

  const { top, left, width, height } = highlight;
  const dim = 'pointer-events-none absolute bg-black/62';

  return (
    <>
      <div aria-hidden className={dim} style={{ top: 0, left: 0, right: 0, height: Math.max(0, top) }} />
      <div
        aria-hidden
        className={dim}
        style={{ top: top + height, left: 0, right: 0, bottom: 0 }}
      />
      <div
        aria-hidden
        className={dim}
        style={{ top, left: 0, width: Math.max(0, left), height }}
      />
      <div
        aria-hidden
        className={dim}
        style={{ top, left: left + width, right: 0, height }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute rounded-2xl transition-all duration-300 ease-out"
        style={{
          top,
          left,
          width,
          height,
          boxShadow:
            '0 0 0 2px rgba(165, 180, 252, 0.9), 0 0 28px 4px rgba(99, 102, 241, 0.55)',
        }}
      />
    </>
  );
}

export default function OnboardingTour({ open, onClose }) {
  const platform = useMemo(() => (isDesktopPlatform() ? 'desktop' : 'mobile'), []);
  const steps = useMemo(() => getOnboardingSteps(platform), [platform]);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const [visible, setVisible] = useState(false);
  const [cardPos, setCardPos] = useState({ top: 0, left: 0 });
  const cardRef = useRef(null);

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

    const cardEl = cardRef.current;
    const measuredH = cardEl?.offsetHeight || 200;
    const measuredW = cardEl?.offsetWidth || CARD_WIDTH;
    setCardPos(placeCard(nextRect, measuredW, measuredH, chromeAvoidRects(step.target)));
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

    const cardEl = cardRef.current;
    const ro = cardEl && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (cardEl && ro) ro.observe(cardEl);

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
      ro?.disconnect();
    };
  }, [open, measure]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        finish();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (isLast) finish();
        else setIndex((i) => Math.min(total - 1, i + 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setIndex((i) => Math.max(0, i - 1));
      }
      // Enter is left free so canvas / toolbar interactions stay natural.
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
      className="pointer-events-none fixed inset-0 z-[200]"
      role="dialog"
      aria-modal="false"
      aria-labelledby="nm-onboarding-title"
      style={{
        opacity: visible ? 1 : 0,
        transition: 'opacity 200ms ease',
      }}
    >
      <MaskPanels highlight={highlight} />

      <div
        ref={cardRef}
        className="pointer-events-auto absolute z-10 w-[min(320px,calc(100vw-1.5rem))] rounded-2xl border border-nm-border bg-nm-panel p-4 shadow-2xl transition-[top,left,opacity,transform] duration-300 ease-out"
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
