import React, { useEffect, useRef, useState } from 'react';

const SHOW_MS = 380;
const GAP = 8;
const VIEW_PAD = 8;

function canHoverFine() {
  return window.matchMedia?.('(hover: hover) and (pointer: fine)')?.matches ?? false;
}

function labelFrom(el) {
  if (!el || el === document.body || el === document.documentElement) return '';
  const tagged = el.getAttribute?.('data-tooltip');
  if (tagged) return tagged.trim();
  const title = el.getAttribute?.('title');
  if (!title?.trim()) return '';
  el.setAttribute('data-tooltip', title);
  el.removeAttribute('title');
  return title.trim();
}

function findTrigger(node) {
  let el = node;
  while (el && el !== document.body) {
    if (el.closest?.('.nm-tip')) return null;
    if (labelFrom(el)) return el;
    el = el.parentElement;
  }
  return null;
}

function preferredSide(el) {
  if (el.closest('.nm-sidebar')) return 'right';
  if (el.closest('.nm-agent')) return 'left';
  if (el.closest('.nm-topbar, .nm-toolbar')) return 'bottom';
  return 'bottom';
}

function place(rect, width, height, side) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const spots = {
    right: {
      x: rect.right + GAP,
      y: rect.top + (rect.height - height) / 2,
    },
    left: {
      x: rect.left - GAP - width,
      y: rect.top + (rect.height - height) / 2,
    },
    bottom: {
      x: rect.left + (rect.width - width) / 2,
      y: rect.bottom + GAP,
    },
    top: {
      x: rect.left + (rect.width - width) / 2,
      y: rect.top - GAP - height,
    },
  };

  const order = [side, 'bottom', 'right', 'top', 'left'];
  const seen = new Set();
  for (const key of order) {
    if (seen.has(key)) continue;
    seen.add(key);
    const next = { ...spots[key] };
    next.x = Math.min(Math.max(VIEW_PAD, next.x), vw - width - VIEW_PAD);
    next.y = Math.min(Math.max(VIEW_PAD, next.y), vh - height - VIEW_PAD);
    const fits =
      next.x >= VIEW_PAD &&
      next.y >= VIEW_PAD &&
      next.x + width <= vw - VIEW_PAD &&
      next.y + height <= vh - VIEW_PAD;
    if (fits) return next;
  }
  return spots[side];
}

export default function TooltipLayer() {
  const [tip, setTip] = useState(null);
  const triggerRef = useRef(null);
  const timerRef = useRef(0);
  const nodeRef = useRef(null);

  useEffect(() => {
    const clearTimer = () => {
      window.clearTimeout(timerRef.current);
      timerRef.current = 0;
    };

    const hide = () => {
      clearTimer();
      triggerRef.current = null;
      setTip(null);
    };

    const showFor = (el) => {
      const text = labelFrom(el);
      if (!text) {
        hide();
        return;
      }
      const kbd = el.getAttribute('data-tooltip-kbd') || '';
      setTip({
        text,
        kbd,
        rect: el.getBoundingClientRect(),
        side: preferredSide(el),
      });
    };

    const schedule = (el) => {
      if (el === triggerRef.current) return;
      clearTimer();
      triggerRef.current = el;
      setTip(null);
      timerRef.current = window.setTimeout(() => {
        if (triggerRef.current === el) showFor(el);
      }, SHOW_MS);
    };

    const onOver = (e) => {
      if (!canHoverFine()) return;
      const el = findTrigger(e.target);
      if (!el) {
        if (!e.target.closest?.('.nm-tip')) hide();
        return;
      }
      schedule(el);
    };

    const onDown = () => hide();
    const onKey = (e) => {
      if (e.key === 'Escape') hide();
    };
    const onScroll = () => hide();

    document.addEventListener('pointerover', onOver, true);
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('blur', hide);
    return () => {
      clearTimer();
      document.removeEventListener('pointerover', onOver, true);
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('blur', hide);
    };
  }, []);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node || !tip) return;
    const { width, height } = node.getBoundingClientRect();
    const next = place(tip.rect, width, height, tip.side);
    node.style.left = `${Math.round(next.x)}px`;
    node.style.top = `${Math.round(next.y)}px`;
  }, [tip]);

  if (!tip) return null;

  return (
    <div ref={nodeRef} className="nm-tip" role="tooltip">
      <span className="nm-tip__label">{tip.text}</span>
      {tip.kbd ? <kbd className="nm-tip__kbd">{tip.kbd}</kbd> : null}
    </div>
  );
}
