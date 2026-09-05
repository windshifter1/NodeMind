const STORAGE_KEY = 'nodemind-ui-style-v2';
const LEGACY_KEY = 'nodemind-ui-style-v1';

export const UI_STYLE = {
  LENS: 'lens',
  ACRYLIC: 'acrylic',
  GEL: 'gel',
  CLAY_SOFT: 'clay-soft',
  SKETCH: 'sketch',
};

export const UI_STYLE_OPTIONS = [
  {
    value: UI_STYLE.LENS,
    label: 'Lens',
    blurb: 'Clear refractive glass — strong specular rim, thin edge, lens blur.',
  },
  {
    value: UI_STYLE.ACRYLIC,
    label: 'Acrylic',
    blurb: 'Denser vibrancy frost — tinted wash, colour bloom, softer edges.',
  },
  {
    value: UI_STYLE.GEL,
    label: 'Gel',
    blurb: 'Organic liquid blobs — wet highlights, irregular radii, ploppy controls.',
  },
  {
    value: UI_STYLE.CLAY_SOFT,
    label: 'Soft clay',
    blurb: 'Claymorphism — matte pastels, dual soft shadows, chubby rounded chrome.',
  },
  {
    value: UI_STYLE.SKETCH,
    label: 'Sketch',
    blurb: 'Hand-sketched UI — paper grain, ink outlines, imperfect edges, notebook vibe.',
  },
];

const GLASS = new Set([UI_STYLE.LENS, UI_STYLE.ACRYLIC, UI_STYLE.GEL]);
const ALLOWED = new Set(Object.values(UI_STYLE));

const LEGACY_MAP = {
  modern: UI_STYLE.LENS,
  prototype: UI_STYLE.GEL,
  original: UI_STYLE.ACRYLIC,
  'clay-vivid': UI_STYLE.CLAY_SOFT,
  whiteboard: UI_STYLE.SKETCH,
};

export function normalizeUiStyle(value) {
  if (ALLOWED.has(value)) return value;
  if (LEGACY_MAP[value]) return LEGACY_MAP[value];
  return UI_STYLE.LENS;
}

export function isGlassUiStyle(style = readStoredUiStyle()) {
  return GLASS.has(normalizeUiStyle(style));
}

export function usesLiquidMotion(style = readStoredUiStyle()) {
  return isGlassUiStyle(style);
}

export function readStoredUiStyle() {
  try {
    const next = localStorage.getItem(STORAGE_KEY);
    if (next) return normalizeUiStyle(next);
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) return normalizeUiStyle(legacy);
  } catch {
    /* ignore */
  }
  return UI_STYLE.LENS;
}

export function persistUiStyle(style) {
  const value = normalizeUiStyle(style);
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* ignore */
  }
}

export function applyDocumentUiStyle(style = readStoredUiStyle()) {
  const value = normalizeUiStyle(style);
  document.documentElement.setAttribute('data-ui-style', value);
  document.documentElement.setAttribute('data-ui-family', GLASS.has(value) ? 'glass' : value);
}
