/**
 * Lightweight data-graph evaluation for Table / Chart / Stats / Load File / File Converter.
 * Parallel to CAS evaluateMathGraph — does not use ASTs.
 */
import {
  isChartNode,
  isFileConverterNode,
  isLoadFileNode,
  isStatsNode,
  isTableNode,
  isUnitConvertNode,
} from '@/lib/nodeTypes';
import { convertUnits, formatUnitResult, listCompatibleUnits, parseNumericInput } from '@/lib/units';
import { listApplicableConversions } from '@/lib/media/conversions';

function edgeDirection(edge) {
  return edge.fromType === 'output'
    ? { source: edge.fromNode, target: edge.toNode }
    : { source: edge.toNode, target: edge.fromNode };
}

function empty(error = null) {
  return {
    kind: null,
    value: null,
    error,
    ignored: false,
    applicableConversions: null,
    applicableUnits: null,
    applicableMetrics: null,
  };
}

function isDataParticipant(node) {
  return (
    isTableNode(node) ||
    isChartNode(node) ||
    isStatsNode(node) ||
    isLoadFileNode(node) ||
    isFileConverterNode(node) ||
    isUnitConvertNode(node)
  );
}

function tablePayload(node) {
  const columns = Array.isArray(node.columns) && node.columns.length
    ? node.columns
    : [
        { id: 'c1', name: 'A' },
        { id: 'c2', name: 'B' },
      ];
  const rows = Array.isArray(node.rows) ? node.rows : [];
  return { kind: 'table', value: { columns, rows }, error: null, ignored: false };
}

function numericColumns(table) {
  if (!table?.columns?.length) return [];
  return table.columns.filter((col) => {
    const vals = (table.rows || [])
      .map((row) => parseNumericInput(row?.[col.id]))
      .filter((n) => Number.isFinite(n));
    return vals.length > 0;
  });
}

function columnValues(table, colId) {
  return (table.rows || [])
    .map((row) => parseNumericInput(row?.[colId]))
    .filter((n) => Number.isFinite(n));
}

function mean(arr) {
  if (!arr.length) return NaN;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function median(arr) {
  if (!arr.length) return NaN;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function stdev(arr) {
  if (arr.length < 2) return NaN;
  const m = mean(arr);
  const v = arr.reduce((acc, x) => acc + (x - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(v);
}

const METRIC_FNS = {
  count: (arr) => arr.length,
  sum: (arr) => arr.reduce((a, b) => a + b, 0),
  mean,
  median,
  min: (arr) => (arr.length ? Math.min(...arr) : NaN),
  max: (arr) => (arr.length ? Math.max(...arr) : NaN),
  stdev,
};

export const STAT_METRIC_OPTIONS = [
  { id: 'count', label: 'Count' },
  { id: 'sum', label: 'Sum' },
  { id: 'mean', label: 'Mean' },
  { id: 'median', label: 'Median' },
  { id: 'min', label: 'Min' },
  { id: 'max', label: 'Max' },
  { id: 'stdev', label: 'Std deviation' },
];

/**
 * @param {object[]} nodes
 * @param {object[]} edges
 * @param {Map} [mathResults] — optional CAS results for unit-convert numeric input
 */
export function evaluateDataGraph(nodes = [], edges = [], mathResults = null) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const ids = nodes.filter(isDataParticipant).map((n) => n.id);
  const idSet = new Set(ids);
  const incoming = new Map(ids.map((id) => [id, []]));
  const outgoing = new Map(ids.map((id) => [id, []]));

  (edges || []).forEach((edge) => {
    const { source, target } = edgeDirection(edge);
    // Allow math → unitConvert by also recording math sources outside idSet.
    if (!idSet.has(target)) return;
    incoming.get(target).push(source);
    if (idSet.has(source)) outgoing.get(source).push(target);
  });

  // Also accept math → unitConvert edges
  (edges || []).forEach((edge) => {
    const { source, target } = edgeDirection(edge);
    if (!idSet.has(target)) return;
    if (idSet.has(source)) return;
    const srcNode = byId.get(source);
    if (srcNode && isUnitConvertNode(byId.get(target))) {
      if (!incoming.get(target).includes(source)) incoming.get(target).push(source);
    }
  });

  const indegree = new Map(ids.map((id) => [id, incoming.get(id).filter((s) => idSet.has(s)).length]));
  const queue = ids.filter((id) => indegree.get(id) === 0);
  const order = [];
  while (queue.length) {
    const id = queue.shift();
    order.push(id);
    (outgoing.get(id) || []).forEach((next) => {
      indegree.set(next, indegree.get(next) - 1);
      if (indegree.get(next) === 0) queue.push(next);
    });
  }

  // Append any leftover (cycles) so we still produce errors
  ids.forEach((id) => {
    if (!order.includes(id)) order.push(id);
  });

  const results = new Map();

  order.forEach((id) => {
    const node = byId.get(id);
    if (!node) return;

    if (isTableNode(node)) {
      results.set(id, tablePayload(node));
      return;
    }

    if (isLoadFileNode(node)) {
      if (!node.fileId) {
        results.set(id, empty('Attach a file'));
        return;
      }
      results.set(id, {
        kind: 'fileRef',
        value: {
          fileId: node.fileId,
          name: node.fileName || 'file',
          mime: node.fileMime || '',
          size: node.fileSize || 0,
        },
        error: null,
        ignored: false,
        applicableConversions: listApplicableConversions({
          mime: node.fileMime,
          name: node.fileName,
        }),
      });
      return;
    }

    const inboundIds = incoming.get(id) || [];
    const inboundResults = inboundIds
      .map((src) => results.get(src) || (mathResults ? mathToNumberPayload(mathResults.get(src)) : null))
      .filter(Boolean);

    if (isUnitConvertNode(node)) {
      const applicableUnits = listCompatibleUnits(node.fromUnit || 'm');
      let inputNum = parseNumericInput(node.value);
      const mathInbound = inboundIds
        .map((src) => mathToNumberPayload(mathResults?.get?.(src)))
        .find((p) => p && Number.isFinite(p.value));
      const dataInbound = inboundResults.find(
        (r) =>
          (r.kind === 'number' || r.kind === 'unitValue') &&
          Number.isFinite(r.value?.result ?? r.value)
      );
      if (mathInbound) inputNum = mathInbound.value;
      else if (dataInbound) {
        inputNum =
          dataInbound.kind === 'unitValue'
            ? dataInbound.value.result
            : dataInbound.value;
      }

      if (!node.fromUnit || !node.toUnit) {
        results.set(id, {
          ...empty('Choose units'),
          applicableUnits,
        });
        return;
      }
      const compatible = applicableUnits.some((u) => u.id === node.toUnit);
      if (!compatible) {
        results.set(id, {
          kind: 'unitValue',
          value: { result: inputNum, fromUnit: node.fromUnit, toUnit: node.toUnit },
          error: 'Output unit not compatible — pick another',
          ignored: true,
          applicableUnits,
        });
        return;
      }
      const converted = convertUnits(inputNum, node.fromUnit, node.toUnit);
      if (converted.error) {
        results.set(id, { ...empty(converted.error), applicableUnits });
        return;
      }
      results.set(id, {
        kind: 'unitValue',
        value: {
          result: converted.result,
          display: formatUnitResult(converted.result),
          fromUnit: node.fromUnit,
          toUnit: node.toUnit,
          input: inputNum,
        },
        error: null,
        ignored: false,
        applicableUnits,
      });
      return;
    }

    if (isChartNode(node)) {
      const tableIn = inboundResults.find((r) => r.kind === 'table')?.value;
      if (!tableIn) {
        results.set(id, empty('Connect a Table'));
        return;
      }
      results.set(id, {
        kind: 'series',
        value: {
          table: tableIn,
          chartType: node.chartType || 'bar',
          xKey: node.xKey || tableIn.columns[0]?.id,
          yKeys: Array.isArray(node.yKeys) && node.yKeys.length
            ? node.yKeys
            : tableIn.columns.slice(1, 2).map((c) => c.id),
        },
        error: null,
        ignored: false,
      });
      return;
    }

    if (isStatsNode(node)) {
      const tableIn =
        inboundResults.find((r) => r.kind === 'table')?.value ||
        inboundResults.find((r) => r.kind === 'series')?.value?.table;
      if (!tableIn) {
        results.set(id, empty('Connect a Table or Chart'));
        return;
      }
      const numCols = numericColumns(tableIn);
      const applicableMetrics = STAT_METRIC_OPTIONS;
      const colId = node.statsColumn || numCols[0]?.id;
      const metrics = Array.isArray(node.statsMetrics) && node.statsMetrics.length
        ? node.statsMetrics
        : ['mean', 'min', 'max'];
      if (!colId || !numCols.some((c) => c.id === colId)) {
        results.set(id, {
          ...empty(numCols.length ? 'Pick a numeric column' : 'No numeric columns'),
          applicableMetrics,
        });
        return;
      }
      const vals = columnValues(tableIn, colId);
      const computed = {};
      metrics.forEach((m) => {
        const fn = METRIC_FNS[m];
        if (fn) computed[m] = fn(vals);
      });
      results.set(id, {
        kind: 'stats',
        value: { column: colId, metrics: computed, sampleSize: vals.length, table: tableIn },
        error: null,
        ignored: false,
        applicableMetrics,
      });
      return;
    }

    if (isFileConverterNode(node)) {
      const fileIn = inboundResults.find((r) => r.kind === 'fileRef')?.value;
      const applicableConversions = fileIn
        ? listApplicableConversions(fileIn)
        : [];
      if (!fileIn) {
        results.set(id, {
          ...empty('Connect a Load File node'),
          applicableConversions: [],
        });
        return;
      }
      if (!node.conversionId) {
        results.set(id, {
          kind: 'fileRef',
          value: fileIn,
          error: 'Select a conversion',
          ignored: false,
          applicableConversions,
        });
        return;
      }
      const ok = applicableConversions.some((c) => c.id === node.conversionId);
      if (!ok) {
        results.set(id, {
          kind: 'fileRef',
          value: fileIn,
          error: 'Conversion not applicable',
          ignored: true,
          applicableConversions,
        });
        return;
      }
      results.set(id, {
        kind: 'conversion',
        value: { source: fileIn, conversionId: node.conversionId },
        error: null,
        ignored: false,
        applicableConversions,
      });
      return;
    }

    results.set(id, empty());
  });

  return results;
}

function mathToNumberPayload(mathResult) {
  if (!mathResult) return null;
  const n = parseNumericInput(mathResult.flat);
  if (!Number.isFinite(n)) {
    // Try AST leaf
    if (typeof mathResult.ast === 'number' || typeof mathResult.ast === 'string') {
      const n2 = parseNumericInput(mathResult.ast);
      if (Number.isFinite(n2)) return { kind: 'number', value: n2, error: null };
    }
    return null;
  }
  return { kind: 'number', value: n, error: null };
}
