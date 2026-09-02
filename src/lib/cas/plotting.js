import { describePlottableWithMode } from './graphModes.js';
import { evalAstNumeric } from './numericEval.js';
import { getGraphSlotOpt } from '../graphSlots.js';

const SAMPLE_COUNT = 320;
const DEFAULT_X_MIN = -10;
const DEFAULT_X_MAX = 10;

export { evalAstNumeric };

/**
 * Turn an upstream AST into something we can plot.
 * Supports explicit one-variable forms and param substitution via slot options.
 */
export function describePlottable(ast, preferred = null, paramTexts = {}) {
  return describePlottableWithMode(ast, preferred, paramTexts);
}

export function parseAxisBound(text, fallback) {
  const raw = String(text ?? '').trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function autoYRange(series) {
  let min = Infinity;
  let max = -Infinity;
  series.forEach((s) => {
    (s.points || []).forEach((p) => {
      if (!p || !Number.isFinite(p.y)) return;
      min = Math.min(min, p.y);
      max = Math.max(max, p.y);
    });
    if (s.kind === 'hline' && Number.isFinite(s.value)) {
      min = Math.min(min, s.value);
      max = Math.max(max, s.value);
    }
  });
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { yMin: -10, yMax: 10 };
  }
  if (min === max) {
    const pad = Math.max(1, Math.abs(min) * 0.2);
    return { yMin: min - pad, yMax: max + pad };
  }
  const pad = (max - min) * 0.08;
  return { yMin: min - pad, yMax: max + pad };
}

function sampleFunction(exprAst, xMin, xMax, independent = 'x', sampleCount = SAMPLE_COUNT, params = {}) {
  const points = [];
  const span = xMax - xMin;
  const n = Math.max(32, Math.floor(sampleCount));
  if (!(span > 0) || !Number.isFinite(span)) return points;
  for (let i = 0; i <= n; i++) {
    const x = xMin + (span * i) / n;
    const y = evalAstNumeric(exprAst, { ...params, [independent]: x });
    if (Number.isFinite(y) && Math.abs(y) < 1e8) {
      points.push({ x, y });
    } else {
      points.push(null);
    }
  }
  return points;
}

/**
 * Build plot payload from inbound Math results and Graph node fields.
 */
export function buildPlotFromInputs(inboundList = [], node = {}) {
  const xMin = parseAxisBound(node.xMin, DEFAULT_X_MIN);
  const xMax = parseAxisBound(node.xMax, DEFAULT_X_MAX);
  const lo = Math.min(xMin, xMax);
  const hi = Math.max(xMin, xMax);
  const series = [];

  inboundList.forEach((item, index) => {
    const ast = item?.result?.ast;
    const slotId = item?.slotId || null;
    const opt = slotId ? getGraphSlotOpt(node, slotId) : { independent: null, dependent: null, params: {} };
    const preferred = {
      independent: opt.independent || null,
      dependent: opt.dependent || null,
      kind: opt.kind || null,
    };
    const desc = describePlottable(ast, preferred, opt.params || {});
    const base = {
      sourceId: item.sourceId,
      slotId,
      index,
      label: desc.label || item.result?.flat || `Series ${index + 1}`,
      kind: desc.kind,
      error: desc.error || null,
      points: [],
      value: null,
      independent: desc.independent || 'x',
      dependent: desc.dependent || 'y',
      paramNames: desc.paramNames || [],
      params: desc.params || {},
      modes: desc.modes || [],
    };
    if (desc.kind === 'function') {
      base.exprAst = desc.exprAst;
      base.points = sampleFunction(
        desc.exprAst,
        lo,
        hi,
        base.independent,
        SAMPLE_COUNT,
        base.params
      );
    } else if (desc.kind === 'hline') {
      const value = Number.isFinite(desc.value)
        ? desc.value
        : evalAstNumeric(desc.valueAst, base.params);
      base.value = value;
      if (Number.isFinite(value)) {
        base.points = [
          { x: lo, y: value },
          { x: hi, y: value },
        ];
      } else {
        base.kind = 'error';
        base.error = 'Could not evaluate constant';
      }
    } else if (desc.kind === 'vline') {
      const value = Number.isFinite(desc.value)
        ? desc.value
        : evalAstNumeric(desc.valueAst, base.params);
      base.value = value;
      if (!Number.isFinite(value)) {
        base.kind = 'error';
        base.error = 'Could not evaluate constant';
      }
    }
    series.push(base);
  });

  const usable = series.filter((s) => s.kind !== 'error');
  const { yMin, yMax } = autoYRange(usable);

  // Axis labels: use shared independent/dependent when series agree.
  const indeps = new Set(usable.map((s) => s.independent).filter(Boolean));
  const deps = new Set(usable.map((s) => s.dependent).filter(Boolean));
  const xLabel = indeps.size === 1 ? [...indeps][0] : 'x';
  const yLabel = deps.size === 1 ? [...deps][0] : 'y';

  return {
    xMin: lo,
    xMax: hi,
    yMin,
    yMax,
    xLabel,
    yLabel,
    series,
    error: !inboundList.length
      ? 'Connect expressions or equations to plot'
      : usable.length
        ? null
        : series[0]?.error || 'Nothing to plot',
  };
}

/** Resample a function series over an arbitrary x window (for interactive zoom). */
export function sampleSeriesInRange(series, xMin, xMax, sampleCount = SAMPLE_COUNT) {
  if (!series || series.kind !== 'function' || !series.exprAst) {
    return series?.points || [];
  }
  return sampleFunction(
    series.exprAst,
    xMin,
    xMax,
    series.independent || 'x',
    sampleCount,
    series.params || {}
  );
}

export { DEFAULT_X_MIN, DEFAULT_X_MAX, SAMPLE_COUNT };
