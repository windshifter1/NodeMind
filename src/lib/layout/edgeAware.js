/**
 * Edge-aware layout helpers (experiment).
 * Scores connection-line crossings + edges running through unrelated nodes,
 * then locally nudges/swaps nodes on the cross-axis to clear the clutter.
 */

function orient(orientation) {
  return orientation === 'vertical' ? 'vertical' : 'horizontal';
}

function socketEnds(model, positions, orientation, link) {
  const pa = positions.get(link.source);
  const pb = positions.get(link.target);
  const sa = model.sizes.get(link.source);
  const sb = model.sizes.get(link.target);
  if (!pa || !pb || !sa || !sb) return null;

  if (orient(orientation) === 'vertical') {
    return {
      x1: pa.x + sa.width / 2,
      y1: pa.y + sa.height,
      x2: pb.x + sb.width / 2,
      y2: pb.y,
      source: link.source,
      target: link.target,
      id: link.id,
    };
  }
  const midA = Math.min(22, sa.height / 2);
  const midB = Math.min(22, sb.height / 2);
  return {
    x1: pa.x + sa.width,
    y1: pa.y + midA,
    x2: pb.x,
    y2: pb.y + midB,
    source: link.source,
    target: link.target,
    id: link.id,
  };
}

function ccw(ax, ay, bx, by, cx, cy) {
  return (cy - ay) * (bx - ax) > (by - ay) * (cx - ax);
}

function segmentsCross(a, b) {
  // Shared endpoints are not crossings.
  if (
    a.source === b.source ||
    a.source === b.target ||
    a.target === b.source ||
    a.target === b.target
  ) {
    return false;
  }
  const ab = ccw(a.x1, a.y1, a.x2, a.y2, b.x1, b.y1) !== ccw(a.x1, a.y1, a.x2, a.y2, b.x2, b.y2);
  const cd = ccw(b.x1, b.y1, b.x2, b.y2, a.x1, a.y1) !== ccw(b.x1, b.y1, b.x2, b.y2, a.x2, a.y2);
  return ab && cd;
}

function pointOnSeg(px, py, x1, y1, x2, y2, eps = 0.5) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-6) return Math.hypot(px - x1, py - y1) <= eps;
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy)) <= eps;
}

function segHitsRect(seg, rect, pad) {
  const left = rect.x - pad;
  const right = rect.x + rect.width + pad;
  const top = rect.y - pad;
  const bottom = rect.y + rect.height + pad;

  // Entirely outside the expanded AABB on one side.
  if (
    (seg.x1 < left && seg.x2 < left) ||
    (seg.x1 > right && seg.x2 > right) ||
    (seg.y1 < top && seg.y2 < top) ||
    (seg.y1 > bottom && seg.y2 > bottom)
  ) {
    return false;
  }

  // Sample along the chord; cheap and good enough for layout scoring.
  const steps = 8;
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const x = seg.x1 + (seg.x2 - seg.x1) * t;
    const y = seg.y1 + (seg.y2 - seg.y1) * t;
    if (x >= left && x <= right && y >= top && y <= bottom) return true;
  }
  return (
    pointOnSeg(left, top, seg.x1, seg.y1, seg.x2, seg.y2) ||
    pointOnSeg(right, top, seg.x1, seg.y1, seg.x2, seg.y2) ||
    pointOnSeg(left, bottom, seg.x1, seg.y1, seg.x2, seg.y2) ||
    pointOnSeg(right, bottom, seg.x1, seg.y1, seg.x2, seg.y2)
  );
}

function buildSegments(model, analysis, positions, orientation) {
  return analysis.links
    .map((link) => socketEnds(model, positions, orientation, link))
    .filter(Boolean);
}

export function scoreEdgeLayout(model, analysis, positions, orientation) {
  const segs = buildSegments(model, analysis, positions, orientation);
  let crossings = 0;
  for (let i = 0; i < segs.length; i += 1) {
    for (let j = i + 1; j < segs.length; j += 1) {
      if (segmentsCross(segs[i], segs[j])) crossings += 1;
    }
  }

  let throughNodes = 0;
  analysis.ids.forEach((id) => {
    const pos = positions.get(id);
    const size = model.sizes.get(id);
    if (!pos || !size) return;
    const rect = { x: pos.x, y: pos.y, width: size.width, height: size.height };
    segs.forEach((seg) => {
      if (seg.source === id || seg.target === id) return;
      if (segHitsRect(seg, rect, 6)) throughNodes += 1;
    });
  });

  // Mild penalty for nearly-overlapping parallel corridors (same endpoints band).
  let stacked = 0;
  const vertical = orient(orientation) === 'vertical';
  for (let i = 0; i < segs.length; i += 1) {
    for (let j = i + 1; j < segs.length; j += 1) {
      const a = segs[i];
      const b = segs[j];
      if (a.source === b.source || a.target === b.target) {
        const da = vertical ? Math.abs(a.x1 - b.x1) + Math.abs(a.x2 - b.x2) : Math.abs(a.y1 - b.y1) + Math.abs(a.y2 - b.y2);
        if (da < 18) stacked += 1;
      }
    }
  }

  return crossings * 12 + throughNodes * 20 + stacked * 4;
}

function swapCross(positions, a, b, orientation) {
  const pa = positions.get(a);
  const pb = positions.get(b);
  if (!pa || !pb) return;
  if (orient(orientation) === 'vertical') {
    positions.set(a, { x: pb.x, y: pa.y });
    positions.set(b, { x: pa.x, y: pb.y });
  } else {
    positions.set(a, { x: pa.x, y: pb.y });
    positions.set(b, { x: pb.x, y: pa.y });
  }
}

function nudgeCross(positions, id, delta, orientation) {
  const pos = positions.get(id);
  if (!pos) return;
  if (orient(orientation) === 'vertical') {
    positions.set(id, { x: pos.x + delta, y: pos.y });
  } else {
    positions.set(id, { x: pos.x, y: pos.y + delta });
  }
}

function crossCoord(pos, orientation) {
  return orient(orientation) === 'vertical' ? pos.x : pos.y;
}

function primaryCoord(pos, orientation) {
  return orient(orientation) === 'vertical' ? pos.y : pos.x;
}

/**
 * Local search: swap neighbours on the cross-axis and nudge nodes to cut
 * crossings / edges-through-nodes. Mutates `positions`.
 */
export function reduceEdgeClutter(model, analysis, positions, orientation, settings, fixedIds = new Set()) {
  if (analysis.ids.length < 2 || analysis.links.length < 1) return positions;

  const movable = analysis.ids.filter((id) => !fixedIds.has(id));
  if (!movable.length) return positions;

  const step = Math.max(24, (settings.verticalSpacing || 48) * 0.55);
  let best = scoreEdgeLayout(model, analysis, positions, orientation);
  if (best === 0) return positions;

  // Passes of neighbour swaps along the cross axis within similar primary bands.
  for (let pass = 0; pass < 4; pass += 1) {
    const ordered = [...movable].sort(
      (a, b) =>
        primaryCoord(positions.get(a), orientation) - primaryCoord(positions.get(b), orientation) ||
        crossCoord(positions.get(a), orientation) - crossCoord(positions.get(b), orientation)
    );

    let improved = false;
    for (let i = 0; i < ordered.length - 1; i += 1) {
      const a = ordered[i];
      const b = ordered[i + 1];
      const pa = positions.get(a);
      const pb = positions.get(b);
      if (!pa || !pb) continue;
      // Only swap when roughly in the same "column/row" of the flow.
      if (Math.abs(primaryCoord(pa, orientation) - primaryCoord(pb, orientation)) > (settings.horizontalSpacing || 80) * 0.75) {
        continue;
      }
      swapCross(positions, a, b, orientation);
      const next = scoreEdgeLayout(model, analysis, positions, orientation);
      if (next < best) {
        best = next;
        improved = true;
      } else {
        swapCross(positions, a, b, orientation);
      }
    }
    if (!improved) break;
    if (best === 0) return positions;
  }

  // Nudge each movable node on the cross-axis if it clears clutter.
  movable.forEach((id) => {
    for (const delta of [-step, step, -step * 2, step * 2]) {
      nudgeCross(positions, id, delta, orientation);
      const next = scoreEdgeLayout(model, analysis, positions, orientation);
      if (next < best) {
        best = next;
      } else {
        nudgeCross(positions, id, -delta, orientation);
      }
      if (best === 0) return;
    }
  });

  return positions;
}

/** Lateral offsets so parallel edges from the same socket fan apart when drawn. */
export function planEdgeDisplayOffsets(edges, orientation = 'horizontal') {
  const groups = new Map();
  (edges || []).forEach((edge) => {
    const key = `${edge.fromNode}|${edge.fromType}|${edge.toNode}|${edge.toType}|${edge.inputSlot || ''}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(edge.id);
  });

  // Also group by shared source socket (fan outbound) and shared target socket.
  const bySource = new Map();
  const byTarget = new Map();
  (edges || []).forEach((edge) => {
    const sKey = `${edge.fromType === 'output' ? edge.fromNode : edge.toNode}:out`;
    const tKey = `${edge.fromType === 'output' ? edge.toNode : edge.fromNode}:in:${edge.inputSlot || ''}`;
    if (!bySource.has(sKey)) bySource.set(sKey, []);
    if (!byTarget.has(tKey)) byTarget.set(tKey, []);
    bySource.get(sKey).push(edge.id);
    byTarget.get(tKey).push(edge.id);
  });

  const offsets = new Map();
  const applyFan = (ids) => {
    if (ids.length < 2) return;
    const mid = (ids.length - 1) / 2;
    ids.forEach((id, index) => {
      const prior = offsets.get(id) || 0;
      const fan = (index - mid) * 14;
      offsets.set(id, prior + fan);
    });
  };

  bySource.forEach(applyFan);
  byTarget.forEach(applyFan);

  // Exact duplicate corridors get a stronger push.
  groups.forEach((ids) => {
    if (ids.length < 2) return;
    const mid = (ids.length - 1) / 2;
    ids.forEach((id, index) => {
      const prior = offsets.get(id) || 0;
      offsets.set(id, prior + (index - mid) * 8);
    });
  });

  return { offsets, orientation };
}
