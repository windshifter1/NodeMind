import { VIEWPORT_BLEED_RATIO } from '@/lib/viewportFrame';

/**
 * Mobile / PWA viewport helpers.
 *
 * iOS Safari notes:
 * - `100vh` maps to the *large* viewport (URL bar hidden), so a full-height
 *   shell is clipped at top/bottom while browser chrome is visible.
 * - `documentElement.clientHeight` reflects our own CSS height — never use it
 *   to measure, or oversized `100vh` gets locked in permanently.
 * - Soft keyboard shrinks `visualViewport` (and sometimes `innerHeight`); we
 *   keep the last stable layout size so toolbar/workspace chrome do not jump.
 * - Canvas paint size is view * (1 + 2 * bleed) so a short measurement still
 *   covers the physical screen; UI chrome is offset back onto the view.
 */

let lockedHeight = 0;
let lockedWidth = 0;

function isStandalonePwa() {
  // Do not use display-mode:fullscreen — that also matches the native Fullscreen API.
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

/** Pseudo or native fullscreen requested by the in-app control (mobile web / desktop). */
function isAppFullscreenMode() {
  return document.documentElement.dataset.nmFullscreen === '1';
}

function isMobileLike() {
  return (
    window.matchMedia?.('(pointer: coarse)').matches ||
    window.matchMedia?.('(max-width: 900px)').matches ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '')
  );
}

function screenHeightForOrientation() {
  const { width, height } = window.screen;
  const portrait = window.matchMedia?.('(orientation: portrait)').matches ?? height >= width;
  return portrait ? Math.max(width, height) : Math.min(width, height);
}

function screenWidthForOrientation() {
  const { width, height } = window.screen;
  const portrait = window.matchMedia?.('(orientation: portrait)').matches ?? height >= width;
  return portrait ? Math.min(width, height) : Math.max(width, height);
}

function isKeyboardLikelyOpen(layoutHeight) {
  const vv = window.visualViewport;
  if (!vv || layoutHeight < 80) return false;
  return vv.height < layoutHeight * 0.82 || layoutHeight - vv.height > 120;
}

function measureLayoutSize() {
  const vv = window.visualViewport;
  // Layout viewport — updates when Safari chrome shows/hides, stable vs 100vh.
  const innerH = Math.round(window.innerHeight || 0);
  const innerW = Math.round(window.innerWidth || 0);
  const vvH = vv ? Math.round(vv.height) : 0;
  const vvW = vv ? Math.round(vv.width) : 0;

  let height = innerH;
  let width = innerW;

  if (isStandalonePwa() || isAppFullscreenMode()) {
    // PWA, or mobile-web / desktop "Full Screen": fill the device screen.
    height = Math.max(innerH, Math.round(screenHeightForOrientation() || 0));
    width = Math.max(innerW, Math.round(screenWidthForOrientation() || 0));
  } else if (isMobileLike()) {
    // Mobile Safari/Chrome in-browser: size to the *visible* layout viewport.
    // Prefer innerHeight (matches 100svh). Only grow with visualViewport when
    // it is larger (chrome retracting) — never adopt a smaller vv (keyboard).
    if (vvH > height) height = vvH;
    if (vvW > width) width = vvW;
  } else if (vv) {
    height = Math.max(innerH, vvH);
    width = Math.max(innerW, vvW);
  }

  return { height, width };
}

/** Clear locked sizes so the next apply can grow/shrink (e.g. entering fullscreen). */
export function resetViewportLock() {
  lockedHeight = 0;
  lockedWidth = 0;
}

function pinScroll() {
  if (window.scrollX || window.scrollY) {
    window.scrollTo(0, 0);
  }
  // iOS may pan the visual viewport to focused inputs — snap it back.
  const vv = window.visualViewport;
  if (vv && (Math.abs(vv.offsetTop) > 0.5 || Math.abs(vv.offsetLeft) > 0.5)) {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }
}

export function applyAppFrameHeight() {
  const root = document.documentElement;
  const { height: measuredH, width: measuredW } = measureLayoutSize();
  const keyboardOpen =
    isMobileLike() && lockedHeight >= 80 && isKeyboardLikelyOpen(lockedHeight);

  let height = measuredH;
  let width = measuredW;

  if (keyboardOpen) {
    height = lockedHeight;
    if (lockedWidth >= 80) width = lockedWidth;
  } else {
    if (height >= 80) lockedHeight = height;
    if (width >= 80) lockedWidth = width;
  }

  if (height >= 80 && width >= 80) {
    const bleedX = Math.round(width * VIEWPORT_BLEED_RATIO);
    const bleedY = Math.round(height * VIEWPORT_BLEED_RATIO);
    const paintW = width + bleedX * 2;
    const paintH = height + bleedY * 2;

    root.style.setProperty('--app-view-width', `${width}px`);
    root.style.setProperty('--app-view-height', `${height}px`);
    root.style.setProperty('--app-bleed-x', `${bleedX}px`);
    root.style.setProperty('--app-bleed-y', `${bleedY}px`);
    root.style.setProperty('--app-frame-width', `${paintW}px`);
    root.style.setProperty('--app-frame-height', `${paintH}px`);
    root.style.setProperty('--vv-width', `${paintW}px`);
  }

  pinScroll();
}

export function lockMobileViewport() {
  if (typeof window === 'undefined') return () => {};

  const blockGesture = (event) => {
    event.preventDefault();
  };

  const onViewportChange = () => applyAppFrameHeight();
  const onOrientation = () => {
    lockedHeight = 0;
    lockedWidth = 0;
    window.setTimeout(applyAppFrameHeight, 50);
    window.setTimeout(applyAppFrameHeight, 300);
  };

  const onFocusIn = (event) => {
    const el = event.target;
    if (!(el instanceof Element)) return;
    if (!el.matches?.('input, textarea, select, [contenteditable="true"]')) return;
    pinScroll();
    window.setTimeout(pinScroll, 0);
    window.setTimeout(pinScroll, 50);
    window.setTimeout(applyAppFrameHeight, 50);
    window.setTimeout(pinScroll, 300);
  };

  const onTouchMove = (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (
      target.closest?.(
        'textarea, input, [contenteditable="true"], [data-scrollable], [data-allow-scroll], .overflow-y-auto, .overflow-auto, .overflow-y-scroll'
      )
    ) {
      return;
    }
    if (event.cancelable) event.preventDefault();
  };

  applyAppFrameHeight();
  window.setTimeout(applyAppFrameHeight, 0);
  window.setTimeout(applyAppFrameHeight, 250);

  document.addEventListener('gesturestart', blockGesture, { passive: false });
  document.addEventListener('gesturechange', blockGesture, { passive: false });
  document.addEventListener('gestureend', blockGesture, { passive: false });
  document.addEventListener('focusin', onFocusIn);
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  window.addEventListener('resize', onViewportChange);
  window.addEventListener('orientationchange', onOrientation);
  const onVvScroll = () => {
    pinScroll();
    applyAppFrameHeight();
  };

  window.addEventListener('scroll', pinScroll, { passive: true });
  window.visualViewport?.addEventListener('resize', onViewportChange);
  window.visualViewport?.addEventListener('scroll', onVvScroll);

  return () => {
    document.removeEventListener('gesturestart', blockGesture);
    document.removeEventListener('gesturechange', blockGesture);
    document.removeEventListener('gestureend', blockGesture);
    document.removeEventListener('focusin', onFocusIn);
    document.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('resize', onViewportChange);
    window.removeEventListener('orientationchange', onOrientation);
    window.removeEventListener('scroll', pinScroll);
    window.visualViewport?.removeEventListener('resize', onViewportChange);
    window.visualViewport?.removeEventListener('scroll', onVvScroll);
  };
}
