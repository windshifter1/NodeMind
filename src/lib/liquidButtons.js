import { usesLiquidMotion } from '@/lib/uiStyle';

const TARGET = 'button, [role="button"]';
const SKIP =
  '[data-no-liquid], [data-onboarding="toolbar"], [data-onboarding="workspace-bar"], .nm-workspace-icon-btn';
const MAX_PULL = 12;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function styleActive() {
  return usesLiquidMotion(document.documentElement.getAttribute('data-ui-style'));
}

function isPrototype() {
  return document.documentElement.getAttribute('data-ui-style') === 'prototype';
}

/**
 * Gel buttons: follow the pointer a few pixels and squash like liquid.
 * Active for Modern and Prototype. Workspace tabs keep their own centering.
 */
export function attachLiquidButtons(root = document) {
  let held = null;

  const onDown = (e) => {
    if (!styleActive() || e.button !== 0) return;
    const el = e.target?.closest?.(TARGET);
    if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
    if (el.matches(SKIP) || el.closest('[data-no-liquid]')) return;
    held = { el, x: e.clientX, y: e.clientY };
    el.classList.add('nm-liquid-held');
    el.classList.remove('nm-liquid-jiggle');
    if (isPrototype()) {
      const r = el.getBoundingClientRect();
      const px = ((e.clientX - r.left) / Math.max(1, r.width)) * 100;
      const py = ((e.clientY - r.top) / Math.max(1, r.height)) * 100;
      el.style.setProperty('--proto-shine-x', `${px.toFixed(1)}%`);
      el.style.setProperty('--proto-shine-y', `${py.toFixed(1)}%`);
    }
  };

  const applyPull = (clientX, clientY) => {
    if (!held) return;
    const dx = clamp(clientX - held.x, -MAX_PULL, MAX_PULL);
    const dy = clamp(clientY - held.y, -MAX_PULL, MAX_PULL);
    const dist = Math.hypot(dx, dy);
    const sx = clamp(0.86 + Math.abs(dx) * 0.014 + dist * 0.004, 0.84, 1.18);
    const sy = clamp(0.8 + Math.abs(dy) * 0.014 + dist * 0.003, 0.76, 1.14);
    held.el.style.setProperty('--liquid-x', `${dx}px`);
    held.el.style.setProperty('--liquid-y', `${dy}px`);
    held.el.style.setProperty('--liquid-sx', sx.toFixed(3));
    held.el.style.setProperty('--liquid-sy', sy.toFixed(3));
    if (isPrototype()) {
      const r = held.el.getBoundingClientRect();
      const px = ((clientX - r.left) / Math.max(1, r.width)) * 100;
      const py = ((clientY - r.top) / Math.max(1, r.height)) * 100;
      held.el.style.setProperty('--proto-shine-x', `${clamp(px, 0, 100).toFixed(1)}%`);
      held.el.style.setProperty('--proto-shine-y', `${clamp(py, 0, 100).toFixed(1)}%`);
    }
  };

  const onMove = (e) => {
    if (!held) return;
    applyPull(e.clientX, e.clientY);
  };

  const onUp = () => {
    if (!held) return;
    const { el } = held;
    held = null;
    el.classList.remove('nm-liquid-held');
    el.classList.add('nm-liquid-jiggle');
    el.style.removeProperty('--liquid-x');
    el.style.removeProperty('--liquid-y');
    el.style.removeProperty('--liquid-sx');
    el.style.removeProperty('--liquid-sy');
    el.style.removeProperty('--proto-shine-x');
    el.style.removeProperty('--proto-shine-y');
    window.setTimeout(() => el.classList.remove('nm-liquid-jiggle'), 540);
  };

  root.addEventListener('pointerdown', onDown, true);
  root.addEventListener('pointermove', onMove, { passive: true });
  root.addEventListener('pointerup', onUp, true);
  root.addEventListener('pointercancel', onUp, true);

  return () => {
    root.removeEventListener('pointerdown', onDown, true);
    root.removeEventListener('pointermove', onMove, { passive: true });
    root.removeEventListener('pointerup', onUp, true);
    root.removeEventListener('pointercancel', onUp, true);
  };
}
