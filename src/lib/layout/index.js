import { analyseGraph } from './analysis';
import { boundsForPositions, buildGraphModel } from './graphModel';
import { optimiseComponent } from './optimise';
import { planRoutes } from './routing';
import { layoutByStrategy } from './strategies';

function packComponents(model, componentLayouts, orientation, settings) {
  const vertical = orientation === 'vertical';
  const positions = new Map();
  let offset = 0;

  componentLayouts.forEach(({ analysis, layout }) => {
    const bounds = boundsForPositions(model, analysis.ids, layout.positions);
    analysis.ids.forEach((id) => {
      const pos = layout.positions.get(id);
      positions.set(
        id,
        vertical
          ? { x: pos.x + offset, y: pos.y }
          : { x: pos.x, y: pos.y + offset }
      );
    });
    offset += (vertical ? bounds.width : bounds.height) + settings.graphSpacing;
  });

  return positions;
}

function centrePositions(model, nodes, positions, centre) {
  const ids = nodes.map((node) => node.id);
  const bounds = boundsForPositions(model, ids, positions);
  const dx = centre.x - (bounds.minX + bounds.width / 2);
  const dy = centre.y - (bounds.minY + bounds.height / 2);
  ids.forEach((id) => {
    const pos = positions.get(id);
    positions.set(id, { x: pos.x + dx, y: pos.y + dy });
  });
  return positions;
}

export function autoOrganiseGraph(nodes, edges, orientation, settings, centre, geometry) {
  if (!nodes.length) return { nodes, routes: new Map(), analyses: [] };

  const model = buildGraphModel(nodes, edges, orientation, geometry.nodeSizeForLayout);
  const analyses = analyseGraph(model);
  const componentLayouts = analyses.map((analysis) => {
    const initial = layoutByStrategy(model, analysis, orientation, settings);
    return { analysis, layout: optimiseComponent(model, analysis, initial, orientation, settings) };
  });

  const positions = centrePositions(model, nodes, packComponents(model, componentLayouts, orientation, settings), centre);
  const arranged = nodes.map((node) => ({ ...node, ...(positions.get(node.id) || {}) }));
  return {
    nodes: arranged,
    routes: planRoutes(analyses),
    analyses,
  };
}
