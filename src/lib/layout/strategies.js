import { layoutFloating } from './floatingLayout.js';
import { layoutLayered } from './layeredLayout.js';
import { layoutOrganic } from './organicLayout.js';
import { layoutRadial } from './radialLayout.js';
import { layoutTree } from './treeLayout.js';

function hasMultiParentNodes(analysis) {
  return (analysis.degrees || []).some((d) => (d.in || 0) >= 2);
}

export function chooseStrategy(analysis, options = {}) {
  if (analysis.type === 'floating') return 'floating';

  // Spanning-tree claims a multi-parent node under its first reach, so edges
  // from deeper parents become backward. Layered rank assignment places each
  // node after all parents (longest-path), keeping hierarchy order.
  if (!analysis.cyclic && hasMultiParentNodes(analysis)) {
    return 'layered';
  }

  // Edge-aware experiment: layered ranks + crossing sweeps read connection
  // corridors more clearly than tidy-tree for DAGs / near-trees.
  if (
    options.edgeAwareLayout &&
    !analysis.cyclic &&
    (analysis.type === 'dag' ||
      analysis.type === 'mostly-tree' ||
      analysis.type === 'timeline' ||
      analysis.type === 'mind-map')
  ) {
    return 'layered';
  }

  // Tidy spanning-tree for hierarchical / near-tree / acyclic graphs.
  // True radial hubs are rare; prefer tree whenever a single root exists.
  if (
    analysis.type === 'tree' ||
    analysis.type === 'mind-map' ||
    analysis.type === 'mostly-tree' ||
    analysis.type === 'timeline' ||
    analysis.type === 'dag' ||
    (analysis.type === 'hub' && analysis.roots?.length <= 2)
  ) {
    return 'tree';
  }
  if (analysis.type === 'hub') return 'radial';
  if (analysis.roots?.length === 1 && analysis.nodeCount <= 48) return 'tree';
  return 'organic';
}

export function layoutByStrategy(model, analysis, orientation, settings, options = {}) {
  const strategy = chooseStrategy(analysis, options);
  if (strategy === 'floating') return layoutFloating(model, analysis, orientation, settings);
  if (strategy === 'radial') return layoutRadial(model, analysis, orientation, settings);
  if (strategy === 'tree') return layoutTree(model, analysis, orientation, settings, options);
  if (strategy === 'layered') return layoutLayered(model, analysis, orientation, settings, options);
  return layoutOrganic(model, analysis, orientation, settings);
}
