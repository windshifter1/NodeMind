import { analyseGraph } from './analysis.js';
import { boundsForPositions, buildGraphModel } from './graphModel.js';
import { optimiseComponent, resolveCollisions } from './optimise.js';
import { planRoutes } from './routing.js';
import { layoutByStrategy } from './strategies.js';
import { chooseLayoutRoot } from './treeLayout.js';

function collectFixedIds(model, nodes, analyses, geometry = {}) {
  const fixedIds = new Set(geometry.fixedIds || []);
  nodes.forEach((node) => {
    if (node.pinned) fixedIds.add(node.id);
  });
  if (geometry.fixComponentRoots) {
    analyses.forEach((analysis) => {
      const root = chooseLayoutRoot(model, analysis, geometry);
      if (root) fixedIds.add(root);
    });
  }
  return fixedIds;
}

/**
 * Translate a layout so fixed nodes land on their original world positions.
 * Uses the average delta of fixed nodes, then snaps each fixed node exactly.
 */
export function alignToFixed(model, ids, positions, fixedIds) {
  const fixed = ids.filter((id) => fixedIds.has(id) && positions.has(id) && model.nodeById.has(id));
  if (!fixed.length) return positions;

  let dx = 0;
  let dy = 0;
  fixed.forEach((id) => {
    const node = model.nodeById.get(id);
    const layout = positions.get(id);
    dx += node.x - layout.x;
    dy += node.y - layout.y;
  });
  dx /= fixed.length;
  dy /= fixed.length;

  ids.forEach((id) => {
    const pos = positions.get(id);
    if (!pos) return;
    if (fixedIds.has(id)) {
      const node = model.nodeById.get(id);
      positions.set(id, { x: node.x, y: node.y });
    } else {
      positions.set(id, { x: pos.x + dx, y: pos.y + dy });
    }
  });
  return positions;
}

/** Translate so the new layout centroid matches the prior centroid (min movement). */
export function alignToPriorCentroid(model, ids, positions) {
  if (!ids.length) return positions;
  let lx = 0;
  let ly = 0;
  let px = 0;
  let py = 0;
  let count = 0;
  ids.forEach((id) => {
    const pos = positions.get(id);
    const node = model.nodeById.get(id);
    const size = model.sizes.get(id);
    if (!pos || !node || !size) return;
    lx += pos.x + size.width / 2;
    ly += pos.y + size.height / 2;
    px += node.x + size.width / 2;
    py += node.y + size.height / 2;
    count += 1;
  });
  if (!count) return positions;
  const dx = px / count - lx / count;
  const dy = py / count - ly / count;
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return positions;
  ids.forEach((id) => {
    const pos = positions.get(id);
    if (!pos) return;
    positions.set(id, { x: pos.x + dx, y: pos.y + dy });
  });
  return positions;
}

function packComponents(model, componentLayouts, orientation, settings, fixedIds) {
  const vertical = orientation === 'vertical';
  const positions = new Map();
  const freeLayouts = [];

  componentLayouts.forEach(({ analysis, layout }) => {
    const hasFixed = analysis.ids.some((id) => fixedIds.has(id));
    if (hasFixed) {
      const componentPositions = new Map(layout.positions);
      alignToFixed(model, analysis.ids, componentPositions, fixedIds);
      componentPositions.forEach((pos, id) => positions.set(id, pos));
      return;
    }
    freeLayouts.push({ analysis, layout });
  });

  let offset = 0;
  if (positions.size) {
    const bounds = boundsForPositions(model, [...positions.keys()], positions);
    offset = (vertical ? bounds.maxX : bounds.maxY) + settings.graphSpacing;
  }

  freeLayouts.forEach(({ analysis, layout }) => {
    const bounds = boundsForPositions(model, analysis.ids, layout.positions);
    analysis.ids.forEach((id) => {
      const pos = layout.positions.get(id);
      positions.set(
        id,
        vertical
          ? { x: pos.x + offset, y: pos.y }
          : { x: pos.x, y: pos.y + offset }
      );
    });
    offset += (vertical ? bounds.width : bounds.height) + settings.graphSpacing;
  });

  return positions;
}

export function autoOrganiseGraph(nodes, edges, orientation, settings, centre, geometry) {
  if (!nodes.length) return { nodes, routes: new Map(), analyses: [] };

  const model = buildGraphModel(nodes, edges, orientation, geometry.nodeSizeForLayout);
  const analyses = analyseGraph(model);
  const layoutOptions = {
    preferredRootIds: geometry.preferredRootIds || [],
    fixedIds: geometry.fixedIds || [],
  };
  const fixedIds = collectFixedIds(model, nodes, analyses, geometry);

  const componentLayouts = analyses.map((analysis) => {
    const initial = layoutByStrategy(model, analysis, orientation, settings, layoutOptions);
    return {
      analysis,
      layout: optimiseComponent(model, analysis, initial, orientation, settings, fixedIds),
    };
  });

  let positions = packComponents(model, componentLayouts, orientation, settings, fixedIds);
  const allIds = nodes.map((node) => node.id);

  const hasFixed = [...fixedIds].some((id) => positions.has(id));
  if (hasFixed) {
    alignToFixed(model, allIds, positions, fixedIds);
    resolveCollisions(model, allIds, positions, settings, fixedIds);
  } else {
    // Keep the cluster near where it already was instead of jumping to viewport centre.
    alignToPriorCentroid(model, allIds, positions);
    // If everything was at the origin / degenerate, fall back to requested centre.
    const bounds = boundsForPositions(model, allIds, positions);
    if (bounds.width < 1 && bounds.height < 1 && centre) {
      const dx = centre.x - (bounds.minX + bounds.width / 2);
      const dy = centre.y - (bounds.minY + bounds.height / 2);
      allIds.forEach((id) => {
        const pos = positions.get(id);
        if (pos) positions.set(id, { x: pos.x + dx, y: pos.y + dy });
      });
    }
  }

  const arranged = nodes.map((node) => ({ ...node, ...(positions.get(node.id) || {}) }));
  return {
    nodes: arranged,
    routes: planRoutes(analyses),
    analyses,
  };
}
