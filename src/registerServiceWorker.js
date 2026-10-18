export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  // Native wrapper already ships the built assets; do not fetch updates.
  if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) return;

  window.addEventListener('load', () => {
    const baseUrl = import.meta.env.BASE_URL || '/';
    navigator.serviceWorker
      .register(`${baseUrl}sw.js`, { scope: baseUrl })
      .then((registration) => {
        // Pull updates quickly after deploys so PWAs don't stick on a blank shell.
        registration.update().catch(() => {});
        setInterval(() => {
          registration.update().catch(() => {});
        }, 60 * 60 * 1000);
      })
      .catch(() => {
        // A failed registration should not block the app.
      });
  });
}
