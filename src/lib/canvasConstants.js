export const NODE_WIDTH = 180; // default (empty title) width
export const TOP_BAR_HEIGHT = 44;
export const SOCKET_RADIUS = 8;

export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 3;

export function nodeWidthForTitle(title) {
  const t = title && title.length ? title : 'Untitled';
  return Math.max(180, Math.min(460, t.length * 7.5 + 96));
}

export function socketWorld(node, type) {
  const y = node.y + TOP_BAR_HEIGHT / 2;
  const w = nodeWidthForTitle(node.title);
  return type === 'output' ? { x: node.x + w, y } : { x: node.x, y };
}

export function bezierPath(x1, y1, x2, y2, reversed = false) {
  const dx = Math.max(60, Math.abs(x2 - x1) * 0.5);
  if (reversed) {
    return `M ${x1} ${y1} C ${x1 - dx} ${y1}, ${x2 + dx} ${y2}, ${x2} ${y2}`;
  }
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
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
  if (!nodes.length || nodes.every((node) => /^0*\d+$/.test(node.id))) return workspace;
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
  return { ...workspace, nodes: migratedNodes, edges: migratedEdges };
}