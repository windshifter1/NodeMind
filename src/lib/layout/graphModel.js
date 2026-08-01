export function edgeDirection(edge) {
  return edge.fromType === 'output'
    ? { id: edge.id, source: edge.fromNode, target: edge.toNode }
    : { id: edge.id, source: edge.toNode, target: edge.fromNode };
}

export function stableNodeOrder(nodes, orientation) {
  const vertical = orientation === 'vertical';
  return new Map(
    [...nodes]
      .sort((a, b) => {
        const primary = vertical ? a.x - b.x : a.y - b.y;
        if (primary !== 0) return primary;
        const secondary = vertical ? a.y - b.y : a.x - b.x;
        if (secondary !== 0) return secondary;
        return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
      })
      .map((node, index) => [node.id, index])
  );
}

export function byStableOrder(order) {
  return (a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0) || String(a).localeCompare(String(b), undefined, { numeric: true });
}

function emptySetMap(ids) {
  return new Map(ids.map((id) => [id, new Set()]));
}

export function buildGraphModel(nodes, edges, orientation, nodeSizeForLayout) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const order = stableNodeOrder(nodes, orientation);
  const ids = nodes.map((node) => node.id);
  const sizes = new Map(nodes.map((node) => [node.id, nodeSizeForLayout(node)]));
  const links = (edges || [])
    .map(edgeDirection)
    .filter(({ source, target }) => nodeById.has(source) && nodeById.has(target) && source !== target)
    .sort((a, b) => byStableOrder(order)(a.source, b.source) || byStableOrder(order)(a.target, b.target));

  const outgoing = emptySetMap(ids);
  const incoming = emptySetMap(ids);
  const adjacency = emptySetMap(ids);

  links.forEach(({ source, target }) => {
    outgoing.get(source).add(target);
    incoming.get(target).add(source);
    adjacency.get(source).add(target);
    adjacency.get(target).add(source);
  });

  const seen = new Set();
  const components = [];
  [...ids].sort(byStableOrder(order)).forEach((id) => {
    if (seen.has(id)) return;
    const queue = [id];
    const component = [];
    seen.add(id);
    while (queue.length) {
      const current = queue.shift();
      component.push(current);
      [...adjacency.get(current)].sort(byStableOrder(order)).forEach((next) => {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      });
    }
    components.push(component.sort(byStableOrder(order)));
  });

  return { nodes, edges, nodeById, sizes, order, links, outgoing, incoming, adjacency, components };
}

export function componentLinks(model, ids) {
  const set = new Set(ids);
  return model.links.filter(({ source, target }) => set.has(source) && set.has(target));
}

export function boundsForPositions(model, ids, positions) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  ids.forEach((id) => {
    const node = model.nodeById.get(id);
    const pos = positions.get(id) || node;
    const size = model.sizes.get(id);
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + size.width);
    maxY = Math.max(maxY, pos.y + size.height);
  });
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}
