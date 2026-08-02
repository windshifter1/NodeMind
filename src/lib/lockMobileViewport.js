/**
 * Mobile / PWA viewport helpers.
 *
 * Goals:
 * - Fill the full screen on mobile browser and standalone PWA (edge-to-edge).
 * - Keep a stable layout height so the soft keyboard does not resize/move chrome.
 * - Prevent document / visualViewport scroll from shifting the shell.
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

/** True when the soft keyboard (or a similar overlay) has shrunk the visual viewport. */
function isKeyboardLikelyOpen(layoutHeight) {
  const vv = window.visualViewport;
  if (!vv || layoutHeight < 80) return false;
  // Keyboard usually takes a large bite; browser chrome changes are smaller.
  return vv.height < layoutHeight * 0.82 || layoutHeight - vv.height > 120;
}

function measureLayoutSize() {
  const vv = window.visualViewport;
  const innerH = Math.round(window.innerHeight || 0);
  const innerW = Math.round(window.innerWidth || 0);
  const clientH = Math.round(document.documentElement?.clientHeight || 0);
  const clientW = Math.round(document.documentElement?.clientWidth || 0);
  // Cover the layout viewport even when the visual viewport is offset (iOS).
  const vvCoverH = vv ? Math.round(vv.height + vv.offsetTop) : 0;
  const vvCoverW = vv ? Math.round(vv.width + vv.offsetLeft) : 0;

  let height = Math.max(innerH, clientH, vvCoverH);
  let width = Math.max(innerW, clientW, vvCoverW);

  if (isStandalonePwa()) {
    height = Math.max(height, Math.round(screenHeightForOrientation() || 0));
    width = Math.max(width, Math.round(screenWidthForOrientation() || 0));
  } else if (isMobileLike()) {
    // Mobile Safari/Chrome: prefer the larger layout size so content fills
    // under the home indicator / dynamic toolbars like the installed PWA.
    height = Math.max(height, innerH, clientH);
  }

  return { height, width };
}

function pinScroll() {
  if (window.scrollX || window.scrollY) {
    window.scrollTo(0, 0);
  }
  // Kill visualViewport panning that iOS uses to reveal focused fields.
  const vv = window.visualViewport;
  if (vv && (vv.offsetTop || vv.offsetLeft)) {
    window.scrollTo(0, 0);
  }
}

export function applyAppFrameHeight() {
  const root = document.documentElement;
  const { height: measuredH, width: measuredW } = measureLayoutSize();
  // Detect keyboard against the last stable layout size (not the already-shrunk measure).
  const keyboardOpen =
    isMobileLike() && lockedHeight >= 80 && isKeyboardLikelyOpen(lockedHeight);

  let height = measuredH;
  let width = measuredW;

  if (keyboardOpen) {
    // Keep chrome where it was; do not shrink the shell under the keyboard.
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
    // Stop the browser from scrolling the page to the focused field.
    pinScroll();
    window.setTimeout(pinScroll, 0);
    window.setTimeout(pinScroll, 50);
    window.setTimeout(applyAppFrameHeight, 50);
    window.setTimeout(pinScroll, 300);
  };

  const onTouchMove = (event) => {
    // Allow scrolling inside text fields and overflow scroll panes (dialogs/terminal).
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (
      target.closest?.(
        'textarea, input, [contenteditable="true"], [data-scrollable], [data-allow-scroll], .overflow-y-auto, .overflow-auto, .overflow-y-scroll'
      )
    ) {
      return;
    }
    // Prevent rubber-band document scroll that reveals gaps around the shell.
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
  window.addEventListener('scroll', pinScroll, { passive: true });
  window.visualViewport?.addEventListener('resize', onViewportChange);
  window.visualViewport?.addEventListener('scroll', onViewportChange);

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
    window.visualViewport?.removeEventListener('scroll', onViewportChange);
  };
}
