import { byStableOrder, componentLinks } from './graphModel';

function hasDirectedCycle(ids, links) {
  const indegree = new Map(ids.map((id) => [id, 0]));
  const outgoing = new Map(ids.map((id) => [id, []]));
  links.forEach(({ source, target }) => {
    indegree.set(target, (indegree.get(target) || 0) + 1);
    outgoing.get(source).push(target);
  });

  const queue = ids.filter((id) => indegree.get(id) === 0);
  let visited = 0;
  while (queue.length) {
    const id = queue.shift();
    visited += 1;
    outgoing.get(id).forEach((target) => {
      indegree.set(target, indegree.get(target) - 1);
      if (indegree.get(target) === 0) queue.push(target);
    });
  }
  return visited !== ids.length;
}

function detectLongChains(ids, model) {
  const degree = (id) => model.adjacency.get(id).size;
  const chainNodes = ids.filter((id) => degree(id) <= 2);
  return chainNodes.length >= 4 ? Math.floor(chainNodes.length / Math.max(1, ids.length)) : 0;
}

function semanticHints(ids, model) {
  const tokens = new Map();
  const colors = new Map();
  let dated = 0;

  ids.forEach((id) => {
    const node = model.nodeById.get(id);
    const color = node.color || '';
    colors.set(color, (colors.get(color) || 0) + 1);
    if (node.createdAt || node.updatedAt) dated += 1;
    String(`${node.title || ''} ${node.content || ''}`)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 4)
      .forEach((token) => tokens.set(token, (tokens.get(token) || 0) + 1));
  });

  const maxTokenShare = Math.max(0, ...tokens.values()) / Math.max(1, ids.length);
  const maxColorShare = Math.max(0, ...colors.values()) / Math.max(1, ids.length);
  return { maxTokenShare, maxColorShare, datedShare: dated / Math.max(1, ids.length) };
}

export function analyseComponent(model, ids) {
  const links = componentLinks(model, ids);
  const n = ids.length;
  const m = links.length;
  const undirectedEdgeKeys = new Set(links.map(({ source, target }) => [source, target].sort().join('->')));
  const undirectedEdges = undirectedEdgeKeys.size;
  const roots = ids.filter((id) => model.incoming.get(id).size === 0).sort(byStableOrder(model.order));
  const leaves = ids.filter((id) => model.outgoing.get(id).size === 0).sort(byStableOrder(model.order));
  const degrees = ids.map((id) => ({
    id,
    in: model.incoming.get(id).size,
    out: model.outgoing.get(id).size,
    total: model.adjacency.get(id).size,
  }));
  const maxDegreeNode = degrees.sort((a, b) => b.total - a.total || byStableOrder(model.order)(a.id, b.id))[0] || { total: 0 };
  const density = n <= 1 ? 0 : undirectedEdges / ((n * (n - 1)) / 2);
  const cyclic = hasDirectedCycle(ids, links);
  const treeLike = !cyclic && roots.length >= 1 && undirectedEdges === n - 1;
  const mostlyTree = !cyclic && roots.length >= 1 && undirectedEdges <= Math.max(n + 2, Math.round(n * 1.25));
  const hubScore = n <= 1 ? 0 : maxDegreeNode.total / (n - 1);
  const longChainScore = detectLongChains(ids, model);
  const hints = semanticHints(ids, model);

  let type = 'dag';
  if (n === 1 && m === 0) type = 'floating';
  else if (hubScore >= 0.55 && n >= 5) type = 'hub';
  else if (treeLike) type = roots.length === 1 && leaves.length > 1 ? 'tree' : 'mind-map';
  else if (mostlyTree) type = 'mostly-tree';
  else if (!cyclic) type = 'dag';
  else if (density >= 0.28 || m > n * 2.2) type = 'dense';
  else type = n <= 12 ? 'organic' : 'cyclic';

  if (hints.datedShare > 0.8 && longChainScore > 0.5 && !cyclic) type = 'timeline';

  return {
    ids,
    links,
    nodeCount: n,
    edgeCount: m,
    roots,
    leaves,
    degrees,
    density,
    cyclic,
    treeLike,
    mostlyTree,
    hub: maxDegreeNode.id,
    hubScore,
    longChainScore,
    hints,
    type,
  };
}

export function analyseGraph(model) {
  return model.components.map((ids) => analyseComponent(model, ids));
}
