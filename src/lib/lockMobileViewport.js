/**
 * Mobile / PWA viewport helpers:
 * - Block iOS page pinch/double-tap zoom gestures
 * - Sync --app-height to visualViewport so standalone PWAs don't leave a
 *   dead band at the bottom or draw chrome under the status bar incorrectly
 */

function applyAppViewport() {
  const root = document.documentElement;
  const vv = window.visualViewport;
  const height = Math.max(1, Math.round(vv?.height ?? window.innerHeight));
  const width = Math.max(1, Math.round(vv?.width ?? window.innerWidth));
  const offsetTop = Math.max(0, Math.round(vv?.offsetTop ?? 0));
  const offsetLeft = Math.max(0, Math.round(vv?.offsetLeft ?? 0));

  root.style.setProperty('--app-height', `${height}px`);
  root.style.setProperty('--app-width', `${width}px`);
  root.style.setProperty('--app-offset-top', `${offsetTop}px`);
  root.style.setProperty('--app-offset-left', `${offsetLeft}px`);
}

export function lockMobileViewport() {
  if (typeof window === 'undefined') return () => {};

  const blockGesture = (event) => {
    event.preventDefault();
  };

  const onViewportChange = () => applyAppViewport();
  const onOrientation = () => {
    // iOS often reports stale insets until after the rotation settles.
    window.setTimeout(applyAppViewport, 50);
    window.setTimeout(applyAppViewport, 250);
  };

  applyAppViewport();

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
