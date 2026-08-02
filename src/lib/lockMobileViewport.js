/**
 * Mobile / PWA viewport helpers:
 * - Block iOS page pinch/double-tap zoom gestures
 * - Publish visualViewport size as CSS vars for components that need it
 *   (never drive html/body height from these — cold-start values can be 0)
 */

function applyAppViewport() {
  const root = document.documentElement;
  const vv = window.visualViewport;
  const height = Math.round(vv?.height ?? window.innerHeight);
  const width = Math.round(vv?.width ?? window.innerWidth);

  // Ignore transient 0×0 / tiny values during iOS PWA launch.
  if (height >= 80) root.style.setProperty('--vv-height', `${height}px`);
  if (width >= 80) root.style.setProperty('--vv-width', `${width}px`);
}

export function lockMobileViewport() {
  if (typeof window === 'undefined') return () => {};

  const blockGesture = (event) => {
    event.preventDefault();
  };

  const onViewportChange = () => applyAppViewport();
  const onOrientation = () => {
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
