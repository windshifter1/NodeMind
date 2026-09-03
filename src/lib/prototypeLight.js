/**
 * Global specular light for Prototype liquid glass.
 * Tracks the pointer so highlights feel wet and directional.
 */
export function attachPrototypeLight(root = document) {
  const html = document.documentElement;

  const onMove = (e) => {
    if (html.getAttribute('data-ui-style') !== 'prototype') return;
    const x = e.clientX / Math.max(1, window.innerWidth);
    const y = e.clientY / Math.max(1, window.innerHeight);
    html.style.setProperty('--proto-lx', `${(x * 100).toFixed(2)}%`);
    html.style.setProperty('--proto-ly', `${(y * 100).toFixed(2)}%`);
    html.style.setProperty('--proto-lx-n', x.toFixed(3));
    html.style.setProperty('--proto-ly-n', y.toFixed(3));
  };

  // Seed a pleasant default (upper-left key light).
  html.style.setProperty('--proto-lx', '22%');
  html.style.setProperty('--proto-ly', '12%');
  html.style.setProperty('--proto-lx-n', '0.22');
  html.style.setProperty('--proto-ly-n', '0.12');

  root.addEventListener('pointermove', onMove, { passive: true });
  return () => root.removeEventListener('pointermove', onMove, { passive: true });
}
