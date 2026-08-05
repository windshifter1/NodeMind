import { byStableOrder } from './graphModel.js';

/**
 * Auto Organise — flow-preserving tidy layout.
 *
 * Tree edges follow directed connections (source → target).
 * The visual root is the start of the thought-flow, never the sink
 * of a reverse tree. Organising cleans spacing without inverting meaning.
 */

function toPoint(primary, cross, vertical) {
  return vertical ? { x: cross, y: primary } : { x: primary, y: cross };
}

function crossExtent(size, vertical) {
  return vertical ? size.width : size.height;
}

function primaryExtent(size, vertical) {
  return vertical ? size.height : size.width;
}

function compareIds(a, b, order) {
  return byStableOrder(order)(a, b);
}

function priorCross(model, id, orientation) {
  const node = model.nodeById.get(id);
  if (!node) return 0;
  return orientation === 'vertical' ? node.x : node.y;
}

function sortSiblings(ids, model, orientation, order) {
  return [...ids].sort((a, b) => {
    const d = priorCross(model, a, orientation) - priorCross(model, b, orientation);
    if (Math.abs(d) > 0.5) return d;
    return compareIds(a, b, order);
  });
}

function listSources(model, ids) {
  return ids.filter((id) => (model.incoming.get(id)?.size || 0) === 0 && (model.outgoing.get(id)?.size || 0) > 0);
}

function reachableCount(model, idSet, startId) {
  const seen = new Set([startId]);
  const queue = [startId];
  while (queue.length) {
    const id = queue.shift();
    (model.outgoing.get(id) || []).forEach((next) => {
      if (!idSet.has(next) || seen.has(next)) return;
      seen.add(next);
      queue.push(next);
    });
  }
  return seen.size;
}

/**
 * Prefer flow starts (sources / upstream), never sinks of reverse trees.
 * Ranking: reachability along outgoing edges, then out-degree, then id.
 */
export function scoreLayoutRoot(model, analysis, id) {
  const idSet = new Set(analysis.ids);
  const inn = model.incoming.get(id)?.size || 0;
  const out = model.outgoing.get(id)?.size || 0;
  const sources = listSources(model, analysis.ids);

  let score = reachableCount(model, idSet, id) * 20 + out * 8 - inn * 5;

  if (sources.length === 1 && id === sources[0]) score += 1000;
  if (sources.includes(id)) score += 200;
  // Actively penalise pure sinks so reverse trees keep flow start as root.
  if (out === 0 && inn > 0) score -= 500;

  return score;
}

export function chooseLayoutRoot(model, analysis, options = {}) {
  const idSet = new Set(analysis.ids);
  const order = model.order;
  const preferred = (options.preferredRootIds || []).filter((id) => idSet.has(id));
  const pinned = analysis.ids.filter((id) => model.nodeById.get(id)?.pinned);
  const sources = listSources(model, analysis.ids);

  const pick = (candidates) => {
    if (!candidates.length) return null;
    return [...candidates].sort(
      (a, b) =>
        scoreLayoutRoot(model, analysis, b) - scoreLayoutRoot(model, analysis, a) ||
        compareIds(a, b, order)
    )[0];
  };

  // Selection / pins bias which flow-start to use, but still prefer a source
  // inside that set when possible so direction is preserved.
  if (pinned.length) {
    const pinnedSources = pinned.filter((id) => sources.includes(id));
    return pick(pinnedSources) || pick(pinned);
  }
  if (preferred.length) {
    const preferredSources = preferred.filter((id) => sources.includes(id));
    return pick(preferredSources) || pick(preferred);
  }
  if (sources.length) return pick(sources);
  return pick(analysis.ids);
}

/**
 * Directed spanning forest: layout parent → child follows an outgoing edge.
 * Seeds are flow starts (sources), so reverse trees organise as
 * start → … → sink along the primary axis (arrows read forward).
 */
export function buildSpanningForest(model, analysis, orientation = 'horizontal', options = {}) {
  const idSet = new Set(analysis.ids);
  const order = model.order;

  const treeChildren = new Map(analysis.ids.map((id) => [id, []]));
  const treeParent = new Map(analysis.ids.map((id) => [id, null]));
  const assigned = new Set();
  const queue = [];

  const claim = (id, parent) => {
    if (assigned.has(id)) return false;
    assigned.add(id);
    treeParent.set(id, parent);
    if (parent != null) treeChildren.get(parent).push(id);
    queue.push(id);
    return true;
  };

  const expandOutgoing = () => {
    while (queue.length) {
      const id = queue.shift();
      const outs = [...(model.outgoing.get(id) || [])].filter((nid) => idSet.has(nid) && !assigned.has(nid));
      sortSiblings(outs, model, orientation, order).forEach((nid) => claim(nid, id));
    }
  };

  const sources = listSources(model, analysis.ids);
  const preferred = (options.preferredRootIds || []).filter((id) => idSet.has(id));
  const pinned = analysis.ids.filter((id) => model.nodeById.get(id)?.pinned);

  // Seed one primary flow-start first (max reach), expand fully, then add
  // remaining sources as extra roots. Seeding every source at once lets a
  // shallow branch claim the sink and flatten depth (arrows look sideways).
  const primary = chooseLayoutRoot(model, analysis, options);
  const initialSeeds = [];
  if (pinned.length) {
    pinned.forEach((id) => initialSeeds.push(id));
    if (primary && !initialSeeds.includes(primary)) initialSeeds.push(primary);
  } else if (primary) {
    initialSeeds.push(primary);
  }

  sortSiblings(initialSeeds, model, orientation, order).forEach((id) => claim(id, null));
  expandOutgoing();

  // Remaining sources become additional forest roots, then expand.
  sortSiblings(
    sources.filter((id) => !assigned.has(id)),
    model,
    orientation,
    order
  ).forEach((id) => {
    claim(id, null);
    expandOutgoing();
  });

  // Preferred mid-nodes that were never reached — seed so selection still works.
  sortSiblings(
    preferred.filter((id) => !assigned.has(id)),
    model,
    orientation,
    order
  ).forEach((id) => {
    claim(id, null);
    expandOutgoing();
  });

  // Attach remaining nodes under an already-placed directed predecessor.
  let progressed = true;
  while (progressed) {
    progressed = false;
    analysis.ids
      .filter((id) => !assigned.has(id))
      .sort((a, b) => compareIds(a, b, order))
      .forEach((id) => {
        const parents = [...(model.incoming.get(id) || [])]
          .filter((pid) => assigned.has(pid))
          .sort((a, b) => compareIds(a, b, order));
        if (!parents.length) return;
        if (claim(id, parents[0])) {
          progressed = true;
          expandOutgoing();
        }
      });
  }

  // True leftovers (cycles / odd connectivity) — new roots, then outgoing walk.
  analysis.ids
    .filter((id) => !assigned.has(id))
    .sort((a, b) => compareIds(a, b, order))
    .forEach((id) => {
      claim(id, null);
      expandOutgoing();
    });

  treeChildren.forEach((list, id) => {
    treeChildren.set(id, sortSiblings([...new Set(list)], model, orientation, order));
  });

  const roots = analysis.ids
    .filter((id) => treeParent.get(id) == null)
    .sort((a, b) => compareIds(a, b, order));

  return { treeChildren, treeParent, roots };
}

function measureSubtrees(model, treeChildren, roots, orientation, settings) {
  const vertical = orientation === 'vertical';
  const crossSpacing = settings.verticalSpacing;
  const memo = new Map();
  const visiting = new Set();

  const measure = (id) => {
    if (memo.has(id)) return memo.get(id);
    if (visiting.has(id)) {
      const size = model.sizes.get(id);
      return { span: crossExtent(size, vertical), depth: 0, childSpans: [], childrenSpan: 0 };
    }
    visiting.add(id);
    const size = model.sizes.get(id);
    const selfSpan = crossExtent(size, vertical);
    const kids = treeChildren.get(id) || [];
    if (!kids.length) {
      const result = { span: selfSpan, depth: 0, childSpans: [], childrenSpan: 0 };
      memo.set(id, result);
      visiting.delete(id);
      return result;
    }
    const childSpans = kids.map((child) => measure(child).span);
    const childrenSpan =
      childSpans.reduce((sum, span) => sum + span, 0) + Math.max(0, kids.length - 1) * crossSpacing;
    const depth = 1 + Math.max(...kids.map((child) => measure(child).depth));
    const result = {
      span: Math.max(selfSpan, childrenSpan),
      depth,
      childSpans,
      childrenSpan,
    };
    memo.set(id, result);
    visiting.delete(id);
    return result;
  };

  roots.forEach((root) => measure(root));
  return memo;
}

function placeForest(model, treeChildren, roots, measures, orientation, settings) {
  const vertical = orientation === 'vertical';
  const crossSpacing = settings.verticalSpacing;
  const primarySpacing = settings.horizontalSpacing;
  const graphGap = settings.graphSpacing * 0.45;
  const positions = new Map();

  const place = (id, primary, crossStart) => {
    const size = model.sizes.get(id);
    const selfCross = crossExtent(size, vertical);
    const selfPrimary = primaryExtent(size, vertical);
    const measured = measures.get(id) || { span: selfCross, childSpans: [], childrenSpan: 0 };
    const kids = treeChildren.get(id) || [];

    if (!kids.length) {
      const cross = crossStart + (measured.span - selfCross) / 2;
      positions.set(id, toPoint(primary, cross, vertical));
      return;
    }

    const childrenSpan = measured.childrenSpan;
    let childCursor = crossStart + Math.max(0, (measured.span - childrenSpan) / 2);
    const childCentres = [];

    kids.forEach((child, index) => {
      const childSpan = measured.childSpans[index];
      place(child, primary + selfPrimary + primarySpacing, childCursor);
      const childPos = positions.get(child);
      const childSize = model.sizes.get(child);
      const childCross = vertical ? childPos.x : childPos.y;
      childCentres.push(childCross + crossExtent(childSize, vertical) / 2);
      childCursor += childSpan + crossSpacing;
    });

    const mid = (Math.min(...childCentres) + Math.max(...childCentres)) / 2;
    let parentCross = mid - selfCross / 2;
    const bandMin = crossStart;
    const bandMax = crossStart + measured.span - selfCross;
    parentCross = Math.min(bandMax, Math.max(bandMin, parentCross));
    positions.set(id, toPoint(primary, parentCross, vertical));
  };

  let cursor = 0;
  roots.forEach((root, index) => {
    if (index > 0) cursor += graphGap;
    const span = measures.get(root)?.span ?? crossExtent(model.sizes.get(root), vertical);
    place(root, 0, cursor);
    cursor += span;
  });

  return positions;
}

export function layoutTree(model, analysis, orientation, settings, options = {}) {
  const { treeChildren, roots } = buildSpanningForest(model, analysis, orientation, options);
  const measures = measureSubtrees(model, treeChildren, roots, orientation, settings);
  const positions = placeForest(model, treeChildren, roots, measures, orientation, settings);

  const vertical = orientation === 'vertical';
  let orphanCursor = 0;
  analysis.ids
    .filter((id) => !positions.has(id))
    .sort((a, b) => compareIds(a, b, model.order))
    .forEach((id) => {
      const size = model.sizes.get(id);
      positions.set(id, toPoint(0, orphanCursor, vertical));
      orphanCursor += crossExtent(size, vertical) + settings.verticalSpacing;
    });

  return { positions, strategy: 'tree-v2', forestRoots: roots };
}
