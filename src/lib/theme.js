const STORAGE_KEY = 'thoughts-canvas-node-theme-v2';

export function readStoredTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function applyDocumentTheme(theme) {
  const value = theme === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', value);
  document.documentElement.classList.toggle('dark', value === 'dark');
}

export function persistTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme === 'light' ? 'light' : 'dark');
  } catch {
    /* ignore */
  }
}
