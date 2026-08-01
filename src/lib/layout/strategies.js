import { layoutFloating } from './floatingLayout';
import { layoutLayered } from './layeredLayout';
import { layoutOrganic } from './organicLayout';
import { layoutRadial } from './radialLayout';
import { layoutTree } from './treeLayout';

export function chooseStrategy(analysis) {
  if (analysis.type === 'floating') return 'floating';
  if (analysis.type === 'hub') return 'radial';
  if (analysis.type === 'tree' || analysis.type === 'mind-map' || analysis.type === 'mostly-tree' || analysis.type === 'timeline') {
    return 'tree';
  }
  if (analysis.type === 'dag') return 'layered';
  return 'organic';
}

export function layoutByStrategy(model, analysis, orientation, settings) {
  const strategy = chooseStrategy(analysis);
  if (strategy === 'floating') return layoutFloating(model, analysis, orientation, settings);
  if (strategy === 'radial') return layoutRadial(model, analysis, orientation, settings);
  if (strategy === 'tree') return layoutTree(model, analysis, orientation, settings);
  if (strategy === 'layered') return layoutLayered(model, analysis, orientation, settings);
  return layoutOrganic(model, analysis, orientation, settings);
}
