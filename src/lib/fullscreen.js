const FULLSCREEN_CLASS = 'app-fullscreen';

function requestNativeFullscreen() {
  const el = document.documentElement;
  const request = el.requestFullscreen?.bind(el) || el.webkitRequestFullscreen?.bind(el);
  if (!request) return Promise.reject(new Error('Fullscreen API unavailable'));
  return request();
}

function exitNativeFullscreen() {
  const exit = document.exitFullscreen?.bind(document) || document.webkitExitFullscreen?.bind(document);
  if (!exit) return Promise.resolve();
  return exit();
}

export function isNativeFullscreenActive() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

export function isPseudoFullscreenActive() {
  return document.documentElement.classList.contains(FULLSCREEN_CLASS);
}

export function isFullscreenActive() {
  return isNativeFullscreenActive() || isPseudoFullscreenActive();
}

function enablePseudoFullscreen() {
  document.documentElement.classList.add(FULLSCREEN_CLASS);
  document.body.classList.add(FULLSCREEN_CLASS);
  window.scrollTo(0, 0);
  requestAnimationFrame(() => {
    window.scrollTo(0, 0);
    window.dispatchEvent(new Event('resize'));
  });
}

function disablePseudoFullscreen() {
  document.documentElement.classList.remove(FULLSCREEN_CLASS);
  document.body.classList.remove(FULLSCREEN_CLASS);
}

export async function enterFullscreen() {
  try {
    await requestNativeFullscreen();
    if (isNativeFullscreenActive()) return;
  } catch {
    /* use pseudo fullscreen on mobile browsers without Fullscreen API support */
  }
  enablePseudoFullscreen();
}

export async function exitFullscreen() {
  disablePseudoFullscreen();
  if (!isNativeFullscreenActive()) return;
  try {
    await exitNativeFullscreen();
  } catch {
    /* ignore */
  }
}

export async function toggleFullscreen() {
  if (isFullscreenActive()) {
    await exitFullscreen();
  } else {
    await enterFullscreen();
  }
}

export function subscribeFullscreenChange(callback) {
  const sync = () => callback(isFullscreenActive());
  document.addEventListener('fullscreenchange', sync);
  document.addEventListener('webkitfullscreenchange', sync);
  window.addEventListener('resize', sync);
  window.addEventListener('orientationchange', sync);
  return () => {
    document.removeEventListener('fullscreenchange', sync);
    document.removeEventListener('webkitfullscreenchange', sync);
    window.removeEventListener('resize', sync);
    window.removeEventListener('orientationchange', sync);
  };
}
