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

function measureLayoutSize() {
  const vv = window.visualViewport;
  const innerH = Math.round(window.innerHeight || 0);
  const innerW = Math.round(window.innerWidth || 0);
  const inset = measureFixedInsetSize();
  const vvH = vv ? Math.round(vv.height) : 0;
  const vvW = vv ? Math.round(vv.width) : 0;

  // Prefer the fixed-inset probe — that is the area the canvas shell can fill.
  let height = Math.max(innerH, inset.height || 0);
  let width = Math.max(innerW, inset.width || 0);

  if (isStandalonePwa()) {
    height = Math.max(height, Math.round(screenHeightForOrientation() || 0));
    width = Math.max(width, Math.round(screenWidthForOrientation() || 0));
  } else if (isMobileLike()) {
    // Grow with a larger visual viewport (chrome retracted); never shrink to vv (keyboard).
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
