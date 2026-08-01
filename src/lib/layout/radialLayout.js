import { byStableOrder } from './graphModel';

export function layoutRadial(model, analysis, orientation, settings) {
  const positions = new Map();
  const hub = analysis.hub || analysis.ids[0];
  const hubSize = model.sizes.get(hub);
  positions.set(hub, { x: -hubSize.width / 2, y: -hubSize.height / 2 });

  const neighbours = [...model.adjacency.get(hub)]
    .filter((id) => analysis.ids.includes(id))
    .sort(byStableOrder(model.order));
  const remaining = analysis.ids.filter((id) => id !== hub && !neighbours.includes(id)).sort(byStableOrder(model.order));
  const ring = [...neighbours, ...remaining];
  const radiusX = Math.max(settings.horizontalSpacing * 1.25, ring.length * 24);
  const radiusY = Math.max(settings.verticalSpacing * 1.6, ring.length * 18);
  const rotation = orientation === 'vertical' ? -Math.PI / 2 : 0;

  ring.forEach((id, index) => {
    const size = model.sizes.get(id);
    const angle = rotation + (Math.PI * 2 * index) / Math.max(1, ring.length);
    const ringRadius = index < neighbours.length ? 1 : 1.55;
    positions.set(id, {
      x: Math.cos(angle) * radiusX * ringRadius - size.width / 2,
      y: Math.sin(angle) * radiusY * ringRadius - size.height / 2,
    });
  });

  return { positions, strategy: 'hub' };
}
