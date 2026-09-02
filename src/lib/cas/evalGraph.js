import { isMathNode, isNumberNode, isSelectionOpNode, NODE_KIND } from '@/lib/nodeTypes';
import { applyRewrite, applySelectionOp, astFromNumber, listApplicableOps, parseExpression } from './engine.js';
import { isEquationSelectionMethod, listApplicableOpsForAst, selectionOpKey } from './selectionOps.js';

function edgeDirection(edge) {
  return edge.fromType === 'output'
    ? { source: edge.fromNode, target: edge.toNode }
    : { source: edge.toNode, target: edge.fromNode };
}

function emptyResult(error = null) {
  return {
    ast: '',
    flat: '',
    latex: '',
    error,
    inputAst: null,
    applicableModes: null,
    applicableSelectionOps: null,
  };
}

function selectionOpCategory(kind) {
  return kind === NODE_KIND.EQUATION_OP ? 'equation' : 'manipulation';
}

function ensureCurrentOpListed(ops, node) {
  if (!node?.method) return ops || [];
  const list = [...(ops || [])];
  const key = node.opId || selectionOpKey(node);
  if (list.some((op) => (op.id || selectionOpKey(op)) === key || op.method === node.method)) {
    return list;
  }
  list.unshift({
    id: key || `${node.method}:current`,
    label: node.title && node.title !== 'Manipulation' && node.title !== 'Equation operation' && node.title !== 'Operation'
      ? node.title
      : node.method,
    method: node.method,
    extra: {
      arg: node.selection?.arg,
      callStyle: node.selection?.callStyle,
    },
    selection: node.selection || null,
  });
  return list;
}

export function evaluateMathGraph(nodes = [], edges = []) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const mathIds = nodes.filter(isMathNode).map((node) => node.id);
  const mathSet = new Set(mathIds);
  const incoming = new Map(mathIds.map((id) => [id, []]));
  const outgoing = new Map(mathIds.map((id) => [id, []]));

  (edges || []).forEach((edge) => {
    const { source, target } = edgeDirection(edge);
    if (!mathSet.has(source) || !mathSet.has(target)) return;
    incoming.get(target).push(source);
    outgoing.get(source).push(target);
  });

  const indegree = new Map(mathIds.map((id) => [id, incoming.get(id).length]));
  const queue = mathIds.filter((id) => indegree.get(id) === 0);
  const order = [];
  while (queue.length) {
    const id = queue.shift();
    order.push(id);
    (outgoing.get(id) || []).forEach((next) => {
      indegree.set(next, indegree.get(next) - 1);
      if (indegree.get(next) === 0) queue.push(next);
    });
  }

  const results = new Map();
  const cyclic = new Set(mathIds.filter((id) => !order.includes(id)));
  cyclic.forEach((id) => {
    results.set(id, emptyResult('Cycle in Math connections'));
  });

  order.forEach((id) => {
    const node = byId.get(id);
    const sources = incoming.get(id) || [];
    const inbound = sources
      .map((src) => results.get(src))
      .find((item) => item && !item.error && item.ast !== '' && item.ast != null);

    if (isNumberNode(node)) {
      results.set(id, {
        ...astFromNumber(node.value),
        inputAst: null,
        applicableModes: null,
        applicableSelectionOps: null,
      });
      return;
    }

    if (node.kind === NODE_KIND.EXPRESSION) {
      results.set(id, {
        ...parseExpression(node.expr),
        inputAst: null,
        applicableModes: null,
        applicableSelectionOps: null,
      });
      return;
    }

    if (!inbound) {
      results.set(id, emptyResult('Connect a Math node'));
      return;
    }

    if (isSelectionOpNode(node)) {
      const category = selectionOpCategory(node.kind);
      const applicableSelectionOps = ensureCurrentOpListed(
        listApplicableOpsForAst(inbound.ast, category),
        node
      );
      if (!node.method) {
        results.set(id, {
          ...emptyResult('Select an operation'),
          inputAst: inbound.ast,
          applicableSelectionOps,
        });
        return;
      }
      // Guard: equation nodes should only run solve-style methods.
      if (node.kind === NODE_KIND.EQUATION_OP && !isEquationSelectionMethod(node.method)) {
        results.set(id, {
          ...emptyResult('Select an equation operation'),
          inputAst: inbound.ast,
          applicableSelectionOps,
        });
        return;
      }
      const applied = applySelectionOp(inbound.ast, node.method, node.selection, node.field);
      results.set(id, {
        ...applied,
        inputAst: inbound.ast,
        applicableModes: null,
        applicableSelectionOps,
      });
      return;
    }

    const applied = applyRewrite(inbound.ast, node.kind, node.mode, node.field);
    const { modesByKind } = listApplicableOps(inbound.ast);
    results.set(id, {
      ...applied,
      inputAst: inbound.ast,
      applicableModes: modesByKind[node.kind] || null,
      applicableSelectionOps: null,
    });
  });

  return results;
}
