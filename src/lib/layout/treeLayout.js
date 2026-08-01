import { byStableOrder } from './graphModel';

function toPoint(primary, cross, vertical) {
  return vertical ? { x: cross, y: primary } : { x: primary, y: cross };
}

function buildChildren(model, analysis) {
  const set = new Set(analysis.ids);
  const children = new Map(analysis.ids.map((id) => [id, []]));
  analysis.links.forEach(({ source, target }) => {
    if (set.has(source) && set.has(target)) children.get(source).push(target);
  });
  children.forEach((list) => list.sort(byStableOrder(model.order)));
  return children;
}

export function layoutTree(model, analysis, orientation, settings) {
  const vertical = orientation === 'vertical';
  const children = buildChildren(model, analysis);
  const roots = (analysis.roots.length ? analysis.roots : [analysis.ids[0]]).sort(byStableOrder(model.order));
  const positions = new Map();
  const visited = new Set();
  const crossSpacing = settings.verticalSpacing;
  const primarySpacing = settings.horizontalSpacing;

  const crossSize = (id) => {
    const size = model.sizes.get(id);
    return vertical ? size.width : size.height;
  };

  const primarySize = (id) => {
    const size = model.sizes.get(id);
    return vertical ? size.height : size.width;
  };

  const measure = (id, stack = new Set()) => {
    if (stack.has(id)) return crossSize(id);
    stack.add(id);
    const kids = children.get(id).filter((child) => !stack.has(child));
    if (!kids.length) {
      stack.delete(id);
      return crossSize(id);
    }
    const span = kids.reduce((sum, child, index) => sum + measure(child, stack) + (index ? crossSpacing : 0), 0);
    stack.delete(id);
    return Math.max(crossSize(id), span);
  };

  const place = (id, primary, crossStart, stack = new Set()) => {
    if (visited.has(id) || stack.has(id)) return measure(id, stack);
    const span = measure(id);
    visited.add(id);
    stack.add(id);
    const kids = children.get(id).filter((child) => !visited.has(child) && !stack.has(child));
    let childCursor = crossStart;
    const childSpans = kids.map((child) => measure(child, stack));
    const childrenSpan = childSpans.reduce((sum, value, index) => sum + value + (index ? crossSpacing : 0), 0);
    const parentCross = kids.length
      ? childCursor + childrenSpan / 2 - crossSize(id) / 2
      : crossStart + span / 2 - crossSize(id) / 2;

    positions.set(id, toPoint(primary, parentCross, vertical));

    kids.forEach((child, index) => {
      const childSpan = childSpans[index];
      place(child, primary + primarySize(id) + primarySpacing, childCursor, stack);
      childCursor += childSpan + crossSpacing;
    });
    stack.delete(id);
    return span;
  };

  let cursor = 0;
  roots.forEach((root) => {
    const span = measure(root);
    place(root, 0, cursor);
    cursor += span + settings.graphSpacing * 0.35;
  });

  analysis.ids
    .filter((id) => !positions.has(id))
    .sort(byStableOrder(model.order))
    .forEach((id) => {
      positions.set(id, toPoint(0, cursor, vertical));
      cursor += crossSize(id) + crossSpacing;
    });

  return { positions, strategy: analysis.type };
}
