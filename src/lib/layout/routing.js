export const EDGE_ROUTE_TYPES = {
  CURVED: 'curved',
  STRAIGHT: 'straight',
  ORTHOGONAL: 'orthogonal',
  BUNDLED: 'bundled',
};

export function chooseRouteType(analysis) {
  if (analysis.type === 'dag' || analysis.type === 'mostly-tree' || analysis.type === 'timeline') {
    return EDGE_ROUTE_TYPES.ORTHOGONAL;
  }
  if (analysis.type === 'dense' || analysis.edgeCount > analysis.nodeCount * 1.6) {
    return EDGE_ROUTE_TYPES.BUNDLED;
  }
  if (analysis.type === 'tree' || analysis.type === 'mind-map') return EDGE_ROUTE_TYPES.CURVED;
  return EDGE_ROUTE_TYPES.CURVED;
}

export function planRoutes(analyses) {
  const routeByEdge = new Map();
  analyses.forEach((analysis) => {
    const route = chooseRouteType(analysis);
    analysis.links.forEach((link) => {
      if (link.id) routeByEdge.set(link.id, { type: route, componentType: analysis.type });
    });
  });
  return routeByEdge;
}

export function straightPath(x1, y1, x2, y2) {
  return `M ${x1} ${y1} L ${x2} ${y2}`;
}

export function orthogonalPath(x1, y1, x2, y2, orientation = 'horizontal') {
  if (orientation === 'vertical') {
    const midY = (y1 + y2) / 2;
    return `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
  }
  const midX = (x1 + x2) / 2;
  return `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
}

export function detectBundles(links) {
  const corridors = new Map();
  links.forEach((link) => {
    const key = [link.source, link.target].sort().join('->');
    if (!corridors.has(key)) corridors.set(key, []);
    corridors.get(key).push(link.id);
  });
  return [...corridors.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([key, ids]) => ({ corridor: key, edgeIds: ids }));
}
