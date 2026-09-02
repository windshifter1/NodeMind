import {
  isBasicOperationNode,
  isExpressionNode,
  isMathNode,
  isSelectionOpNode,
  isSolveNode,
  isSubstituteNode,
} from '@/lib/nodeTypes';
import {
  applyRewrite,
  applySelectionOp,
  combineBasicOperation,
  isEquationAst,
  listApplicableOps,
  parseExpressionOrEquation,
  substituteEquations,
} from './engine.js';
import {
  ALL_EQUATIONS_REQUIRED_ERROR,
  collectVariables,
  isSelectionOpApplicable,
  listApplicableOpsForAst,
  listEquationOpsForAst,
  NOT_ENOUGH_INPUTS_ERROR,
  ONLY_ONE_EQUATION_ERROR,
  OPERATION_IGNORED_ERROR,
  selectionOpDisplayLabel,
  selectionOpKey,
} from './selectionOps.js';

function ignoredPassThrough(first, error) {
  return {
    ast: first?.ast ?? '',
    flat: first?.flat ?? '',
    latex: first?.latex ?? '',
    error,
    ignored: true,
    inputAst: first?.ast ?? null,
    applicableModes: null,
    applicableSelectionOps: null,
  };
}

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

function isUsableResult(item) {
  if (!item || item.ast === '' || item.ast == null) return false;
  if (item.ignored) return true;
  return !item.error;
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
    const inboundList = sources
      .map((src) => ({ sourceId: src, result: results.get(src) }))
      .filter((item) => isUsableResult(item.result));
    const inbound = inboundList[0]?.result || null;

    if (isExpressionNode(node)) {
      results.set(id, {
        ...parseExpressionOrEquation(node.expr),
        inputAst: null,
        applicableModes: null,
        applicableSelectionOps: null,
      });
      return;
    }

    if (isBasicOperationNode(node)) {
      if (inboundList.length < 2) {
        results.set(id, ignoredPassThrough(inboundList[0]?.result, NOT_ENOUGH_INPUTS_ERROR));
        return;
      }
      const combined = combineBasicOperation(
        inboundList.map((item) => item.result.ast),
        node.mode || '+'
      );
      if (combined.error === ONLY_ONE_EQUATION_ERROR) {
        results.set(id, ignoredPassThrough(inboundList[0]?.result, ONLY_ONE_EQUATION_ERROR));
        return;
      }
      results.set(id, {
        ...combined,
        ignored: false,
        inputAst: inboundList[0].result.ast,
        applicableModes: null,
        applicableSelectionOps: null,
      });
      return;
    }

    if (isSubstituteNode(node)) {
      if (inboundList.length < 2) {
        results.set(id, ignoredPassThrough(inboundList[0]?.result, NOT_ENOUGH_INPUTS_ERROR));
        return;
      }
      const substituted = substituteEquations(inboundList.map((item) => item.result.ast));
      if (
        substituted.error === ALL_EQUATIONS_REQUIRED_ERROR ||
        substituted.error === NOT_ENOUGH_INPUTS_ERROR
      ) {
        results.set(
          id,
          ignoredPassThrough(
            inboundList[0]?.result,
            substituted.error === ALL_EQUATIONS_REQUIRED_ERROR
              ? ALL_EQUATIONS_REQUIRED_ERROR
              : NOT_ENOUGH_INPUTS_ERROR
          )
        );
        return;
      }
      results.set(id, {
        ...substituted,
        ignored: false,
        inputAst: inboundList[0].result.ast,
        applicableModes: null,
        applicableSelectionOps: null,
      });
      return;
    }

    if (!inbound) {
      results.set(id, emptyResult('Connect a Math node'));
      return;
    }

    if (isSolveNode(node)) {
      if (!isEquationAst(inbound.ast)) {
        results.set(id, {
          ...emptyResult('Connect an equation'),
          inputAst: null,
          applicableSelectionOps: [],
        });
        return;
      }
      const listedOps = listEquationOpsForAst(inbound.ast);
      const variable = String(node.selection?.arg ?? node.field ?? '').trim();
      if (!variable) {
        results.set(id, {
          ...emptyResult('Select a variable'),
          inputAst: inbound.ast,
          applicableSelectionOps: listedOps,
        });
        return;
      }
      const vars = collectVariables(inbound.ast);
      if (!vars.has(variable)) {
        results.set(id, {
          ast: inbound.ast,
          flat: inbound.flat ?? '',
          latex: inbound.latex ?? '',
          error: OPERATION_IGNORED_ERROR,
          ignored: true,
          inputAst: inbound.ast,
          applicableModes: null,
          applicableSelectionOps: listedOps,
        });
        return;
      }
      const selection = {
        path: node.selection?.path || [],
        issel: node.selection?.issel ?? null,
        arg: variable,
        callStyle: 'solve',
      };
      const applied = applySelectionOp(inbound.ast, 'solveui', selection, variable);
      results.set(id, {
        ...applied,
        ignored: false,
        inputAst: inbound.ast,
        applicableModes: null,
        applicableSelectionOps: listedOps,
      });
      return;
    }

    if (isSelectionOpNode(node)) {
      const listedOps = listApplicableOpsForAst(inbound.ast, 'manipulation');
      if (!node.method) {
        results.set(id, {
          ...emptyResult('Select an operation'),
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
      if (!listedMatch && !selectionOk) {
        results.set(id, {
          ast: inbound.ast,
          flat: inbound.flat ?? '',
          latex: inbound.latex ?? '',
          error: OPERATION_IGNORED_ERROR,
          ignored: true,
          inputAst: inbound.ast,
          applicableModes: null,
          applicableSelectionOps: listedOps,
        });
        return;
      }
      const listedOp = listedOps.find((op) => {
        const key = node.opId || selectionOpKey(node);
        return (
          (op.id || selectionOpKey(op)) === key ||
          (op.method === node.method &&
            (op.extra?.arg ?? op.selection?.arg) === node.selection?.arg)
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
