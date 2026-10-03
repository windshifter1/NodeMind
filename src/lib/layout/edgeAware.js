/**
 * Edge-aware layout helpers (experiment).
 * Scores connection-line crossings + edges running through unrelated nodes,
 * then locally nudges/swaps nodes on the cross-axis to clear the clutter.
 */

import { byStableOrder } from './graphModel.js';

function orient(orientation) {
  return orientation === 'vertical' ? 'vertical' : 'horizontal';
}

function stableIdCmp(model, a, b) {
  return byStableOrder(model.order)(a, b);
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
  // Tie-break with stable IDs so the search order does not depend on the prior canvas.
  for (let pass = 0; pass < 4; pass += 1) {
    const ordered = [...movable].sort(
      (a, b) =>
        primaryCoord(positions.get(a), orientation) - primaryCoord(positions.get(b), orientation) ||
        crossCoord(positions.get(a), orientation) - crossCoord(positions.get(b), orientation) ||
        stableIdCmp(model, a, b)
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

  // Nudge in stable ID order so workspace node-array order cannot change the result.
  [...movable]
    .sort((a, b) => stableIdCmp(model, a, b))
    .forEach((id) => {
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

/**
 * When several nodes feed the same target (or leave the same source), pack them
 * on the cross-axis with a minimum gap so their connection chords do not sit on
 * top of each other.
 */
export function spreadSharedHubNeighbors(
  model,
  analysis,
  positions,
  orientation,
  settings,
  fixedIds = new Set(),
  options = {}
) {
  const aggressive = !!options.aggressive;
  const minGap = Math.max(
    aggressive ? 88 : 64,
    (settings.verticalSpacing || 48) * (aggressive ? 1.75 : 1.35)
  );
  const vertical = orient(orientation) === 'vertical';

  const packGroup = (hubId, neighborIds) => {
    const unique = [...new Set(neighborIds)].filter((id) => positions.has(id));
    if (unique.length < 2) return;

    const hub = positions.get(hubId);
    const hubSize = model.sizes.get(hubId);
    if (!hub || !hubSize) return;

    const hubCross = vertical
      ? hub.x + hubSize.width / 2
      : hub.y + Math.min(22, hubSize.height / 2);

    // Always pack in stable ID order so the same hub topology gets the same
    // neighbour order regardless of where nodes sat before organise.
    const ordered = unique.sort((a, b) => stableIdCmp(model, a, b));

    // Ideal centres spaced by minGap, centred on the hub socket.
    const total = (ordered.length - 1) * minGap;
    let cursor = hubCross - total / 2;

    ordered.forEach((id) => {
      if (fixedIds.has(id)) {
        const pos = positions.get(id);
        const size = model.sizes.get(id);
        cursor = (vertical ? pos.x + size.width / 2 : pos.y + Math.min(22, size.height / 2)) + minGap;
        return;
      }
      const pos = positions.get(id);
      const size = model.sizes.get(id);
      if (!pos || !size) return;
      if (vertical) {
        positions.set(id, { x: cursor - size.width / 2, y: pos.y });
      } else {
        positions.set(id, { x: pos.x, y: cursor - Math.min(22, size.height / 2) });
      }
      cursor += minGap;
    });
  };

  // Only spread sources into multi-input hubs. Spreading outbound targets as
  // well fights those hubs (a shared sink gets yanked by each parent).
  const incoming = new Map();
  analysis.links.forEach((link) => {
    if (!incoming.has(link.target)) incoming.set(link.target, []);
    incoming.get(link.target).push(link.source);
  });

  incoming.forEach((sources, target) => {
    if (new Set(sources).size >= 2) packGroup(target, sources);
  });

  return positions;
}

/**
 * /dev2: push nodes apart when two connection chords share a long near-parallel
 * overlap, instead of bending the drawn curves.
 */
export function separateOverlappingCorridors(
  model,
  analysis,
  positions,
  orientation,
  settings,
  fixedIds = new Set()
) {
  const vertical = orient(orientation) === 'vertical';
  const minCrossGap = Math.max(56, (settings.verticalSpacing || 48) * 1.2);
  const minOverlap = Math.max(48, (settings.horizontalSpacing || 80) * 0.45);
  const segs = () => buildSegments(model, analysis, positions, orientation);

  const overlapInfo = (a, b) => {
    if (vertical) {
      const a0 = Math.min(a.y1, a.y2);
      const a1 = Math.max(a.y1, a.y2);
      const b0 = Math.min(b.y1, b.y2);
      const b1 = Math.max(b.y1, b.y2);
      const overlap = Math.min(a1, b1) - Math.max(a0, b0);
      if (overlap < minOverlap) return null;
      const mid = (Math.max(a0, b0) + Math.min(a1, b1)) / 2;
      const tA = (mid - a.y1) / (a.y2 - a.y1 || 1);
      const tB = (mid - b.y1) / (b.y2 - b.y1 || 1);
      const ax = a.x1 + (a.x2 - a.x1) * Math.max(0, Math.min(1, tA));
      const bx = b.x1 + (b.x2 - b.x1) * Math.max(0, Math.min(1, tB));
      return { overlap, crossGap: Math.abs(ax - bx), sign: Math.sign(bx - ax) || 1 };
    }
    const a0 = Math.min(a.x1, a.x2);
    const a1 = Math.max(a.x1, a.x2);
    const b0 = Math.min(b.x1, b.x2);
    const b1 = Math.max(b.x1, b.x2);
    const overlap = Math.min(a1, b1) - Math.max(a0, b0);
    if (overlap < minOverlap) return null;
    const mid = (Math.max(a0, b0) + Math.min(a1, b1)) / 2;
    const tA = (mid - a.x1) / (a.x2 - a.x1 || 1);
    const tB = (mid - b.x1) / (b.x2 - b.x1 || 1);
    const ay = a.y1 + (a.y2 - a.y1) * Math.max(0, Math.min(1, tA));
    const by = b.y1 + (b.y2 - b.y1) * Math.max(0, Math.min(1, tB));
    return { overlap, crossGap: Math.abs(ay - by), sign: Math.sign(by - ay) || 1 };
  };

  const pushNode = (id, delta) => {
    if (!id || fixedIds.has(id) || !positions.has(id)) return false;
    nudgeCross(positions, id, delta, orientation);
    return true;
  };

  for (let pass = 0; pass < 6; pass += 1) {
    let moved = false;
    const list = segs().sort((a, b) => String(a.id || '').localeCompare(String(b.id || ''), undefined, { numeric: true }));
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i];
        const b = list[j];
        const info = overlapInfo(a, b);
        if (!info || info.crossGap >= minCrossGap) continue;

        const need = (minCrossGap - info.crossGap) / 2 + 4;
        // Deterministic push direction from stable endpoint ids, not geometry sign.
        const dirSeed = `${a.source}:${a.target}:${b.source}:${b.target}`;
        const dir = dirSeed < `${b.source}:${b.target}:${a.source}:${a.target}` ? 1 : -1;
        const aEnds = [a.source, a.target];
        const bEnds = [b.source, b.target];
        let did = false;
        bEnds.forEach((id) => {
          if (aEnds.includes(id)) return;
          if (pushNode(id, dir * need)) did = true;
        });
        aEnds.forEach((id) => {
          if (bEnds.includes(id)) return;
          if (pushNode(id, -dir * need)) did = true;
        });
        if (did) moved = true;
      }
    }
    if (!moved) break;
  }

  return positions;
}

function edgePeerKey(edge) {
  const fromIsOut = edge.fromType === 'output';
  const source = fromIsOut ? edge.fromNode : edge.toNode;
  const target = fromIsOut ? edge.toNode : edge.fromNode;
  const slot = edge.inputSlot || '';
  return {
    source,
    target,
    sourceKey: `${source}:out`,
    targetKey: `${target}:in:${slot}`,
    corridorKey: `${source}->${target}:${slot}`,
  };
}

function crossOfNode(node, orientation) {
  if (!node) return 0;
  return orient(orientation) === 'vertical' ? node.x : node.y;
}

/**
 * Lateral offsets so edges that share a socket fan apart when drawn.
 * Target-socket fans are assigned first (fixes multi-input hubs like D1);
 * source fans only add separation when edges are still stacked.
 * Never sum opposing fans that cancel to zero.
 */
export function planEdgeDisplayOffsets(edges, orientation = 'horizontal', nodes = []) {
  const nodeById = new Map((nodes || []).map((n) => [n.id, n]));
  const offsets = new Map();
  (edges || []).forEach((edge) => offsets.set(edge.id, 0));

  const byTarget = new Map();
  const bySource = new Map();
  const byCorridor = new Map();

  (edges || []).forEach((edge) => {
    const keys = edgePeerKey(edge);
    if (!byTarget.has(keys.targetKey)) byTarget.set(keys.targetKey, []);
    if (!bySource.has(keys.sourceKey)) bySource.set(keys.sourceKey, []);
    if (!byCorridor.has(keys.corridorKey)) byCorridor.set(keys.corridorKey, []);
    byTarget.get(keys.targetKey).push(edge);
    bySource.get(keys.sourceKey).push(edge);
    byCorridor.get(keys.corridorKey).push(edge);
  });

  const sortEdges = (list, peerNodeId) =>
    [...list].sort((a, b) => {
      const aPeer = peerNodeId(a);
      const bPeer = peerNodeId(b);
      const d = crossOfNode(nodeById.get(aPeer), orientation) - crossOfNode(nodeById.get(bPeer), orientation);
      if (Math.abs(d) > 0.5) return d;
      return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
    });

  const assignAbsoluteFan = (edgeList, spacing, peerNodeId) => {
    if (edgeList.length < 2) return;
    const ordered = sortEdges(edgeList, peerNodeId);
    const mid = (ordered.length - 1) / 2;
    ordered.forEach((edge, index) => {
      offsets.set(edge.id, (index - mid) * spacing);
    });
  };

  // Edges that already belong to a multi-input hub keep that fan exclusively —
  // source-side fans used to cancel it (one inbound ended at lateral 0).
  const multiInbound = new Set();
  byTarget.forEach((list) => {
    if (list.length >= 2) list.forEach((edge) => multiInbound.add(edge.id));
  });

  // 1) Shared input sockets — the D1 case. Strong absolute fan.
  byTarget.forEach((list) => {
    assignAbsoluteFan(list, 32, (edge) => edgePeerKey(edge).source);
  });

  // 2) Shared output sockets — fan only edges not already claimed by a hub input.
  bySource.forEach((list) => {
    const free = list.filter((edge) => !multiInbound.has(edge.id));
    if (free.length < 2) return;
    assignAbsoluteFan(free, 22, (edge) => edgePeerKey(edge).target);
  });

  // 3) Exact duplicate corridors (same source→target) get an extra push.
  byCorridor.forEach((list) => {
    if (list.length < 2) return;
    const ordered = [...list].sort((a, b) =>
      String(a.id).localeCompare(String(b.id), undefined, { numeric: true })
    );
    const mid = (ordered.length - 1) / 2;
    ordered.forEach((edge, index) => {
      const base = offsets.get(edge.id) || 0;
      offsets.set(edge.id, base + (index - mid) * 12);
    });
  });

  return { offsets, orientation };
}
