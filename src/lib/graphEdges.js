/** Resolve which node feeds which for a stored edge (output → input). */
export function edgeFlow(edge) {
  if (edge?.fromType === 'output') {
    return { sourceId: edge.fromNode, targetId: edge.toNode };
  }
  return { sourceId: edge.toNode, targetId: edge.fromNode };
}

/** Node that would receive the input end of a pending connection. */
export function connectionInputTarget(fromNode, fromType, toNode, toType) {
  if (fromType === 'input') return fromNode;
  if (toType === 'input') return toNode;
  return null;
}

export function hasInboundEdge(edges, nodeId) {
  if (!nodeId) return false;
  return (edges || []).some((edge) => edgeFlow(edge).targetId === nodeId);
}
