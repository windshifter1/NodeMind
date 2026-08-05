/**
 * Lightweight pub/sub for interactive onboarding task detection.
 * Emitters may fire freely; the tour only advances on the current task's event.
 */

const listeners = new Set();

export function emitTutorial(event, detail = undefined) {
  if (!event) return;
  listeners.forEach((fn) => {
    try {
      fn(event, detail);
    } catch {
      /* ignore subscriber errors */
    }
  });
}

export function subscribeTutorial(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
