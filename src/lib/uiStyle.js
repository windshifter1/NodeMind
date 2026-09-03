const STORAGE_KEY = 'nodemind-ui-style-v1';

export const UI_STYLE = {
  ORIGINAL: 'original',
  MODERN: 'modern',
  PROTOTYPE: 'prototype',
};

export function normalizeUiStyle(value) {
  if (value === UI_STYLE.ORIGINAL) return UI_STYLE.ORIGINAL;
  if (value === UI_STYLE.PROTOTYPE) return UI_STYLE.PROTOTYPE;
  if (value === UI_STYLE.MODERN) return UI_STYLE.MODERN;
  return UI_STYLE.MODERN;
}

/** Default is Modern. Prototype is opt-in. */
export function readStoredUiStyle() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === UI_STYLE.ORIGINAL) return UI_STYLE.ORIGINAL;
    if (raw === UI_STYLE.PROTOTYPE) return UI_STYLE.PROTOTYPE;
    if (raw === UI_STYLE.MODERN) return UI_STYLE.MODERN;
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

export function isPrototypeUiStyle(style = readStoredUiStyle()) {
  return normalizeUiStyle(style) === UI_STYLE.PROTOTYPE;
}

/** Styles that use gel buttons + node spawn plop/ripples. */
export function usesLiquidMotion(style = readStoredUiStyle()) {
  const value = normalizeUiStyle(style);
  return value === UI_STYLE.MODERN || value === UI_STYLE.PROTOTYPE;
}
