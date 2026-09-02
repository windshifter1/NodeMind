import { isMathNode, isNumberNode, NODE_KIND } from '@/lib/nodeTypes';
import { applyRewrite, applySelectionOp, astFromNumber, listApplicableOps, parseExpression } from './engine.js';

function edgeDirection(edge) {
  return edge.fromType === 'output'
    ? { source: edge.fromNode, target: edge.toNode }
    : { source: edge.toNode, target: edge.fromNode };
}

function emptyResult(error = null) {
  return { ast: '', flat: '', latex: '', error, inputAst: null, applicableModes: null };
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
    const inbound = sources.map((src) => results.get(src)).find((item) => item && !item.error && item.ast !== '' && item.ast != null);

    if (isNumberNode(node)) {
      results.set(id, { ...astFromNumber(node.value), inputAst: null, applicableModes: null });
      return;
    }

    if (node.kind === NODE_KIND.EXPRESSION) {
      results.set(id, { ...parseExpression(node.expr), inputAst: null, applicableModes: null });
      return;
    }

    if (!inbound) {
      results.set(id, emptyResult('Connect a Math node'));
      return;
    }

    if (node.kind === NODE_KIND.CAS_OP) {
      const applied = applySelectionOp(inbound.ast, node.method, node.selection, node.field);
      results.set(id, {
        ...applied,
        inputAst: inbound.ast,
        applicableModes: null,
      });
      return;
    }

    const applied = applyRewrite(inbound.ast, node.kind, node.mode, node.field);
    const { modesByKind } = listApplicableOps(inbound.ast);
    results.set(id, {
      ...applied,
      inputAst: inbound.ast,
      applicableModes: modesByKind[node.kind] || null,
    });
  });

  return results;
}
