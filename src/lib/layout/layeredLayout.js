import { byStableOrder } from './graphModel.js';

function assignLayers(model, analysis) {
  const ids = analysis.ids;
  const idSet = new Set(ids);
  const indegree = new Map(ids.map((id) => [id, 0]));
  const outgoing = new Map(ids.map((id) => [id, []]));
  analysis.links.forEach(({ source, target }) => {
    if (!idSet.has(source) || !idSet.has(target)) return;
    indegree.set(target, indegree.get(target) + 1);
    outgoing.get(source).push(target);
  });
  outgoing.forEach((list) => list.sort(byStableOrder(model.order)));

  const roots = (analysis.roots.length ? analysis.roots : [analysis.ids[0]]).sort(byStableOrder(model.order));
  const layerById = new Map();
  const queue = roots.map((id) => ({ id, layer: 0 }));
  roots.forEach((id) => layerById.set(id, 0));

  while (queue.length) {
    const { id, layer } = queue.shift();
    outgoing.get(id).forEach((target) => {
      const next = layer + 1;
      if (!layerById.has(target) || next > layerById.get(target)) {
        layerById.set(target, next);
        queue.push({ id: target, layer: next });
      }
    });
  }

  ids.forEach((id) => {
    if (!layerById.has(id)) layerById.set(id, 0);
  });
  return layerById;
}

function layersFromAssignment(model, ids, layerById) {
  const layers = [];
  ids.forEach((id) => {
    const layer = Math.max(0, layerById.get(id) || 0);
    if (!layers[layer]) layers[layer] = [];
    layers[layer].push(id);
  });
  layers.forEach((layer) => layer.sort(byStableOrder(model.order)));
  return layers.filter(Boolean);
}

function reduceCrossings(model, layers, analysis) {
  const incoming = new Map(analysis.ids.map((id) => [id, []]));
  const outgoing = new Map(analysis.ids.map((id) => [id, []]));
  analysis.links.forEach(({ source, target }) => {
    outgoing.get(source)?.push(target);
    incoming.get(target)?.push(source);
  });

  const sweep = (forward) => {
    const range = forward
      ? layers.map((_, index) => index).slice(1)
      : layers.map((_, index) => index).slice(0, -1).reverse();

    range.forEach((index) => {
      const neighbour = layers[index + (forward ? -1 : 1)] || [];
      const neighbourIndex = new Map(neighbour.map((id, i) => [id, i]));
      const related = forward ? incoming : outgoing;
      layers[index].sort((a, b) => {
        const aRelated = related.get(a).filter((id) => neighbourIndex.has(id));
        const bRelated = related.get(b).filter((id) => neighbourIndex.has(id));
        const aBary = aRelated.length
          ? aRelated.reduce((sum, id) => sum + neighbourIndex.get(id), 0) / aRelated.length
          : model.order.get(a);
        const bBary = bRelated.length
          ? bRelated.reduce((sum, id) => sum + neighbourIndex.get(id), 0) / bRelated.length
          : model.order.get(b);
        return aBary - bBary || byStableOrder(model.order)(a, b);
      });
    });
  };

  for (let i = 0; i < 6; i += 1) {
    sweep(true);
    sweep(false);
  }
}

export function layoutLayered(model, analysis, orientation, settings) {
  const vertical = orientation === 'vertical';
  const layerById = assignLayers(model, analysis);
  const layers = layersFromAssignment(model, analysis.ids, layerById);
  reduceCrossings(model, layers, analysis);

  const positions = new Map();
  let primary = 0;

  layers.forEach((layer) => {
    const primarySize = Math.max(
      0,
      ...layer.map((id) => {
        const size = model.sizes.get(id);
        return vertical ? size.height : size.width;
      })
    );
    const crossTotal = layer.reduce((sum, id, index) => {
      const size = model.sizes.get(id);
      return sum + (vertical ? size.width : size.height) + (index ? settings.verticalSpacing : 0);
    }, 0);
    let cross = -crossTotal / 2;

    layer.forEach((id) => {
      const size = model.sizes.get(id);
      positions.set(id, vertical ? { x: cross, y: primary } : { x: primary, y: cross });
      cross += (vertical ? size.width : size.height) + settings.verticalSpacing;
    });
    primary += primarySize + settings.horizontalSpacing;
  });

  return { positions, strategy: analysis.type };
}
