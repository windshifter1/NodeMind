/** Workspace background art model helpers. */

export const PEN_WIDTH_PRESETS = [1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24];

export function snapPenWidth(value) {
  const n = Number(value) || 3;
  if (PEN_WIDTH_PRESETS.includes(n)) return n;
  let best = PEN_WIDTH_PRESETS[0];
  for (const preset of PEN_WIDTH_PRESETS) {
    if (Math.abs(preset - n) < Math.abs(best - n)) best = preset;
  }
  return best;
}

export function emptyBackgroundArt() {
  return {
    strokes: [],
    images: [],
    tool: 'pan',
    penWidth: 3,
    color: '#334155',
    eraseMode: 'stroke', // stroke | area
  };
}

export function normalizeBackgroundArt(raw) {
  const base = emptyBackgroundArt();
  if (!raw || typeof raw !== 'object') return base;
  const tool =
    raw.tool === 'erase' ||
    raw.tool === 'select' ||
    raw.tool === 'image' ||
    raw.tool === 'pen' ||
    raw.tool === 'pan'
      ? raw.tool
      : 'pan';
  return {
    strokes: Array.isArray(raw.strokes) ? raw.strokes : [],
    images: Array.isArray(raw.images) ? raw.images : [],
    tool,
    penWidth: snapPenWidth(raw.penWidth),
    color: typeof raw.color === 'string' ? raw.color : base.color,
    eraseMode: raw.eraseMode === 'area' ? 'area' : 'stroke',
  };
}

export function newStrokeId() {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function newImageId() {
  return `img_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Tools that paint/erase and should own pointer capture on the canvas. */
export function isDrawCaptureTool(tool) {
  return tool === 'pen' || tool === 'erase';
}
