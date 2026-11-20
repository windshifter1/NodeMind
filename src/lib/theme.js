const STORAGE_KEY = 'thoughts-canvas-node-theme-v2';

export function readStoredTheme() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === 'light' || value === 'dark' || value === 'system') return value;
  } catch {
    /* ignore */
  }
  return 'light';
}

export function resolveTheme(pref) {
  if (pref === 'system' && typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return pref === 'dark' ? 'dark' : 'light';
}

export function applyDocumentTheme(pref) {
  const value = resolveTheme(pref);
  document.documentElement.setAttribute('data-theme', value);
  document.documentElement.setAttribute('data-theme-pref', pref || 'light');
  document.documentElement.classList.toggle('dark', value === 'dark');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', value === 'dark' ? '#121318' : '#f4f4f6');
}

export function persistTheme(pref) {
  const value = pref === 'dark' || pref === 'system' ? pref : 'light';
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* ignore */
  }
}

const DENSITY_KEY = 'noded-density';

export function readStoredDensity() {
  try {
    return localStorage.getItem(DENSITY_KEY) === 'compact' ? 'compact' : 'default';
  } catch {
    return 'default';
  }
}

export function applyDensity(density) {
  document.documentElement.setAttribute('data-density', density === 'compact' ? 'compact' : 'default');
}

export function persistDensity(density) {
  try {
    localStorage.setItem(DENSITY_KEY, density === 'compact' ? 'compact' : 'default');
  } catch {
    /* ignore */
  }
}

const A11Y_FONT_KEY = 'noded-a11y-font';
const A11Y_CONTRAST_KEY = 'noded-a11y-contrast';

export function readStoredA11yFont() {
  try {
    const value = localStorage.getItem(A11Y_FONT_KEY);
    if (value === 'large' || value === 'xl') return value;
  } catch {
    /* ignore */
  }
  return 'default';
}

export function applyA11yFont(size) {
  const value = size === 'large' || size === 'xl' ? size : 'default';
  document.documentElement.setAttribute('data-a11y-font', value);
}

export function persistA11yFont(size) {
  const value = size === 'large' || size === 'xl' ? size : 'default';
  try {
    localStorage.setItem(A11Y_FONT_KEY, value);
  } catch {
    /* ignore */
  }
}

export function readStoredA11yContrast() {
  try {
    return localStorage.getItem(A11Y_CONTRAST_KEY) === 'high' ? 'high' : 'default';
  } catch {
    return 'default';
  }
}

export function applyA11yContrast(contrast) {
  document.documentElement.setAttribute('data-a11y-contrast', contrast === 'high' ? 'high' : 'default');
}

export function persistA11yContrast(contrast) {
  try {
    localStorage.setItem(A11Y_CONTRAST_KEY, contrast === 'high' ? 'high' : 'default');
  } catch {
    /* ignore */
  }
}
