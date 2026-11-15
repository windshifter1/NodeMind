/** Gen II has a single chrome. Legacy style ids are ignored. */

export function readStoredUiStyle() {
  return 'gen-ii';
}

export function persistUiStyle() {}

export function applyDocumentUiStyle() {
  document.documentElement.removeAttribute('data-ui-style');
  document.documentElement.removeAttribute('data-ui-family');
}

export function isGlassUiStyle() {
  return false;
}

export function usesLiquidMotion() {
  return false;
}
