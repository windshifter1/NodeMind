/** Extra canvas paint beyond the detected viewport on each side (0.1 = 10%). */
export const VIEWPORT_BLEED_RATIO = 0.1;

/**
 * Read the locked view (visible) and paint (canvas) frame from CSS vars.
 * Paint size is view * (1 + 2 * bleed); UI chrome is offset by bleed so it
 * stays on the visible screen while the canvas extends underneath.
 */
export function readViewFrame() {
  const styles = getComputedStyle(document.documentElement);
  const num = (name, fallback) => {
    const value = Number.parseFloat(styles.getPropertyValue(name));
    return Number.isFinite(value) ? value : fallback;
  };

  const viewW = num('--app-view-width', window.innerWidth);
  const viewH = num('--app-view-height', window.innerHeight);
  const bleedX = num('--app-bleed-x', 0);
  const bleedY = num('--app-bleed-y', 0);
  const frameW = num('--app-frame-width', viewW);
  const frameH = num('--app-frame-height', viewH);

  return {
    viewW,
    viewH,
    bleedX,
    bleedY,
    frameW,
    frameH,
    /** Board-local centre of the visible viewport */
    cx: bleedX + viewW / 2,
    cy: bleedY + viewH / 2,
  };
}
