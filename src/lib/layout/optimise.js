import { boundsForPositions, byStableOrder } from './graphModel.js';

function overlaps(a, aSize, b, bSize, padding) {
  return !(
    a.x + aSize.width + padding <= b.x ||
    b.x + bSize.width + padding <= a.x ||
    a.y + aSize.height + padding <= b.y ||
    b.y + bSize.height + padding <= a.y
  );
}

export function normalisePositions(model, ids, positions) {
  const bounds = boundsForPositions(model, ids, positions);
  ids.forEach((id) => {
    const pos = positions.get(id);
    positions.set(id, { x: pos.x - bounds.minX, y: pos.y - bounds.minY });
  });
  return positions;
}

/** Safety net only — tree-v2 should already be overlap-free. */
export function resolveCollisions(model, ids, positions, settings, fixedIds = new Set()) {
  const ordered = [...ids].sort(byStableOrder(model.order));
  const padding = Math.max(16, Math.min(settings.horizontalSpacing, settings.verticalSpacing) * 0.25);
  for (let pass = 0; pass < 8; pass += 1) {
    let changed = false;
    for (let i = 0; i < ordered.length; i += 1) {
      for (let j = i + 1; j < ordered.length; j += 1) {
        const a = ordered[i];
        const b = ordered[j];
        const pa = positions.get(a);
        const pb = positions.get(b);
        const sa = model.sizes.get(a);
        const sb = model.sizes.get(b);
        if (!pa || !pb || !overlaps(pa, sa, pb, sb, padding)) continue;

        const aFixed = fixedIds.has(a);
        const bFixed = fixedIds.has(b);
        if (aFixed && bFixed) continue;

        const ax = pa.x + sa.width / 2;
        const ay = pa.y + sa.height / 2;
        const bx = pb.x + sb.width / 2;
        const by = pb.y + sb.height / 2;
        const dx = bx - ax || 1;
        const dy = by - ay || 1;
        const pushX = (sa.width + sb.width) / 2 + padding - Math.abs(dx);
        const pushY = (sa.height + sb.height) / 2 + padding - Math.abs(dy);

        const moveId = aFixed ? b : bFixed ? a : b;
        const movePos = moveId === a ? pa : pb;
        const sign = moveId === a ? -1 : 1;

        if (pushX < pushY) {
          positions.set(moveId, { ...movePos, x: movePos.x + sign * Math.sign(dx) * (pushX + 1) });
        } else {
          positions.set(moveId, { ...movePos, y: movePos.y + sign * Math.sign(dy) * (pushY + 1) });
        }
        changed = true;
      }
    }
    if (!changed) break;
  }
}

export function optimiseComponent(model, analysis, layout, orientation, settings, fixedIds = new Set()) {
  const positions = new Map(layout.positions);
  const componentFixed = new Set(analysis.ids.filter((id) => fixedIds.has(id)));

  // Tree-v2 already centres parents and sizes subtrees — avoid post-passes that
  // fight the geometry (legacy centreParents / straightenChains caused jitter).
  if (layout.strategy !== 'tree-v2') {
    resolveCollisions(model, analysis.ids, positions, settings, componentFixed);
  }

  normalisePositions(model, analysis.ids, positions);
  return { ...layout, positions };
}
