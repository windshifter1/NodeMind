import { normalizeBackgroundArt, newImageId, newStrokeId } from '@/lib/backgroundArt';

/** Nodes + edges render at this layer; annotations default below. */
export const NODES_LAYER_INDEX = 1000;

const LAYER_STEP = 10;

function annotatables(bg) {
  const strokes = (bg.strokes || []).map((s) => ({ kind: 'stroke', id: s.id, layer: layerOf(s) }));
  const images = (bg.images || []).map((img) => ({ kind: 'image', id: img.id, layer: layerOf(img) }));
  return [...strokes, ...images].sort((a, b) => a.layer - b.layer);
}

export function layerOf(item) {
  if (typeof item?.layer === 'number' && Number.isFinite(item.layer)) return item.layer;
  return NODES_LAYER_INDEX - LAYER_STEP;
}

export function migrateBackgroundArtLayers(bg) {
  const base = normalizeBackgroundArt(bg);
  let n = LAYER_STEP;
  const strokes = base.strokes.map((s) => {
    const layer = typeof s.layer === 'number' ? s.layer : n;
    if (typeof s.layer !== 'number') n += LAYER_STEP;
    return { ...s, layer };
  });
  const images = base.images.map((img) => {
    const layer = typeof img.layer === 'number' ? img.layer : n;
    if (typeof img.layer !== 'number') n += LAYER_STEP;
    return { ...img, layer };
  });
  return { ...base, strokes, images };
}

export function nextLayerBelowNodes(bg) {
  const items = annotatables(bg).filter((i) => i.layer < NODES_LAYER_INDEX);
  const max = items.length ? Math.max(...items.map((i) => i.layer)) : 0;
  return Math.min(NODES_LAYER_INDEX - 1, max + LAYER_STEP);
}

export function nextLayerAboveNodes(bg) {
  const items = annotatables(bg).filter((i) => i.layer > NODES_LAYER_INDEX);
  const max = items.length ? Math.max(...items.map((i) => i.layer)) : NODES_LAYER_INDEX;
  return max + LAYER_STEP;
}

export function moveAnnotationLayer(bg, id, kind, direction) {
  const art = migrateBackgroundArtLayers(bg);
  const items = annotatables(art);
  const self = items.find((i) => i.id === id && i.kind === kind);
  if (!self) return art;

  const sorted = [...items].sort((a, b) => a.layer - b.layer);
  const index = sorted.findIndex((i) => i.id === id && i.kind === kind);
  if (index < 0) return art;

  const swapWith =
    direction === 'forward' ? sorted[index + 1] : direction === 'back' ? sorted[index - 1] : null;

  const patchLayer = (source, targetId, targetKind, layer) => {
    if (targetKind === 'stroke') {
      return {
        ...source,
        strokes: source.strokes.map((s) => (s.id === targetId ? { ...s, layer } : s)),
      };
    }
    return {
      ...source,
      images: source.images.map((img) => (img.id === targetId ? { ...img, layer } : img)),
    };
  };

  if (swapWith) {
    let next = patchLayer(art, id, kind, swapWith.layer);
    next = patchLayer(next, swapWith.id, swapWith.kind, self.layer);
    return next;
  }

  if (direction === 'forward') {
    const layer =
      self.layer < NODES_LAYER_INDEX ? NODES_LAYER_INDEX + LAYER_STEP : self.layer + LAYER_STEP;
    return patchLayer(art, id, kind, layer);
  }

  if (direction === 'back') {
    const layer =
      self.layer > NODES_LAYER_INDEX
        ? NODES_LAYER_INDEX - LAYER_STEP
        : Math.max(LAYER_STEP, self.layer - LAYER_STEP);
    return patchLayer(art, id, kind, layer);
  }

  return art;
}

export function boundsForStroke(stroke) {
  const pts = stroke?.points || [];
  if (!pts.length) return null;
  let minX = pts[0].x;
  let maxX = pts[0].x;
  let minY = pts[0].y;
  let maxY = pts[0].y;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const pad = Math.max(6, (Number(stroke.width) || 3) + 4);
  return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
}

export function boundsForImage(img) {
  if (!img) return null;
  return { minX: img.x, minY: img.y, maxX: img.x + img.w, maxY: img.y + img.h };
}

export { newStrokeId, newImageId };