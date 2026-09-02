const TARGET = 'button, [role="button"]';
const SKIP =
  '[data-no-liquid], [data-onboarding="toolbar"], [data-onboarding="workspace-bar"], .nm-workspace-icon-btn';
const MAX_PULL = 11;

function isModern() {
  return document.documentElement.getAttribute('data-ui-style') === 'modern';
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Modern-only: buttons follow the pointer a few pixels and squash like gel.
 * Original UI is untouched. Workspace tabs keep their own centering transform.
 */
export function attachLiquidButtons(root = document) {
  let held = null;

  const onDown = (e) => {
    if (!isModern() || e.button !== 0) return;
    const el = e.target?.closest?.(TARGET);
    if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
    if (el.matches(SKIP) || el.closest('[data-no-liquid]')) return;
    held = { el, x: e.clientX, y: e.clientY };
    el.classList.add('nm-liquid-held');
    el.classList.remove('nm-liquid-jiggle');
  };

  const applyPull = (clientX, clientY) => {
    if (!held) return;
    const dx = clamp(clientX - held.x, -MAX_PULL, MAX_PULL);
    const dy = clamp(clientY - held.y, -MAX_PULL, MAX_PULL);
    const dist = Math.hypot(dx, dy);
    const sx = clamp(0.86 + Math.abs(dx) * 0.014 + dist * 0.004, 0.84, 1.16);
    const sy = clamp(0.8 + Math.abs(dy) * 0.014 + dist * 0.003, 0.78, 1.12);
    held.el.style.setProperty('--liquid-x', `${dx}px`);
    held.el.style.setProperty('--liquid-y', `${dy}px`);
    held.el.style.setProperty('--liquid-sx', sx.toFixed(3));
    held.el.style.setProperty('--liquid-sy', sy.toFixed(3));
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
