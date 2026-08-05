import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import {
  acknowledgeOnboardingReplay,
  completeOnboarding,
  getTutorialSections,
  isDesktopPlatform,
} from '@/lib/onboarding';
import { emitTutorial, subscribeTutorial } from '@/lib/tutorialEvents';

const PAD = 10;
const CARD_WIDTH = 360;
const GAP = 12;
const SAFE = 12;
const ADVANCE_DELAY_MS = 420;

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

  const available = bottom - top;
  const cardReserve = clamp(available * 0.34, 180, 280);
  if (available > cardReserve + 140) {
    bottom -= cardReserve;
  }

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
  if (toolbar && target !== 'toolbar' && !String(target || '').startsWith('toolbar-')) {
    avoid.push(toolbar);
  }
  if (workspace && target !== 'workspace-bar' && !String(target || '').startsWith('workspace-')) {
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
    { placement: 'viewport-bottom', top: vh - cardH - SAFE - 8, left: centerX() },
    { placement: 'viewport-top', top: SAFE + 8, left: centerX() },
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
  if (!highlight) {
    return <div aria-hidden className="pointer-events-auto absolute inset-0 bg-black/62" />;
  }

  const { top, left, width, height } = highlight;
  const dim = 'pointer-events-none absolute bg-black/55';

  return (
    <>
      <div aria-hidden className={dim} style={{ top: 0, left: 0, right: 0, height: Math.max(0, top) }} />
      <div aria-hidden className={dim} style={{ top: top + height, left: 0, right: 0, bottom: 0 }} />
      <div aria-hidden className={dim} style={{ top, left: 0, width: Math.max(0, left), height }} />
      <div aria-hidden className={dim} style={{ top, left: left + width, right: 0, height }} />
      <div
        aria-hidden
        className="pointer-events-none absolute rounded-2xl nm-tutorial-spotlight"
        style={{ top, left, width, height }}
      />
    </>
  );
}

function TaskRow({ label, done, active, justCompleted }) {
  return (
    <li
      className={`flex items-start gap-2.5 text-sm leading-snug transition-opacity duration-300 ${
        done ? 'text-nm-text-secondary' : active ? 'text-nm-text' : 'text-nm-text-muted/55'
      }`}
    >
      <span
        className={`relative mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition-all duration-300 ${
          done
            ? 'border-emerald-400 bg-emerald-500 text-white'
            : active
              ? 'border-indigo-300 bg-transparent nm-tutorial-task-pulse'
              : 'border-nm-border-strong bg-transparent'
        }`}
        aria-hidden
      >
        {done && (
          <Check
            size={11}
            strokeWidth={3}
            className={justCompleted ? 'nm-tutorial-check-in' : ''}
          />
        )}
      </span>
      <span className={done ? 'line-through decoration-nm-text-muted/40' : ''}>{label}</span>
    </li>
  );
}

function InteractiveTutorial({ open, onClose, platform }) {
  const sections = useMemo(() => getTutorialSections(platform), [platform]);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [taskIndex, setTaskIndex] = useState(0);
  const [completed, setCompleted] = useState(() => ({}));
  const [justCompletedKey, setJustCompletedKey] = useState(null);
  const [visible, setVisible] = useState(false);
  const [rect, setRect] = useState(null);
  const [cardPos, setCardPos] = useState({ top: 0, left: 0 });
  const cardRef = useRef(null);
  const advancingRef = useRef(false);
  const stateRef = useRef({ sectionIndex: 0, taskIndex: 0, completed: {} });

  const section = sections[sectionIndex] || null;
  const tasks = section?.tasks || [];
  const currentTask = tasks[taskIndex] || null;
  const highlightTarget = currentTask?.target ?? section?.target ?? null;
  const isFinish = section?.id === 'finish';

  stateRef.current = { sectionIndex, taskIndex, completed };

  const finish = useCallback(() => {
    completeOnboarding();
    setVisible(false);
    window.setTimeout(() => onClose?.(), 180);
  }, [onClose]);

  const measure = useCallback(() => {
    const nextRect = readTargetRect(highlightTarget);
    setRect(nextRect);
    const cardEl = cardRef.current;
    const measuredH = cardEl?.offsetHeight || 280;
    const measuredW = cardEl?.offsetWidth || CARD_WIDTH;
    setCardPos(placeCard(nextRect, measuredW, measuredH, chromeAvoidRects(highlightTarget)));
  }, [highlightTarget]);

  const advanceAfterTask = useCallback(
    (sIdx, tIdx) => {
      const sec = sections[sIdx];
      if (!sec) return;
      if (tIdx < sec.tasks.length - 1) {
        setTaskIndex(tIdx + 1);
        return;
      }
      if (sIdx < sections.length - 1) {
        setSectionIndex(sIdx + 1);
        setTaskIndex(0);
        return;
      }
      finish();
    },
    [sections, finish]
  );

  const completeCurrentTask = useCallback(
    (eventName) => {
      if (advancingRef.current) return;
      const { sectionIndex: sIdx, taskIndex: tIdx, completed: doneMap } = stateRef.current;
      const sec = sections[sIdx];
      const task = sec?.tasks[tIdx];
      if (!task || task.event !== eventName) return;
      const key = `${sec.id}:${task.id}`;
      if (doneMap[key]) return;

      advancingRef.current = true;
      const nextDone = { ...doneMap, [key]: true };
      setCompleted(nextDone);
      stateRef.current.completed = nextDone;
      setJustCompletedKey(key);

      window.setTimeout(() => {
        setJustCompletedKey(null);
        advanceAfterTask(sIdx, tIdx);
        advancingRef.current = false;
      }, ADVANCE_DELAY_MS);
    },
    [sections, advanceAfterTask]
  );

  useEffect(() => {
    if (!open) return undefined;
    acknowledgeOnboardingReplay();
    setSectionIndex(0);
    setTaskIndex(0);
    setCompleted({});
    advancingRef.current = false;
    const t = window.setTimeout(() => setVisible(true), 40);
    return () => window.clearTimeout(t);
  }, [open]);

  // Finish section: mark complete task immediately.
  useEffect(() => {
    if (!open || !isFinish || !currentTask) return;
    const key = `${section.id}:${currentTask.id}`;
    if (completed[key]) return;
    setCompleted((prev) => ({ ...prev, [key]: true }));
    setJustCompletedKey(key);
    const t = window.setTimeout(() => setJustCompletedKey(null), ADVANCE_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [open, isFinish, section, currentTask, completed]);

  useEffect(() => {
    if (!open) return undefined;
    return subscribeTutorial((event) => {
      completeCurrentTask(event);
    });
  }, [open, completeCurrentTask]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    measure();
    const id = window.requestAnimationFrame(measure);
    return () => window.cancelAnimationFrame(id);
  }, [open, measure, sectionIndex, taskIndex]);

  useEffect(() => {
    if (!open) return undefined;
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    const cardEl = cardRef.current;
    const ro = cardEl && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (cardEl && ro) ro.observe(cardEl);
    return () => {
      window.removeEventListener('resize', onResize);
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
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, finish]);

  useEffect(() => {
    if (!open) {
      delete document.body.dataset.tutorialHighlight;
      return undefined;
    }
    if (highlightTarget) document.body.dataset.tutorialHighlight = highlightTarget;
    else delete document.body.dataset.tutorialHighlight;
    return () => {
      delete document.body.dataset.tutorialHighlight;
    };
  }, [open, highlightTarget]);

  if (!open || !section) return null;

  const highlight = rect
    ? {
        top: rect.top - PAD,
        left: rect.left - PAD,
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
      }
    : null;

  const sectionDoneCount = tasks.filter((t) => completed[`${section.id}:${t.id}`]).length;

  const overlayTarget = highlightTarget?.startsWith('settings-') ? null : highlight;
  // Settings / edit dialogs sit at z-210; keep the card above them.
  const hideDimForModal = Boolean(highlightTarget?.startsWith('settings-'));

  const mask = (
    <div
      className="pointer-events-none fixed inset-0 z-[200]"
      aria-hidden
      style={{
        opacity: visible ? 1 : 0,
        transition: 'opacity 200ms ease',
      }}
    >
      {!hideDimForModal && <MaskPanels highlight={overlayTarget} />}
    </div>
  );

  const card = (
    <div
      ref={cardRef}
      className="pointer-events-auto fixed z-[230] w-[min(360px,calc(100vw-1.5rem))] rounded-2xl border border-nm-border bg-nm-panel p-4 shadow-2xl transition-[top,left,opacity,transform] duration-300 ease-out"
      role="dialog"
      aria-modal="false"
      aria-labelledby="nm-onboarding-title"
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
          {platform === 'desktop' ? 'Desktop' : 'Mobile'} tutorial
        </span>
        <span className="text-[11px] tabular-nums text-nm-text-muted">
          {sectionIndex + 1} / {sections.length}
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
        {section.title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-nm-text-secondary">{section.body}</p>

      <ul className="mt-4 flex flex-col gap-2.5">
        {tasks.map((task, i) => {
          const key = `${section.id}:${task.id}`;
          const done = !!completed[key];
          const active = i === taskIndex && !done;
          return (
            <TaskRow
              key={task.id}
              label={task.label}
              done={done}
              active={active}
              justCompleted={justCompletedKey === key}
            />
          );
        })}
      </ul>

      <div className="mt-4 flex items-center gap-2">
        {currentTask?.kind === 'continue' && (
          <>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => emitTutorial('tutorial.continue')}
              className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-400 active:scale-[0.98]"
            >
              Continue
            </button>
          </>
        )}
        {isFinish && (
          <>
            <div className="flex-1" />
            <button
              type="button"
              onClick={finish}
              className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-400 active:scale-[0.98]"
            >
              Start mapping
            </button>
          </>
        )}
        {!currentTask?.kind && !isFinish && (
          <p className="text-[11px] text-nm-text-muted">
            Complete the highlighted task ({sectionDoneCount}/{tasks.length})
          </p>
        )}
      </div>
    </div>
  );

  return (
    <>
      {createPortal(mask, document.body)}
      {createPortal(card, document.body)}
    </>
  );
}

export default function OnboardingTour({ open, onClose }) {
  const platform = useMemo(() => (isDesktopPlatform() ? 'desktop' : 'mobile'), []);
  return <InteractiveTutorial open={open} onClose={onClose} platform={platform} />;
}
