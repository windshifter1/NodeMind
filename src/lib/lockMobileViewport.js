export function lockMobileViewport() {
  if (typeof window === 'undefined') return () => {};

  const blockGesture = (event) => {
    event.preventDefault();
  };

  document.addEventListener('gesturestart', blockGesture, { passive: false });
  document.addEventListener('gesturechange', blockGesture, { passive: false });
  document.addEventListener('gestureend', blockGesture, { passive: false });

  return () => {
    document.removeEventListener('gesturestart', blockGesture);
    document.removeEventListener('gesturechange', blockGesture);
    document.removeEventListener('gestureend', blockGesture);
  };
}
