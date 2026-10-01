/** Workspace background art model helpers. */

export function emptyBackgroundArt() {
  return {
    strokes: [],
    images: [],
    tool: 'pan',
    penWidth: 3,
    color: '#334155',
    emissiveness: 0,
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
    penWidth: clamp(Number(raw.penWidth) || 3, 1, 48),
    color: typeof raw.color === 'string' ? raw.color : base.color,
    emissiveness: clamp(Number(raw.emissiveness) || 0, 0, 1),
    eraseMode: raw.eraseMode === 'area' ? 'area' : 'stroke',
  };
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
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
