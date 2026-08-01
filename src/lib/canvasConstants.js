export const NODE_WIDTH = 180; // default (empty title) width
export const TOP_BAR_HEIGHT = 44;
export const SOCKET_RADIUS = 8;

export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 3;

export const GRAPH_ORIENTATIONS = {
  HORIZONTAL: 'horizontal',
  VERTICAL: 'vertical',
};

export const LAYOUT_ON_ORIENTATION_CHANGE = {
  PRESERVE: 'preserve',
  AUTO: 'auto',
};

export const LAYOUT_DENSITIES = {
  COMPACT: 'compact',
  DEFAULT: 'default',
  SPACIOUS: 'spacious',
};

export const DEFAULT_LAYOUT_SETTINGS = {
  horizontalSpacing: 220,
  verticalSpacing: 120,
  graphSpacing: 260,
  density: LAYOUT_DENSITIES.DEFAULT,
};

export function normalizeOrientation(value) {
  return value === GRAPH_ORIENTATIONS.VERTICAL ? GRAPH_ORIENTATIONS.VERTICAL : GRAPH_ORIENTATIONS.HORIZONTAL;
}

export function normalizeLayoutOnOrientationChange(value) {
  return value === LAYOUT_ON_ORIENTATION_CHANGE.AUTO
    ? LAYOUT_ON_ORIENTATION_CHANGE.AUTO
    : LAYOUT_ON_ORIENTATION_CHANGE.PRESERVE;
}

function numberOrDefault(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function normalizeLayoutSettings(settings = {}) {
  const density = Object.values(LAYOUT_DENSITIES).includes(settings.density)
    ? settings.density
    : LAYOUT_DENSITIES.DEFAULT;
  const preset = density === LAYOUT_DENSITIES.COMPACT
    ? { horizontalSpacing: 160, verticalSpacing: 80, graphSpacing: 180 }
    : density === LAYOUT_DENSITIES.SPACIOUS
      ? { horizontalSpacing: 300, verticalSpacing: 170, graphSpacing: 360 }
      : DEFAULT_LAYOUT_SETTINGS;

  return {
    horizontalSpacing: numberOrDefault(settings.horizontalSpacing, preset.horizontalSpacing),
    verticalSpacing: numberOrDefault(settings.verticalSpacing, preset.verticalSpacing),
    graphSpacing: numberOrDefault(settings.graphSpacing, preset.graphSpacing),
    density,
  };
}

export function nodeWidthForTitle(title) {
  const t = title && title.length ? title : 'Untitled';
  return Math.max(180, Math.min(460, t.length * 7.5 + 96));
}

export function nodeHeightForLayout(nodeOrTitle = '') {
  const collapsed = typeof nodeOrTitle === 'object' && nodeOrTitle?.collapsed;
  if (collapsed) return TOP_BAR_HEIGHT;
  const content = typeof nodeOrTitle === 'object' ? nodeOrTitle.content || '' : '';
  const lineCount = Math.max(1, content.split('\n').length);
  const textHeight = Math.max(64, lineCount * 20) + 24;
  return TOP_BAR_HEIGHT + textHeight;
}

export function nodeSizeForLayout(nodeOrTitle = '') {
  const title = typeof nodeOrTitle === 'object' ? nodeOrTitle.title : nodeOrTitle;
  return {
    width: nodeWidthForTitle(title),
    height: nodeHeightForLayout(nodeOrTitle),
  };
}

export function socketWorld(node, type, orientation = GRAPH_ORIENTATIONS.HORIZONTAL, size = nodeSizeForLayout(node)) {
  const o = normalizeOrientation(orientation);
  if (o === GRAPH_ORIENTATIONS.VERTICAL) {
    const x = node.x + size.width / 2;
    return type === 'output' ? { x, y: node.y + size.height } : { x, y: node.y };
  }

  const y = node.y + TOP_BAR_HEIGHT / 2;
  return type === 'output' ? { x: node.x + size.width, y } : { x: node.x, y };
}

export function bezierPath(x1, y1, x2, y2, reversed = false, orientation = GRAPH_ORIENTATIONS.HORIZONTAL) {
  const o = normalizeOrientation(orientation);
  if (o === GRAPH_ORIENTATIONS.VERTICAL) {
    const dy = Math.max(60, Math.abs(y2 - y1) * 0.5);
    if (reversed) {
      return `M ${x1} ${y1} C ${x1} ${y1 - dy}, ${x2} ${y2 + dy}, ${x2} ${y2}`;
    }
    return `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`;
  }

  const dx = Math.max(60, Math.abs(x2 - x1) * 0.5);
  if (reversed) {
    return `M ${x1} ${y1} C ${x1 - dx} ${y1}, ${x2 + dx} ${y2}, ${x2} ${y2}`;
  }

  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

export function connectedNodePositionAtSocket(point, fromType, orientation = GRAPH_ORIENTATIONS.HORIZONTAL, title = '') {
  const o = normalizeOrientation(orientation);
  const size = nodeSizeForLayout(title);

  if (o === GRAPH_ORIENTATIONS.VERTICAL) {
    return {
      x: point.x - size.width / 2,
      y: fromType === 'output' ? point.y : point.y - size.height,
    };
  }

  return {
    x: fromType === 'output' ? point.x : point.x - size.width,
    y: point.y - TOP_BAR_HEIGHT / 2,
  };
}

export function nextChildGraphPosition(nodes, parentId, title = '', orientation = GRAPH_ORIENTATIONS.HORIZONTAL) {
  const o = normalizeOrientation(orientation);
  const parent = nodes.find((node) => node.id === parentId);
  const siblings = nodes.filter((node) => (node.parentId || null) === (parentId || null));
  const candidate = nodeSizeForLayout(title);

  if (o === GRAPH_ORIENTATIONS.VERTICAL) {
    const baseX = parent ? parent.x : 0;
    const baseY = parent ? parent.y + nodeHeightForLayout(parent) + 120 : 0;
    let x = baseX + Math.max(0, siblings.length) * 240;
    while (
      nodes.some((node) => {
        const size = nodeSizeForLayout(node);
        return Math.abs(node.x - x) < Math.max(candidate.width, size.width) + 24 &&
          Math.abs(node.y - baseY) < Math.max(candidate.height, size.height) + 64;
      })
    ) {
      x += 240;
    }
    return { x, y: baseY };
  }

  const baseX = parent ? parent.x + nodeWidthForTitle(parent.title) + 120 : 0;
  const baseY = parent ? parent.y : 0;
  let y = baseY + Math.max(0, siblings.length) * 96;
  while (
    nodes.some((node) => {
      const size = nodeSizeForLayout(node);
      return Math.abs(node.x - baseX) < Math.max(candidate.width, size.width) + 24 &&
        Math.abs(node.y - y) < Math.max(candidate.height, size.height) + 64;
    })
  ) {
    y += 96;
  }
  return { x: baseX, y };
}

export function layoutBranchByOrientation(nodes, rootId, origin, orientation = GRAPH_ORIENTATIONS.HORIZONTAL) {
  const o = normalizeOrientation(orientation);
  const byParent = new Map();
  nodes.forEach((node) => {
    const key = node.parentId || '';
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(node);
  });

  const updates = new Map([[rootId, origin]]);
  const walk = (id, crossStart) => {
    const kids = byParent.get(id) || [];
    kids.forEach((child, index) => {
      const parent = nodes.find((node) => node.id === id);
      const parentPos = updates.get(id) || origin;
      const pos = o === GRAPH_ORIENTATIONS.VERTICAL
        ? {
            x: crossStart + index * 240,
            y: parentPos.y + nodeHeightForLayout(parent) + 120,
          }
        : {
            x: parentPos.x + nodeWidthForTitle(parent?.title) + 120,
            y: crossStart + index * 96,
          };
      updates.set(child.id, pos);
      walk(child.id, o === GRAPH_ORIENTATIONS.VERTICAL ? pos.x : pos.y);
    });
  };
  walk(rootId, o === GRAPH_ORIENTATIONS.VERTICAL ? origin.x : origin.y);
  return nodes.map((node) => (updates.has(node.id) ? { ...node, ...updates.get(node.id) } : node));
}

function edgeDirection(edge) {
  return edge.fromType === 'output'
    ? { source: edge.fromNode, target: edge.toNode }
    : { source: edge.toNode, target: edge.fromNode };
}

function originalNodeOrder(nodes, orientation) {
  const vertical = normalizeOrientation(orientation) === GRAPH_ORIENTATIONS.VERTICAL;
  return new Map(
    [...nodes]
      .sort((a, b) => {
        const primary = vertical ? a.x - b.x : a.y - b.y;
        if (primary !== 0) return primary;
        const secondary = vertical ? a.y - b.y : a.x - b.x;
        if (secondary !== 0) return secondary;
        return String(a.id).localeCompare(String(b.id));
      })
      .map((node, index) => [node.id, index])
  );
}

function splitComponents(nodes, links) {
  const ids = new Set(nodes.map((node) => node.id));
  const adjacency = new Map(nodes.map((node) => [node.id, new Set()]));
  links.forEach(({ source, target }) => {
    if (!ids.has(source) || !ids.has(target)) return;
    adjacency.get(source).add(target);
    adjacency.get(target).add(source);
  });

  const seen = new Set();
  const components = [];
  nodes.forEach((node) => {
    if (seen.has(node.id)) return;
    const queue = [node.id];
    const component = [];
    seen.add(node.id);
    while (queue.length) {
      const id = queue.shift();
      component.push(id);
      adjacency.get(id).forEach((next) => {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      });
    }
    components.push(component);
  });
  return components;
}

function assignLayers(componentIds, links, order) {
  const componentSet = new Set(componentIds);
  const incoming = new Map(componentIds.map((id) => [id, new Set()]));
  const outgoing = new Map(componentIds.map((id) => [id, new Set()]));

  links.forEach(({ source, target }) => {
    if (!componentSet.has(source) || !componentSet.has(target) || source === target) return;
    outgoing.get(source).add(target);
    incoming.get(target).add(source);
  });

  let roots = componentIds.filter((id) => incoming.get(id).size === 0);
  if (!roots.length) roots = [...componentIds].sort((a, b) => order.get(a) - order.get(b)).slice(0, 1);
  roots.sort((a, b) => order.get(a) - order.get(b));

  const layerById = new Map();
  const queue = roots.map((id) => ({ id, layer: 0 }));
  roots.forEach((id) => layerById.set(id, 0));

  while (queue.length) {
    const { id, layer } = queue.shift();
    [...outgoing.get(id)]
      .sort((a, b) => order.get(a) - order.get(b))
      .forEach((target) => {
        const nextLayer = layer + 1;
        if (!layerById.has(target) || nextLayer < layerById.get(target)) {
          layerById.set(target, nextLayer);
          queue.push({ id: target, layer: nextLayer });
        }
      });
  }

  componentIds.forEach((id) => {
    if (!layerById.has(id)) layerById.set(id, 0);
  });

  return { layerById, incoming, outgoing };
}

function orderedLayers(componentIds, layerById, incoming, order) {
  const layers = [];
  componentIds.forEach((id) => {
    const layer = layerById.get(id) || 0;
    if (!layers[layer]) layers[layer] = [];
    layers[layer].push(id);
  });

  layers.forEach((layer, index) => {
    const previous = layers[index - 1] || [];
    const prevIndex = new Map(previous.map((id, i) => [id, i]));
    layer.sort((a, b) => {
      const aParents = [...incoming.get(a)].filter((id) => prevIndex.has(id));
      const bParents = [...incoming.get(b)].filter((id) => prevIndex.has(id));
      const aBary = aParents.length ? aParents.reduce((sum, id) => sum + prevIndex.get(id), 0) / aParents.length : order.get(a);
      const bBary = bParents.length ? bParents.reduce((sum, id) => sum + prevIndex.get(id), 0) / bParents.length : order.get(b);
      if (aBary !== bBary) return aBary - bBary;
      return order.get(a) - order.get(b);
    });
  });

  return layers.filter(Boolean);
}

function layoutComponent(ids, nodeById, links, orientation, settings, order) {
  const vertical = normalizeOrientation(orientation) === GRAPH_ORIENTATIONS.VERTICAL;
  const { layerById, incoming } = assignLayers(ids, links, order);
  const layers = orderedLayers(ids, layerById, incoming, order);
  const positions = new Map();
  const layerPrimary = [];
  let primaryCursor = 0;

  layers.forEach((layer, layerIndex) => {
    const maxPrimarySize = Math.max(
      0,
      ...layer.map((id) => {
        const size = nodeSizeForLayout(nodeById.get(id));
        return vertical ? size.height : size.width;
      })
    );
    layerPrimary[layerIndex] = primaryCursor;
    primaryCursor += maxPrimarySize + settings.horizontalSpacing;
  });

  let componentPrimary = 0;
  let componentCross = 0;

  layers.forEach((layer, layerIndex) => {
    let crossCursor = 0;
    const layerPrimarySize = Math.max(
      0,
      ...layer.map((id) => {
        const size = nodeSizeForLayout(nodeById.get(id));
        return vertical ? size.height : size.width;
      })
    );

    layer.forEach((id) => {
      const node = nodeById.get(id);
      const size = nodeSizeForLayout(node);
      const x = vertical ? crossCursor : layerPrimary[layerIndex];
      const y = vertical ? layerPrimary[layerIndex] : crossCursor;
      positions.set(id, { x, y });
      crossCursor += (vertical ? size.width : size.height) + settings.verticalSpacing;
      componentPrimary = Math.max(componentPrimary, layerPrimary[layerIndex] + layerPrimarySize);
      componentCross = Math.max(componentCross, crossCursor - settings.verticalSpacing);
    });
  });

  return {
    positions,
    width: vertical ? componentCross : componentPrimary,
    height: vertical ? componentPrimary : componentCross,
  };
}

function boundsForPositions(nodes, positions) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  nodes.forEach((node) => {
    const pos = positions.get(node.id) || node;
    const size = nodeSizeForLayout(node);
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + size.width);
    maxY = Math.max(maxY, pos.y + size.height);
  });
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

export function autoOrganiseNodes(nodes, edges, orientation = GRAPH_ORIENTATIONS.HORIZONTAL, layoutSettings = {}, centre = { x: 0, y: 0 }) {
  if (!nodes.length) return nodes;

  const settings = normalizeLayoutSettings(layoutSettings);
  const graphOrientation = normalizeOrientation(orientation);
  const vertical = graphOrientation === GRAPH_ORIENTATIONS.VERTICAL;
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const order = originalNodeOrder(nodes, graphOrientation);
  const links = (edges || [])
    .map(edgeDirection)
    .filter(({ source, target }) => nodeById.has(source) && nodeById.has(target) && source !== target);
  const components = splitComponents(nodes, links)
    .sort((a, b) => {
      const aMin = Math.min(...a.map((id) => order.get(id)));
      const bMin = Math.min(...b.map((id) => order.get(id)));
      return aMin - bMin;
    });

  const positions = new Map();
  let componentOffset = 0;

  components.forEach((component) => {
    const layout = layoutComponent(component, nodeById, links, graphOrientation, settings, order);
    layout.positions.forEach((pos, id) => {
      positions.set(id, vertical ? { x: pos.x + componentOffset, y: pos.y } : { x: pos.x, y: pos.y + componentOffset });
    });
    componentOffset += (vertical ? layout.width : layout.height) + settings.graphSpacing;
  });

  const arranged = nodes.map((node) => ({ ...node, ...(positions.get(node.id) || {}) }));
  const bounds = boundsForPositions(arranged, new Map(arranged.map((node) => [node.id, node])));
  const dx = centre.x - (bounds.minX + bounds.width / 2);
  const dy = centre.y - (bounds.minY + bounds.height / 2);

  return arranged.map((node) => ({
    ...node,
    x: node.x + dx,
    y: node.y + dy,
  }));
}

export function formatNodeId(num) {
  return String(num).padStart(3, '0');
}

export function maxNumericNodeId(nodes) {
  let max = 0;
  for (const node of nodes) {
    const match = String(node.id).match(/^0*(\d+)$/);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max;
}

export function nextNumericNodeId(nodes) {
  return formatNodeId(maxNumericNodeId(nodes) + 1);
}

export function allocateNumericNodeIds(nodes, count) {
  let next = maxNumericNodeId(nodes);
  const ids = [];
  for (let i = 0; i < count; i += 1) {
    next += 1;
    ids.push(formatNodeId(next));
  }
  return ids;
}

export function migrateWorkspaceNodeIds(workspace) {
  const nodes = workspace.nodes || [];
  const orientation = normalizeOrientation(workspace.orientation);
  const layoutOnOrientationChange = normalizeLayoutOnOrientationChange(workspace.layoutOnOrientationChange);
  const layoutSettings = normalizeLayoutSettings(workspace.layoutSettings);
  if (!nodes.length || nodes.every((node) => /^0*\d+$/.test(node.id))) {
    return { ...workspace, orientation, layoutOnOrientationChange, layoutSettings };
  }
  const idMap = new Map();
  const migratedNodes = nodes.map((node, index) => {
    const newId = formatNodeId(index + 1);
    idMap.set(node.id, newId);
    return { ...node, id: newId };
  });
  const migratedEdges = (workspace.edges || []).map((edge) => ({
    ...edge,
    fromNode: idMap.get(edge.fromNode) ?? edge.fromNode,
    toNode: idMap.get(edge.toNode) ?? edge.toNode,
  }));
  return { ...workspace, orientation, layoutOnOrientationChange, layoutSettings, nodes: migratedNodes, edges: migratedEdges };
}