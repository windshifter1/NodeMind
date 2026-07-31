export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;

  window.addEventListener('load', () => {
    const baseUrl = import.meta.env.BASE_URL || '/';
    navigator.serviceWorker
      .register(`${baseUrl}sw.js`, { scope: baseUrl })
      .catch(() => {
        // A failed registration should not block the app.
      });
  });
}
