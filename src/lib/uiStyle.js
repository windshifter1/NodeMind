const STORAGE_KEY = 'nodemind-ui-style-v1';

export const UI_STYLE = {
  ORIGINAL: 'original',
  MODERN: 'modern',
};

export function normalizeUiStyle(value) {
  return value === UI_STYLE.ORIGINAL ? UI_STYLE.ORIGINAL : UI_STYLE.MODERN;
}

/** Default is Modern (glass) — the new main look. */
export function readStoredUiStyle() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === UI_STYLE.ORIGINAL) return UI_STYLE.ORIGINAL;
    if (raw === UI_STYLE.MODERN) return UI_STYLE.MODERN;
    // Unset → Modern (new default). Explicit 'original' stays original.
    return UI_STYLE.MODERN;
  } catch {
    return UI_STYLE.MODERN;
  }
}

export function applyDocumentUiStyle(style) {
  const value = normalizeUiStyle(style);
  document.documentElement.setAttribute('data-ui-style', value);
}

export function persistUiStyle(style) {
  try {
    localStorage.setItem(STORAGE_KEY, normalizeUiStyle(style));
  } catch {
    /* ignore */
  }
}

export function isModernUiStyle(style = readStoredUiStyle()) {
  return normalizeUiStyle(style) === UI_STYLE.MODERN;
}
