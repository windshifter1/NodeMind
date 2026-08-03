import { applyAppFrameHeight, resetViewportLock } from '@/lib/lockMobileViewport';

const FULLSCREEN_CLASS = 'app-fullscreen';
const FULLSCREEN_EVENT = 'nm-fullscreenchange';

/** Installed Home Screen / standalone app — not in-browser mobile Safari/Chrome. */
export function isStandalonePwa() {
  if (typeof window === 'undefined') return false;
  // Do not use display-mode:fullscreen — that also matches the native Fullscreen API.
  return (
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
    window.navigator?.standalone === true
  );
}

/**
 * Fullscreen control is available everywhere except installed mobile/desktop PWAs
 * (already chrome-less). Mobile *web* keeps the control and uses native API or
 * a screen-filling pseudo mode.
 */
export function isFullscreenAvailable() {
  if (typeof window === 'undefined') return false;
  return !isStandalonePwa();
}

function notifyFullscreenChange() {
  window.dispatchEvent(new Event(FULLSCREEN_EVENT));
}

function setFullscreenFlag(active) {
  const root = document.documentElement;
  if (active) root.dataset.nmFullscreen = '1';
  else delete root.dataset.nmFullscreen;
}

export function isAppFullscreenFlagSet() {
  return document.documentElement.dataset.nmFullscreen === '1';
}

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

function remountViewport() {
  resetViewportLock();
  applyAppFrameHeight();
  window.setTimeout(applyAppFrameHeight, 50);
  window.setTimeout(applyAppFrameHeight, 300);
  window.dispatchEvent(new Event('resize'));
}

/**
 * Briefly allow a scroll nudge so mobile Safari/Chrome can collapse browser chrome.
 * Our shell normally blocks document scroll.
 */
function tryCollapseBrowserChrome() {
  const html = document.documentElement;
  const body = document.body;
  const prevHtmlOverflow = html.style.overflow;
  const prevBodyOverflow = body.style.overflow;
  const prevHtmlHeight = html.style.height;

  html.style.overflow = 'auto';
  body.style.overflow = 'auto';
  html.style.height = `${Math.max(window.innerHeight, window.screen?.height || 0) + 120}px`;

  window.scrollTo(0, 1);
  window.setTimeout(() => {
    window.scrollTo(0, 0);
    html.style.overflow = prevHtmlOverflow;
    body.style.overflow = prevBodyOverflow;
    html.style.height = prevHtmlHeight;
    remountViewport();
  }, 50);
}

function enablePseudoFullscreen() {
  document.documentElement.classList.add(FULLSCREEN_CLASS);
  document.body.classList.add(FULLSCREEN_CLASS);
  setFullscreenFlag(true);
  tryCollapseBrowserChrome();
  remountViewport();
  notifyFullscreenChange();
}

function disablePseudoFullscreen() {
  const wasActive = isPseudoFullscreenActive();
  document.documentElement.classList.remove(FULLSCREEN_CLASS);
  document.body.classList.remove(FULLSCREEN_CLASS);
  setFullscreenFlag(false);
  if (wasActive) {
    remountViewport();
    notifyFullscreenChange();
  }
}

export async function enterFullscreen() {
  if (!isFullscreenAvailable()) return;

  // Android / desktop: prefer the real Fullscreen API when it works.
  try {
    await requestNativeFullscreen();
    if (isNativeFullscreenActive()) {
      setFullscreenFlag(true);
      remountViewport();
      notifyFullscreenChange();
      return;
    }
  } catch {
    /* iOS Safari and some mobile browsers — fall through to pseudo mode */
  }

  enablePseudoFullscreen();
}

export async function exitFullscreen() {
  disablePseudoFullscreen();
  if (isNativeFullscreenActive()) {
    try {
      await exitNativeFullscreen();
    } catch {
      /* ignore */
    }
  }
  setFullscreenFlag(false);
  remountViewport();
  notifyFullscreenChange();
}

export async function toggleFullscreen() {
  if (!isFullscreenAvailable()) {
    if (isFullscreenActive()) await exitFullscreen();
    return;
  }
  if (isFullscreenActive()) {
    await exitFullscreen();
  } else {
    await enterFullscreen();
  }
}

export function subscribeFullscreenChange(callback) {
  const sync = () => {
    // Keep the layout flag aligned when the browser exits native fullscreen.
    if (isNativeFullscreenActive() || isPseudoFullscreenActive()) {
      setFullscreenFlag(true);
    } else {
      setFullscreenFlag(false);
    }
    callback(isFullscreenActive());
  };
  document.addEventListener('fullscreenchange', sync);
  document.addEventListener('webkitfullscreenchange', sync);
  window.addEventListener(FULLSCREEN_EVENT, sync);
  window.addEventListener('resize', sync);
  window.addEventListener('orientationchange', sync);
  return () => {
    document.removeEventListener('fullscreenchange', sync);
    document.removeEventListener('webkitfullscreenchange', sync);
    window.removeEventListener(FULLSCREEN_EVENT, sync);
    window.removeEventListener('resize', sync);
    window.removeEventListener('orientationchange', sync);
  };
}
