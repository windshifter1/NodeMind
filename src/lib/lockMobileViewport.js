/**
 * Mobile / PWA viewport helpers.
 *
 * iOS Safari often reports innerHeight / 100svh shorter than the area a
 * `position:fixed; inset:0` element actually covers — leaving blank bands
 * above/below the canvas. We measure a fixed inset probe instead, then lock
 * that pixel height so the soft keyboard cannot shrink the shell.
 */

let lockedHeight = 0;
let lockedWidth = 0;

function isStandalonePwa() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    window.navigator.standalone === true
  );
}

function isMobileLike() {
  return (
    window.matchMedia?.('(pointer: coarse)').matches ||
    window.matchMedia?.('(max-width: 900px)').matches ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '')
  );
}

function isKeyboardLikelyOpen(layoutHeight) {
  const vv = window.visualViewport;
  if (!vv || layoutHeight < 80) return false;
  return vv.height < layoutHeight * 0.82 || layoutHeight - vv.height > 120;
}

/** True size of a fixed inset:0 layer — avoids baking in a short --app-frame-height. */
function measureFixedInsetSize() {
  const probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText =
    'position:fixed;top:0;right:0;bottom:0;left:0;width:auto;height:auto;visibility:hidden;pointer-events:none;z-index:-1;';
  document.documentElement.appendChild(probe);
  const rect = probe.getBoundingClientRect();
  probe.remove();
  return {
    height: Math.round(rect.height),
    width: Math.round(rect.width),
  };
}

/** Pixel size of the region actually on screen (not screen.height — that overshoots in iOS PWA). */
function visibleLayoutSize() {
  const vv = window.visualViewport;
  const innerH = Math.round(window.innerHeight || 0);
  const innerW = Math.round(window.innerWidth || 0);
  if (!vv) return { height: innerH, width: innerW };
  return {
    height: Math.max(innerH, Math.round(vv.height + vv.offsetTop) || 0),
    width: Math.max(innerW, Math.round(vv.width + vv.offsetLeft) || 0),
  };
}

function measureLayoutSize() {
  const vv = window.visualViewport;
  const innerH = Math.round(window.innerHeight || 0);
  const innerW = Math.round(window.innerWidth || 0);
  const inset = measureFixedInsetSize();
  const visible = visibleLayoutSize();

  // Prefer the fixed-inset probe — that is the area the canvas shell can fill.
  let height = Math.max(innerH, inset.height || 0);
  let width = Math.max(innerW, inset.width || 0);

  if (isStandalonePwa() || isMobileLike()) {
    // Cap to the visible layout viewport so bottom chrome stays on-screen (no dead band).
    height = Math.min(height, visible.height || height);
    width = Math.min(width, visible.width || width);
  }

  if (!isStandalonePwa() && isMobileLike() && vv) {
  // Browser tab: grow when Safari retracts its UI; never shrink to keyboard height.
    const vvH = Math.round(vv.height);
    const vvW = Math.round(vv.width);
    if (vvH > height) height = vvH;
    if (vvW > width) width = vvW;
  }

  return { height, width };
}

function pinScroll() {
  if (window.scrollX || window.scrollY) {
    window.scrollTo(0, 0);
  }
  const vv = window.visualViewport;
  if (vv && (Math.abs(vv.offsetTop) > 0.5 || Math.abs(vv.offsetLeft) > 0.5)) {
    window.scrollTo(0, 0);
  }
}

export function applyAppFrameHeight() {
  const root = document.documentElement;
  root.classList.toggle('nm-standalone-pwa', isStandalonePwa());
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

  if (height >= 80) {
    root.style.setProperty('--app-frame-height', `${height}px`);
  }
  if (width >= 80) {
    root.style.setProperty('--app-frame-width', `${width}px`);
    root.style.setProperty('--vv-width', `${width}px`);
  }

  applyKeyboardInset(height);
  pinScroll();
}

function setKeyboardOpenClass(open) {
  document.documentElement.classList.toggle('nm-keyboard-open', open);
}

/** Lift floating mobile chrome with the software keyboard (iOS visualViewport). */
function applyKeyboardInset(layoutHeight) {
  const root = document.documentElement;
  const vv = window.visualViewport;
  if (!vv || !isMobileLike()) {
    root.style.setProperty('--nm-keyboard-inset', '0px');
    setKeyboardOpenClass(false);
    return;
  }
  const frame = layoutHeight || lockedHeight || Math.round(window.innerHeight || 0);
  const inset = Math.max(0, Math.round(frame - vv.height - vv.offsetTop));
  const open = inset > 12;
  root.style.setProperty('--nm-keyboard-inset', `${open ? inset : 0}px`);
  setKeyboardOpenClass(open);
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

  const onVvScroll = () => {
    pinScroll();
    applyAppFrameHeight();
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
