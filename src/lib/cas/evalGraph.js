import { isMathNode, isNumberNode, isSelectionOpNode, NODE_KIND } from '@/lib/nodeTypes';
import { applyRewrite, applySelectionOp, astFromNumber, listApplicableOps, parseExpression } from './engine.js';
import {
  isEquationSelectionMethod,
  isSelectionOpApplicable,
  listApplicableOpsForAst,
  OPERATION_IGNORED_ERROR,
  selectionOpDisplayLabel,
  selectionOpKey,
} from './selectionOps.js';

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
    ignored: false,
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
    label: selectionOpDisplayLabel(node) || node.method,
    method: node.method,
    extra: {
      arg: node.selection?.arg,
      callStyle: node.selection?.callStyle,
    },
    selection: node.selection || null,
  });
  return list;
}

/** True when the node's current op matches an entry from the live applicable list. */
function isCurrentOpListed(ops, node) {
  if (!node?.method || !ops?.length) return false;
  const key = node.opId || selectionOpKey(node);
  return ops.some((op) => {
    if ((op.id || selectionOpKey(op)) === key) return true;
    if (op.method !== node.method) return false;
    const opArg = op.extra?.arg ?? op.selection?.arg;
    const nodeArg = node.selection?.arg;
    return opArg === nodeArg || (opArg == null && (nodeArg == null || nodeArg === ''));
  });
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
      .find(
        (item) =>
          item && !item.error && !item.ignored && item.ast !== '' && item.ast != null
      );

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
      const listedOps = listApplicableOpsForAst(inbound.ast, category);
      if (!node.method) {
        results.set(id, {
          ...emptyResult('Select an operation'),
          inputAst: inbound.ast,
          applicableSelectionOps: listedOps,
        });
        return;
      }
      // Guard: equation nodes should only run solve-style methods.
      if (node.kind === NODE_KIND.EQUATION_OP && !isEquationSelectionMethod(node.method)) {
        results.set(id, {
          ...emptyResult('Select an equation operation'),
          inputAst: inbound.ast,
          applicableSelectionOps: listedOps,
        });
        return;
      }
      const listedMatch = isCurrentOpListed(listedOps, node);
      const selectionOk = isSelectionOpApplicable(
        inbound.ast,
        node.method,
        node.selection,
        node.field
      );
      // Listed ops win (some menu entries are shown without a check-mode pass).
      // Otherwise keep the stored selection if it still dry-runs successfully.
      if (!listedMatch && !selectionOk) {
        results.set(id, {
          ...emptyResult(OPERATION_IGNORED_ERROR),
          ignored: true,
          inputAst: inbound.ast,
          applicableSelectionOps: listedOps,
        });
        return;
      }
      const listedOp = listedOps.find((op) => {
        const key = node.opId || selectionOpKey(node);
        return (
          (op.id || selectionOpKey(op)) === key ||
          (op.method === node.method &&
            (op.extra?.arg ?? op.selection?.arg) === (node.selection?.arg))
        );
      });
      const selection =
        selectionOk || !listedOp?.selection ? node.selection : listedOp.selection;
      const applied = applySelectionOp(inbound.ast, node.method, selection, node.field);
      results.set(id, {
        ...applied,
        ignored: false,
        inputAst: inbound.ast,
        applicableModes: null,
        applicableSelectionOps: ensureCurrentOpListed(listedOps, node),
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
