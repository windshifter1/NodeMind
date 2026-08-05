/**
 * Smoke-test Auto Organise against forward / reverse / hybrid graphs.
 * Run: node scripts/test-layout.mjs
 */
import { autoOrganiseGraph } from '../src/lib/layout/index.js';
import { DEFAULT_LAYOUT_SETTINGS } from '../src/lib/canvasConstants.js';
import { buildGraphModel } from '../src/lib/layout/graphModel.js';
import { analyseGraph } from '../src/lib/layout/analysis.js';
import { buildSpanningForest, chooseLayoutRoot } from '../src/lib/layout/treeLayout.js';

function node(id, title = id) {
  return {
    id,
    x: Math.random() * 800,
    y: Math.random() * 600,
    title,
    content: '',
    color: '#6366f1',
    collapsed: false,
    pinned: false,
  };
}

function sizeOf(n) {
  const t = n.title && n.title.length ? n.title : 'Untitled';
  const width = Math.max(180, Math.min(460, t.length * 7.5 + 96));
  return { width, height: 44 + 64 + 24 };
}

function overlaps(a, sa, b, sb, pad = 8) {
  return !(
    a.x + sa.width + pad <= b.x ||
    b.x + sb.width + pad <= a.x ||
    a.y + sa.height + pad <= b.y ||
    b.y + sb.height + pad <= a.y
  );
}

function assertNoOverlap(nodes, label) {
  const sizes = new Map(nodes.map((n) => [n.id, sizeOf(n)]));
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = nodes[i];
      const b = nodes[j];
      if (overlaps(a, sizes.get(a.id), b, sizes.get(b.id))) {
        throw new Error(`${label}: overlap ${a.id} vs ${b.id}`);
      }
    }
  }
}

function organise(nodes, edges) {
  return autoOrganiseGraph(nodes, edges, 'horizontal', DEFAULT_LAYOUT_SETTINGS, { x: 400, y: 300 }, {
    nodeSizeForLayout: sizeOf,
  }).nodes;
}

function forestRoot(nodes, edges) {
  const model = buildGraphModel(nodes, edges, 'horizontal', sizeOf);
  const analysis = analyseGraph(model)[0];
  const forest = buildSpanningForest(model, analysis, 'horizontal', {});
  return { root: chooseLayoutRoot(model, analysis, {}), forestRoots: forest.roots, children: forest.treeChildren };
}

// Case B — forward tree
{
  const nodes = ['001', '002', '003', '004', '005'].map((id) => node(id));
  const edges = [
    { id: 'e1', fromNode: '001', fromType: 'output', toNode: '002', toType: 'input' },
    { id: 'e2', fromNode: '002', fromType: 'output', toNode: '003', toType: 'input' },
    { id: 'e3', fromNode: '002', fromType: 'output', toNode: '004', toType: 'input' },
    { id: 'e4', fromNode: '002', fromType: 'output', toNode: '005', toType: 'input' },
  ];
  const info = forestRoot(nodes, edges);
  if (info.root !== '001') throw new Error(`Forward: expected root 001, got ${info.root}`);
  const result = organise(nodes, edges);
  assertNoOverlap(result, 'Forward');
  const byId = Object.fromEntries(result.map((n) => [n.id, n]));
  if (!(byId['002'].x > byId['001'].x)) throw new Error('Forward: child should be right of root');
  console.log('Forward OK', 'root', info.root);
}

// Reverse / upward-drawn tree: edges C → B → A (and B/A fan-in to R)
// Must organise as flow start first, sink last — never flip to R → … → C.
{
  const nodes = ['R', 'A', 'B', 'C'].map((id) => node(id, id));
  const edges = [
    { id: 'e1', fromNode: 'A', fromType: 'output', toNode: 'R', toType: 'input' },
    { id: 'e2', fromNode: 'B', fromType: 'output', toNode: 'R', toType: 'input' },
    { id: 'e3', fromNode: 'C', fromType: 'output', toNode: 'A', toType: 'input' },
  ];
  const info = forestRoot(nodes, edges);
  // Flow starts are B and C (sources). R is the sink and must not be the layout root.
  if (info.root === 'R') throw new Error('Reverse: sink R must not be layout root');
  if (!['B', 'C'].includes(info.root)) {
    throw new Error(`Reverse: expected a source root (B|C), got ${info.root}`);
  }
  const result = organise(nodes, edges);
  assertNoOverlap(result, 'Reverse');
  const byId = Object.fromEntries(result.map((n) => [n.id, n]));
  // Along primary axis: sources before sink so arrows read forward.
  if (!(byId['C'].x < byId['A'].x && byId['A'].x < byId['R'].x)) {
    throw new Error(
      `Reverse: expected C → A → R along x, got C=${byId['C'].x.toFixed(0)} A=${byId['A'].x.toFixed(0)} R=${byId['R'].x.toFixed(0)}`
    );
  }
  if (!(byId['B'].x < byId['R'].x)) {
    throw new Error('Reverse: B should sit before sink R');
  }
  console.log(
    'Reverse OK',
    'root',
    info.root,
    `C(${byId['C'].x.toFixed(0)})→A(${byId['A'].x.toFixed(0)})→R(${byId['R'].x.toFixed(0)})`
  );
}

// Chain C → B → A must become C, B, A (not A, B, C)
{
  const nodes = ['A', 'B', 'C'].map((id) => node(id, id));
  const edges = [
    { id: 'e1', fromNode: 'C', fromType: 'output', toNode: 'B', toType: 'input' },
    { id: 'e2', fromNode: 'B', fromType: 'output', toNode: 'A', toType: 'input' },
  ];
  const info = forestRoot(nodes, edges);
  if (info.root !== 'C') throw new Error(`Chain: expected root C, got ${info.root}`);
  const result = organise(nodes, edges);
  const byId = Object.fromEntries(result.map((n) => [n.id, n]));
  if (!(byId['C'].x < byId['B'].x && byId['B'].x < byId['A'].x)) {
    throw new Error('Chain: expected C → B → A along primary axis');
  }
  console.log('Chain OK');
}

// Hybrid — node with both in and out
//        T1
//         ↓
//        T2
//       ↙  ↘
//     U1    U2
//      ↑
//     U3
{
  const nodes = ['T1', 'T2', 'U1', 'U2', 'U3'].map((id) => node(id, id));
  const edges = [
    { id: 'e1', fromNode: 'T1', fromType: 'output', toNode: 'T2', toType: 'input' },
    { id: 'e2', fromNode: 'T2', fromType: 'output', toNode: 'U1', toType: 'input' },
    { id: 'e3', fromNode: 'T2', fromType: 'output', toNode: 'U2', toType: 'input' },
    { id: 'e4', fromNode: 'U3', fromType: 'output', toNode: 'U1', toType: 'input' },
  ];
  const info = forestRoot(nodes, edges);
  if (info.root !== 'T1' && !info.forestRoots.includes('T1')) {
    throw new Error(`Hybrid: expected flow start T1 among roots, got ${info.root} / ${info.forestRoots}`);
  }
  const result = organise(nodes, edges);
  assertNoOverlap(result, 'Hybrid');
  const byId = Object.fromEntries(result.map((n) => [n.id, n]));
  if (!(byId['T1'].x < byId['T2'].x && byId['T2'].x < byId['U2'].x)) {
    throw new Error('Hybrid: expected T1 → T2 → U2 along primary axis');
  }
  console.log('Hybrid OK', 'root', info.root, 'forestRoots', info.forestRoots.join(','));
}

// Case A DAG (original failure)
{
  const nodes = ['001', '002', '003', '004', '005', '006', '007', '008'].map((id) => node(id));
  const edges = [
    { id: 'a', fromNode: '001', fromType: 'output', toNode: '002', toType: 'input' },
    { id: 'b', fromNode: '001', fromType: 'output', toNode: '005', toType: 'input' },
    { id: 'c', fromNode: '001', fromType: 'output', toNode: '006', toType: 'input' },
    { id: 'd', fromNode: '002', fromType: 'output', toNode: '003', toType: 'input' },
    { id: 'e', fromNode: '002', fromType: 'output', toNode: '004', toType: 'input' },
    { id: 'f', fromNode: '002', fromType: 'output', toNode: '008', toType: 'input' },
    { id: 'g', fromNode: '003', fromType: 'output', toNode: '004', toType: 'input' },
    { id: 'h', fromNode: '003', fromType: 'output', toNode: '005', toType: 'input' },
    { id: 'i', fromNode: '006', fromType: 'output', toNode: '004', toType: 'input' },
    { id: 'j', fromNode: '007', fromType: 'output', toNode: '005', toType: 'input' },
    { id: 'k', fromNode: '008', fromType: 'output', toNode: '006', toType: 'input' },
  ];
  assertNoOverlap(organise(nodes, edges), 'DAG-A');
  console.log('DAG-A OK');
}

console.log('All layout smoke tests passed.');
