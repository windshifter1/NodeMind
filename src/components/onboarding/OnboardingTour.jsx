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

const ADVANCE_DELAY_MS = 420;
const SAFE = 12;
const GAP = 16;
const COACH_WIDTH_DESKTOP = 300;
const COACH_WIDTH_MOBILE = 260;
const FALLBACK_HEIGHT = 160;

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function readSafeInsets() {
  const styles = getComputedStyle(document.documentElement);
  const num = (name) => {
    const v = Number.parseFloat(styles.getPropertyValue(name));
    return Number.isFinite(v) ? v : 0;
  };
  return {
    top: num('--safe-top'),
    right: num('--safe-right'),
    bottom: num('--safe-bottom'),
    left: num('--safe-left'),
  };
}

function readTargetBox(target) {
  if (!target || target === 'canvas') return null;
  const el = document.querySelector(`[data-onboarding="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return null;
  return {
    top: r.top,
    left: r.left,
    width: r.width,
    height: r.height,
    bottom: r.bottom,
    right: r.right,
  };
}

function centerOf(box) {
  return {
    x: box.left + box.width / 2,
    y: box.top + box.height / 2,
  };
}

function dist2(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function overlaps(a, b, margin = 0) {
  if (!a || !b) return false;
  return !(
    a.right + margin <= b.left ||
    a.left - margin >= b.right ||
    a.bottom + margin <= b.top ||
    a.top - margin >= b.bottom
  );
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

/** Expand toolbar-* highlights to the full toolbar so the coach leaves that strip. */
function resolvePrimaryAvoidBox(highlightTarget) {
  const target = readTargetBox(highlightTarget);
  if (!highlightTarget || highlightTarget === 'canvas') return target;
  if (String(highlightTarget).startsWith('toolbar')) {
    return readTargetBox('toolbar') || target;
  }
  if (String(highlightTarget).startsWith('workspace')) {
    return readTargetBox('workspace-bar') || target;
  }
  return target;
}

function readChromeAvoidBoxes(highlightTarget) {
  const avoid = [];
  const toolbar = readTargetBox('toolbar');
  const workspace = readTargetBox('workspace-bar');
  if (toolbar && !String(highlightTarget || '').startsWith('toolbar')) avoid.push(toolbar);
  if (workspace && !String(highlightTarget || '').startsWith('workspace')) avoid.push(workspace);
  return avoid;
}

function coachWidthForViewport(vw, platform) {
  const cap = platform === 'mobile' ? COACH_WIDTH_MOBILE : COACH_WIDTH_DESKTOP;
  // Keep enough side room so left vs right corners are meaningfully different.
  return Math.min(cap, Math.max(200, vw * 0.72));
}

/**
 * Dock the coach to the corner furthest from the highlighted control.
 * Hard-rejects corners that still cover the primary target.
 */
function placeCoachAwayFromTarget(targetBox, cardW, cardH, extraAvoid = []) {
  const vw = window.innerWidth || 1;
  const vh = window.innerHeight || 1;
  const safe = readSafeInsets();
  const padL = SAFE + safe.left;
  const padR = SAFE + safe.right;
  const padT = SAFE + safe.top;
  const padB = SAFE + safe.bottom;

  const candidates = [
    { id: 'top-left', top: padT, left: padL },
    { id: 'top-right', top: padT, left: vw - cardW - padR },
    { id: 'bottom-left', top: vh - cardH - padB, left: padL },
    { id: 'bottom-right', top: vh - cardH - padB, left: vw - cardW - padR },
  ];

  const targetCenter = targetBox ? centerOf(targetBox) : { x: vw / 2, y: vh / 2 };
  const scored = [];

  for (const c of candidates) {
    const top = clamp(c.top, padT, Math.max(padT, vh - cardH - padB));
    const left = clamp(c.left, padL, Math.max(padL, vw - cardW - padR));
    const box = {
      top,
      left,
      width: cardW,
      height: cardH,
      bottom: top + cardH,
      right: left + cardW,
    };
    const coversTarget = overlaps(box, targetBox, GAP);
    let chromeHit = 0;
    for (const a of extraAvoid) chromeHit += overlapArea(box, a, GAP / 2);
    const distance = dist2(centerOf(box), targetCenter);
    scored.push({
      top,
      left,
      id: c.id,
      coversTarget,
      chromeHit,
      distance,
    });
  }

  // Prefer corners that do not cover the highlighted action, furthest first.
  const clear = scored.filter((s) => !s.coversTarget);
  const pool = clear.length ? clear : scored;
  pool.sort((a, b) => {
    if (a.chromeHit !== b.chromeHit) return a.chromeHit - b.chromeHit;
    if (b.distance !== a.distance) return b.distance - a.distance;
    // Stable tie-break: top-left → top-right → bottom-left → bottom-right
    const order = { 'top-left': 0, 'top-right': 1, 'bottom-left': 2, 'bottom-right': 3 };
    return order[a.id] - order[b.id];
  });

  return { top: pool[0].top, left: pool[0].left };
}

function placeCoachCentered(cardW, cardH) {
  const vw = window.innerWidth || 1;
  const vh = window.innerHeight || 1;
  const safe = readSafeInsets();
  const padL = SAFE + safe.left;
  const padR = SAFE + safe.right;
  const padT = SAFE + safe.top;
  const padB = SAFE + safe.bottom;
  return {
    top: clamp((vh - cardH) / 2, padT, Math.max(padT, vh - cardH - padB)),
    left: clamp((vw - cardW) / 2, padL, Math.max(padL, vw - cardW - padR)),
  };
}

function TaskCue({ label, done, active, justCompleted }) {
  return (
    <div
      className={`flex items-start gap-2 text-[13px] leading-snug transition-opacity duration-300 ${
        done ? 'text-nm-text-secondary' : active ? 'text-nm-text' : 'text-nm-text-muted'
      }`}
    >
      <span
        className={`relative mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all duration-300 ${
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
            size={10}
            strokeWidth={3}
            className={justCompleted ? 'nm-tutorial-check-in' : ''}
          />
        )}
      </span>
      <span className={done ? 'line-through decoration-nm-text-muted/40' : ''}>{label}</span>
    </div>
  );
}

function InteractiveTutorial({ open, onClose, platform }) {
  const sections = useMemo(() => getTutorialSections(platform), [platform]);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [taskIndex, setTaskIndex] = useState(0);
  const [completed, setCompleted] = useState(() => ({}));
  const [justCompletedKey, setJustCompletedKey] = useState(null);
  const [visible, setVisible] = useState(false);
  const [bodyExpanded, setBodyExpanded] = useState(false);
  const [cardPos, setCardPos] = useState({ top: SAFE, left: SAFE });
  const cardRef = useRef(null);
  const advancingRef = useRef(false);
  const stateRef = useRef({ sectionIndex: 0, taskIndex: 0, completed: {} });

  const section = sections[sectionIndex] || null;
  const tasks = section?.tasks || [];
  const currentTask = tasks[taskIndex] || null;
  const highlightTarget = currentTask?.target ?? section?.target ?? null;
  const isWelcome = section?.id === 'welcome';
  const isFinish = section?.id === 'finish';
  const showBody = taskIndex === 0 || bodyExpanded;

  stateRef.current = { sectionIndex, taskIndex, completed };

  const finish = useCallback(() => {
    completeOnboarding();
    setVisible(false);
    window.setTimeout(() => onClose?.(), 180);
  }, [onClose]);

  const measure = useCallback(() => {
    const vw = window.innerWidth || 1;
    const cardEl = cardRef.current;
    const baseW = coachWidthForViewport(vw, platform);
    const cardW = isWelcome ? Math.min(baseW + 24, vw - SAFE * 2) : baseW;
    const cardH = cardEl?.offsetHeight || FALLBACK_HEIGHT;
    if (isWelcome) {
      setCardPos(placeCoachCentered(cardW, cardH));
      return;
    }
    const targetBox = resolvePrimaryAvoidBox(highlightTarget);
    setCardPos(
      placeCoachAwayFromTarget(targetBox, cardW, cardH, readChromeAvoidBoxes(highlightTarget))
    );
  }, [highlightTarget, platform, isWelcome]);

  const advanceAfterTask = useCallback(
    (sIdx, tIdx) => {
      const sec = sections[sIdx];
      if (!sec) return;
      if (tIdx < sec.tasks.length - 1) {
        setTaskIndex(tIdx + 1);
        setBodyExpanded(false);
        return;
      }
      if (sIdx < sections.length - 1) {
        setSectionIndex(sIdx + 1);
        setTaskIndex(0);
        setBodyExpanded(false);
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
    setBodyExpanded(false);
    advancingRef.current = false;
    const t = window.setTimeout(() => setVisible(true), 40);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open || !isFinish || !currentTask || !section) return;
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

  useEffect(() => {
    const clearRing = () => {
      document.querySelectorAll('[data-tutorial-ring]').forEach((el) => {
        delete el.dataset.tutorialRing;
      });
    };

    if (!open) {
      delete document.body.dataset.tutorialHighlight;
      clearRing();
      return undefined;
    }

    // Canvas is the interaction surface — no ring cue for the whole board.
    if (!highlightTarget || highlightTarget === 'canvas') {
      delete document.body.dataset.tutorialHighlight;
      clearRing();
      return undefined;
    }

    document.body.dataset.tutorialHighlight = highlightTarget;
    let attempts = 0;
    let rafId = 0;
    const applyRing = () => {
      clearRing();
      const target = document.querySelector(`[data-onboarding="${highlightTarget}"]`);
      if (target) {
        target.dataset.tutorialRing = '';
        return;
      }
      attempts += 1;
      if (attempts < 16) rafId = window.requestAnimationFrame(applyRing);
    };
    applyRing();

    return () => {
      window.cancelAnimationFrame(rafId);
      delete document.body.dataset.tutorialHighlight;
      clearRing();
    };
  }, [open, highlightTarget]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    measure();
    let attempts = 0;
    let rafId = 0;
    const retry = () => {
      measure();
      attempts += 1;
      // Retry while the target (e.g. delete-bin) may still be mounting.
      if (highlightTarget && highlightTarget !== 'canvas' && !readTargetBox(highlightTarget) && attempts < 16) {
        rafId = window.requestAnimationFrame(retry);
      }
    };
    rafId = window.requestAnimationFrame(retry);
    return () => window.cancelAnimationFrame(rafId);
  }, [open, measure, sectionIndex, taskIndex, highlightTarget, showBody, bodyExpanded]);

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

  if (!open || !section || !currentTask) return null;

  const currentKey = `${section.id}:${currentTask.id}`;
  const currentDone = !!completed[currentKey];
  const cardWidth = coachWidthForViewport(window.innerWidth || 1, platform);

  const welcomeBackdrop = (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[229] bg-zinc-900/55 backdrop-blur-md transition-opacity duration-300 ease-out"
      style={{
        opacity: visible && isWelcome ? 1 : 0,
      }}
    />
  );

  const coach = (
    <div
      ref={cardRef}
      data-onboarding-tour
      className="pointer-events-auto fixed z-[230] rounded-2xl border border-nm-border bg-nm-chrome p-3 shadow-xl backdrop-blur-md transition-[top,left,opacity,transform,width] duration-300 ease-out"
      role="dialog"
      aria-modal={isWelcome}
      aria-labelledby="nm-onboarding-title"
      style={{
        top: cardPos.top,
        left: cardPos.left,
        width: isWelcome ? Math.min(cardWidth + 24, (window.innerWidth || 1) - SAFE * 2) : cardWidth,
        maxWidth: 'calc(100vw - 1.5rem)',
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.98)',
        opacity: visible ? 1 : 0,
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded-full bg-indigo-500/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-indigo-300">
          {platform === 'desktop' ? 'Desktop' : 'Mobile'}
        </span>
        <span className="text-[10px] tabular-nums text-nm-text-muted">
          {sectionIndex + 1}/{sections.length}
        </span>
        {tasks.length > 1 && (
          <span className="text-[10px] tabular-nums text-nm-text-muted">
            · {taskIndex + 1}/{tasks.length}
          </span>
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={finish}
          className="text-[11px] font-medium text-nm-text-muted transition hover:text-nm-text"
        >
          Skip
        </button>
      </div>

      <h2 id="nm-onboarding-title" className="text-sm font-semibold text-nm-text">
        {section.title}
      </h2>

      {showBody ? (
        <p className="mt-1.5 text-xs leading-relaxed text-nm-text-secondary">{section.body}</p>
      ) : (
        <button
          type="button"
          onClick={() => setBodyExpanded(true)}
          className="mt-1 text-[11px] text-nm-text-muted transition hover:text-nm-text-secondary"
        >
          Show tip
        </button>
      )}

      {tasks.length > 1 && (
        <div className="mt-2.5 flex items-center gap-1" aria-hidden>
          {tasks.map((task, i) => {
            const key = `${section.id}:${task.id}`;
            const done = !!completed[key];
            const active = i === taskIndex && !done;
            return (
              <span
                key={task.id}
                className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                  done ? 'bg-emerald-400/80' : active ? 'bg-indigo-400' : 'bg-nm-border-strong'
                }`}
              />
            );
          })}
        </div>
      )}

      <div className="mt-2.5">
        <TaskCue
          label={currentTask.label}
          done={currentDone}
          active={!currentDone}
          justCompleted={justCompletedKey === currentKey}
        />
      </div>

      <div className="mt-3 flex items-center gap-2">
        {currentTask?.kind === 'continue' && (
          <>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => emitTutorial('tutorial.continue')}
              className="rounded-xl bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-400 active:scale-[0.98]"
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
              className="rounded-xl bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-400 active:scale-[0.98]"
            >
              Start mapping
            </button>
          </>
        )}
      </div>
    </div>
  );

  return createPortal(
    <>
      {welcomeBackdrop}
      {coach}
    </>,
    document.body
  );
}

export default function OnboardingTour({ open, onClose }) {
  const platform = useMemo(() => (isDesktopPlatform() ? 'desktop' : 'mobile'), []);
  return <InteractiveTutorial open={open} onClose={onClose} platform={platform} />;
}
