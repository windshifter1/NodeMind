/**
 * Mobile / PWA viewport helpers.
 *
 * iOS standalone + black-translucent reports a shorter "lying" viewport
 * (innerHeight ≈ screen.height − home indicator). Using height:100% /
 * position:fixed / inset:0 clamps the shell to that size and leaves a dead
 * band at the bottom. In standalone we size the frame to the true screen
 * height instead.
 */

function isStandalonePwa() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    window.navigator.standalone === true
  );
}

function screenHeightForOrientation() {
  const { width, height } = window.screen;
  const portrait = window.matchMedia?.('(orientation: portrait)').matches ?? height >= width;
  return portrait ? Math.max(width, height) : Math.min(width, height);
}

export function applyAppFrameHeight() {
  const root = document.documentElement;
  const vvHeight = Math.round(window.visualViewport?.height ?? 0);
  const inner = Math.round(window.innerHeight || 0);

  let height = Math.max(inner, vvHeight);
  if (isStandalonePwa()) {
    // Prefer true screen height so the canvas fills under the home indicator.
    height = Math.max(height, Math.round(screenHeightForOrientation() || 0));
  }

  if (height >= 80) {
    root.style.setProperty('--app-frame-height', `${height}px`);
  }

  const width = Math.round(window.visualViewport?.width ?? window.innerWidth ?? 0);
  if (width >= 80) {
    root.style.setProperty('--vv-width', `${width}px`);
  }
}

export function lockMobileViewport() {
  if (typeof window === 'undefined') return () => {};

  const blockGesture = (event) => {
    event.preventDefault();
  };

  const onViewportChange = () => applyAppFrameHeight();
  const onOrientation = () => {
    window.setTimeout(applyAppFrameHeight, 50);
    window.setTimeout(applyAppFrameHeight, 300);
  };

  applyAppFrameHeight();
  // iOS can report a short innerHeight on the first paint after launch.
  window.setTimeout(applyAppFrameHeight, 0);
  window.setTimeout(applyAppFrameHeight, 250);

  document.addEventListener('gesturestart', blockGesture, { passive: false });
  document.addEventListener('gesturechange', blockGesture, { passive: false });
  document.addEventListener('gestureend', blockGesture, { passive: false });
  window.addEventListener('resize', onViewportChange);
  window.addEventListener('orientationchange', onOrientation);
  window.visualViewport?.addEventListener('resize', onViewportChange);
  window.visualViewport?.addEventListener('scroll', onViewportChange);

  return () => {
    document.removeEventListener('gesturestart', blockGesture);
    document.removeEventListener('gesturechange', blockGesture);
    document.removeEventListener('gestureend', blockGesture);
    window.removeEventListener('resize', onViewportChange);
    window.removeEventListener('orientationchange', onOrientation);
    window.visualViewport?.removeEventListener('resize', onViewportChange);
    window.visualViewport?.removeEventListener('scroll', onViewportChange);
  };
}
