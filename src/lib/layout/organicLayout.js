import { byStableOrder } from './graphModel.js';

function initialCircle(model, ids, settings) {
  const positions = new Map();
  const radius = Math.max(settings.horizontalSpacing, ids.length * 34);
  ids.sort(byStableOrder(model.order)).forEach((id, index) => {
    const size = model.sizes.get(id);
    const angle = (Math.PI * 2 * index) / Math.max(1, ids.length);
    positions.set(id, {
      x: Math.cos(angle) * radius - size.width / 2,
      y: Math.sin(angle) * radius - size.height / 2,
    });
  });
  return positions;
}

export function layoutOrganic(model, analysis, orientation, settings) {
  const ids = [...analysis.ids].sort(byStableOrder(model.order));
  const positions = initialCircle(model, ids, settings);
  if (ids.length > 220) return { positions, strategy: analysis.type };

  const linked = new Set(analysis.links.map(({ source, target }) => `${source}->${target}`));
  const ideal = Math.max(settings.horizontalSpacing, settings.verticalSpacing) * 1.1;
  const iterations = ids.length <= 40 ? 90 : 50;

  for (let step = 0; step < iterations; step += 1) {
    const forces = new Map(ids.map((id) => [id, { x: 0, y: 0 }]));
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const a = ids[i];
        const b = ids[j];
        const pa = positions.get(a);
        const pb = positions.get(b);
        const dx = pa.x - pb.x || 0.1;
        const dy = pa.y - pb.y || 0.1;
        const distSq = Math.max(100, dx * dx + dy * dy);
        const force = Math.min(18, (ideal * ideal) / distSq);
        const dist = Math.sqrt(distSq);
        forces.get(a).x += (dx / dist) * force;
        forces.get(a).y += (dy / dist) * force;
        forces.get(b).x -= (dx / dist) * force;
        forces.get(b).y -= (dy / dist) * force;
      }
    }

    analysis.links.forEach(({ source, target }) => {
      const pa = positions.get(source);
      const pb = positions.get(target);
      if (!pa || !pb) return;
      const dx = pb.x - pa.x;
      const dy = pb.y - pa.y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      const force = (dist - ideal) * 0.025;
      forces.get(source).x += (dx / dist) * force;
      forces.get(source).y += (dy / dist) * force;
      forces.get(target).x -= (dx / dist) * force;
      forces.get(target).y -= (dy / dist) * force;
    });

    const cooling = 1 - step / iterations;
    ids.forEach((id) => {
      const pos = positions.get(id);
      const force = forces.get(id);
      const size = model.sizes.get(id);
      const axisBias = orientation === 'vertical' ? { x: 1, y: 0.88 } : { x: 0.88, y: 1 };
      positions.set(id, {
        x: pos.x + Math.max(-24, Math.min(24, force.x)) * cooling * axisBias.x - size.width * 0.0001,
        y: pos.y + Math.max(-24, Math.min(24, force.y)) * cooling * axisBias.y - size.height * 0.0001,
      });
    });
  }

  return { positions, strategy: linked.size > ids.length ? 'dense' : analysis.type };
}
