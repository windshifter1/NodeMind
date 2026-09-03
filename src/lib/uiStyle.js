/** App chrome is always Modern glass. Kept so CSS can target data-ui-style. */
export const UI_STYLE = {
  MODERN: 'modern',
};

export function applyDocumentUiStyle() {
  document.documentElement.setAttribute('data-ui-style', UI_STYLE.MODERN);
}
