import { boundsForPositions, byStableOrder } from './graphModel';

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

export function centreParents(model, analysis, positions, orientation) {
  const vertical = orientation === 'vertical';
  const children = new Map(analysis.ids.map((id) => [id, []]));
  analysis.links.forEach(({ source, target }) => {
    children.get(source)?.push(target);
  });
  [...children.keys()]
    .sort((a, b) => (children.get(b).length - children.get(a).length) || byStableOrder(model.order)(a, b))
    .forEach((id) => {
      const kids = children.get(id).filter((child) => positions.has(child));
      if (!kids.length || !positions.has(id)) return;
      const parent = positions.get(id);
      const parentSize = model.sizes.get(id);
      const min = Math.min(...kids.map((child) => {
        const pos = positions.get(child);
        const size = model.sizes.get(child);
        return vertical ? pos.x + size.width / 2 : pos.y + size.height / 2;
      }));
      const max = Math.max(...kids.map((child) => {
        const pos = positions.get(child);
        const size = model.sizes.get(child);
        return vertical ? pos.x + size.width / 2 : pos.y + size.height / 2;
      }));
      const desired = (min + max) / 2 - (vertical ? parentSize.width : parentSize.height) / 2;
      positions.set(id, vertical ? { ...parent, x: desired } : { ...parent, y: desired });
    });
}

export function straightenChains(model, analysis, positions, orientation) {
  const vertical = orientation === 'vertical';
  const linksBySource = new Map(analysis.ids.map((id) => [id, []]));
  analysis.links.forEach(({ source, target }) => linksBySource.get(source)?.push(target));
  analysis.ids.forEach((id) => {
    let chain = [id];
    let current = id;
    const seen = new Set([id]);
    while ((linksBySource.get(current) || []).length === 1) {
      const next = linksBySource.get(current)[0];
      if (seen.has(next) || model.incoming.get(next).size !== 1) break;
      chain.push(next);
      seen.add(next);
      current = next;
    }
    if (chain.length < 4) return;
    const anchor = positions.get(chain[0]);
    chain.forEach((nodeId, index) => {
      const pos = positions.get(nodeId);
      if (!pos) return;
      const offset = index * (orientation === 'vertical' ? model.sizes.get(nodeId).height + 72 : model.sizes.get(nodeId).width + 96);
      positions.set(nodeId, vertical ? { ...pos, x: anchor.x, y: anchor.y + offset } : { ...pos, x: anchor.x + offset, y: anchor.y });
    });
  });
}

export function resolveCollisions(model, ids, positions, settings) {
  const ordered = [...ids].sort(byStableOrder(model.order));
  const padding = Math.max(24, Math.min(settings.horizontalSpacing, settings.verticalSpacing) * 0.35);
  for (let pass = 0; pass < 10; pass += 1) {
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
        const ax = pa.x + sa.width / 2;
        const ay = pa.y + sa.height / 2;
        const bx = pb.x + sb.width / 2;
        const by = pb.y + sb.height / 2;
        const dx = bx - ax || 1;
        const dy = by - ay || 1;
        const pushX = (sa.width + sb.width) / 2 + padding - Math.abs(dx);
        const pushY = (sa.height + sb.height) / 2 + padding - Math.abs(dy);
        if (pushX < pushY) {
          positions.set(b, { ...pb, x: pb.x + Math.sign(dx) * (pushX + 1) });
        } else {
          positions.set(b, { ...pb, y: pb.y + Math.sign(dy) * (pushY + 1) });
        }
        changed = true;
      }
    }
    if (!changed) break;
  }
}

export function optimiseComponent(model, analysis, layout, orientation, settings) {
  const positions = new Map(layout.positions);
  if (analysis.type === 'tree' || analysis.type === 'mostly-tree' || analysis.type === 'mind-map') {
    centreParents(model, analysis, positions, orientation);
  }
  straightenChains(model, analysis, positions, orientation);
  resolveCollisions(model, analysis.ids, positions, settings);
  normalisePositions(model, analysis.ids, positions);
  return { ...layout, positions };
}
