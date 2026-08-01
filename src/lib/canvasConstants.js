import { autoOrganiseGraph } from './layout/index.js';

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

export function autoOrganiseNodes(nodes, edges, orientation = GRAPH_ORIENTATIONS.HORIZONTAL, layoutSettings = {}, centre = { x: 0, y: 0 }) {
  if (!nodes.length) return nodes;

  const settings = normalizeLayoutSettings(layoutSettings);
  const graphOrientation = normalizeOrientation(orientation);
  return autoOrganiseGraph(nodes, edges, graphOrientation, settings, centre, { nodeSizeForLayout }).nodes;
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
