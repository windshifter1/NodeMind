import { byStableOrder } from './graphModel.js';

function groupKey(node) {
  const titleToken = String(node.title || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .find((token) => token.length >= 4);
  const date = (node.createdAt || node.updatedAt || '').slice(0, 10);
  return titleToken || node.color || date || 'ungrouped';
}

export function layoutFloating(model, analysis, orientation, settings) {
  const positions = new Map();
  const groups = new Map();
  analysis.ids.sort(byStableOrder(model.order)).forEach((id) => {
    const key = groupKey(model.nodeById.get(id));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(id);
  });

  const orderedGroups = [...groups.values()].sort((a, b) => b.length - a.length || byStableOrder(model.order)(a[0], b[0]));
  let groupOffset = 0;
  orderedGroups.forEach((ids) => {
    const columns = Math.ceil(Math.sqrt(ids.length));
    let maxRowHeight = 0;
    let clusterWidth = 0;
    ids.forEach((id, index) => {
      const size = model.sizes.get(id);
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = col * (settings.horizontalSpacing + 80);
      const y = row * (settings.verticalSpacing + 80);
      positions.set(id, orientation === 'vertical' ? { x: groupOffset + x, y } : { x, y: groupOffset + y });
      clusterWidth = Math.max(clusterWidth, x + size.width);
      maxRowHeight = Math.max(maxRowHeight, y + size.height);
    });
    groupOffset += (orientation === 'vertical' ? clusterWidth : maxRowHeight) + settings.graphSpacing * 0.5;
  });

  return { positions, strategy: 'floating' };
}
