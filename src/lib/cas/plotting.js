import { collectVariables } from './selectionOps.js';
import { isEquationAst, printflat } from './engine.js';

const SAMPLE_COUNT = 320;
const DEFAULT_X_MIN = -10;
const DEFAULT_X_MAX = 10;

const UNARY_FUNCS = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  arcsin: Math.asin,
  arccos: Math.acos,
  arctan: Math.atan,
  ln: Math.log,
  log: (v) => Math.log10?.(v) ?? Math.log(v) / Math.LN10,
  abs: Math.abs,
  real: (v) => v,
  imag: () => 0,
  conj: (v) => v,
  arg: (v) => (v < 0 ? Math.PI : 0),
};

function isAtomVar(name) {
  return typeof name === 'string' && Number.isNaN(Number(name)) && name !== 'π' && name !== 'e' && name !== 'i';
}

function asNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    if (value === 'π') return Math.PI;
    if (value === 'e') return Math.E;
    if (value === 'i') return NaN;
    const n = Number(value);
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}

/** Numerically evaluate a CAS AST with a variable map. */
export function evalAstNumeric(ast, vars = {}) {
  if (ast === '' || ast == null) return NaN;
  if (!Array.isArray(ast)) {
    if (typeof ast === 'string' && Object.prototype.hasOwnProperty.call(vars, ast)) {
      return vars[ast];
    }
    return asNumber(ast);
  }
  const op = ast[0];
  if (op === '+') {
    let sum = 0;
    for (let i = 1; i < ast.length; i++) sum += evalAstNumeric(ast[i], vars);
    return sum;
  }
  if (op === '*') {
    let prod = 1;
    for (let i = 1; i < ast.length; i++) prod *= evalAstNumeric(ast[i], vars);
    return prod;
  }
  if (op === '-') {
    if (ast.length === 2) return -evalAstNumeric(ast[1], vars);
    if (ast.length >= 3) {
      let v = evalAstNumeric(ast[1], vars);
      for (let i = 2; i < ast.length; i++) v -= evalAstNumeric(ast[i], vars);
      return v;
    }
    return NaN;
  }
  if (op === '/') {
    if (ast.length < 3) return NaN;
    const num = evalAstNumeric(ast[1], vars);
    const den = evalAstNumeric(ast[2], vars);
    if (den === 0) return NaN;
    return num / den;
  }
  if (op === '^' || op === '^^') {
    if (ast.length < 3) return NaN;
    return evalAstNumeric(ast[1], vars) ** evalAstNumeric(ast[2], vars);
  }
  if (op === '=') {
    // Treat equality residual as lhs - rhs (not plotted directly).
    if (ast.length < 3) return NaN;
    return evalAstNumeric(ast[1], vars) - evalAstNumeric(ast[2], vars);
  }
  if (op === 'sqrt') {
    return Math.sqrt(evalAstNumeric(ast[1], vars));
  }
  if (UNARY_FUNCS[op]) {
    return UNARY_FUNCS[op](evalAstNumeric(ast[1], vars));
  }
  // Unknown head: try as product-like fallback
  return NaN;
}

function labelForAst(ast) {
  try {
    return String(printflat(ast) ?? '');
  } catch {
    return '';
  }
}

/**
 * Turn an upstream AST into something we can plot vs x.
 * Supports: f(x), y=f(x), y=const, x=const.
 */
export function describePlottable(ast) {
  if (ast === '' || ast == null) {
    return { kind: 'error', error: 'Empty input', label: '' };
  }

  if (isEquationAst(ast)) {
    const lhs = ast[1];
    const rhs = ast[2];
    const lhsVars = [...collectVariables(lhs)];
    const rhsVars = [...collectVariables(rhs)];

    if (lhs === 'y' || (isAtomVar(lhs) && lhs === 'y')) {
      const vars = new Set(rhsVars);
      vars.delete('y');
      if ([...vars].every((v) => v === 'x') || vars.size === 0) {
        if (vars.size === 0) {
          return { kind: 'hline', valueAst: rhs, label: labelForAst(ast) };
        }
        return { kind: 'function', exprAst: rhs, label: labelForAst(ast) };
      }
      return {
        kind: 'error',
        error: 'Use y = f(x) (only x on the right-hand side)',
        label: labelForAst(ast),
      };
    }

    if (rhs === 'y') {
      const vars = new Set(lhsVars);
      vars.delete('y');
      if ([...vars].every((v) => v === 'x') || vars.size === 0) {
        if (vars.size === 0) {
          return { kind: 'hline', valueAst: lhs, label: labelForAst(ast) };
        }
        return { kind: 'function', exprAst: lhs, label: labelForAst(ast) };
      }
    }

    if (lhs === 'x' && rhsVars.length === 0) {
      return { kind: 'vline', valueAst: rhs, label: labelForAst(ast) };
    }
    if (rhs === 'x' && lhsVars.length === 0) {
      return { kind: 'vline', valueAst: lhs, label: labelForAst(ast) };
    }

    // Equation with only x → not a y=f(x) curve for v1.
    const all = new Set([...lhsVars, ...rhsVars]);
    if (all.size === 1 && all.has('x')) {
      return {
        kind: 'error',
        error: 'Implicit F(x)=0 is not plotted yet — use y = f(x)',
        label: labelForAst(ast),
      };
    }
    return {
      kind: 'error',
      error: 'Connect y = f(x) or an expression in x',
      label: labelForAst(ast),
    };
  }

  const vars = [...collectVariables(ast)];
  if (vars.length === 0) {
    return { kind: 'hline', valueAst: ast, label: labelForAst(ast) };
  }
  if (vars.every((v) => v === 'x')) {
    return { kind: 'function', exprAst: ast, label: labelForAst(ast) };
  }
  if (vars.length === 1 && vars[0] !== 'y') {
    // Single free variable — treat as the independent axis.
    return {
      kind: 'function',
      exprAst: ast,
      independent: vars[0],
      label: labelForAst(ast),
    };
  }
  return {
    kind: 'error',
    error: 'Expression must depend only on x (or a single variable)',
    label: labelForAst(ast),
  };
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
    const desc = describePlottable(ast);
    const base = {
      sourceId: item.sourceId,
      index,
      label: desc.label || item.result?.flat || `Series ${index + 1}`,
      kind: desc.kind,
      error: desc.error || null,
      points: [],
      value: null,
    };
    if (desc.kind === 'function') {
      base.exprAst = desc.exprAst;
      base.independent = desc.independent || 'x';
      base.points = sampleFunction(desc.exprAst, lo, hi, base.independent);
    } else if (desc.kind === 'hline') {
      const value = evalAstNumeric(desc.valueAst, {});
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
      const value = evalAstNumeric(desc.valueAst, {});
      base.value = value;
      if (!Number.isFinite(value)) {
        base.kind = 'error';
        base.error = 'Could not evaluate constant';
      }
    }
    series.push(base);
  });

  const { yMin, yMax } = autoYRange(series.filter((s) => s.kind !== 'error'));
  const usable = series.filter((s) => s.kind !== 'error');
  return {
    xMin: lo,
    xMax: hi,
    yMin,
    yMax,
    series,
    error: !inboundList.length
      ? 'Connect expressions or y = f(x) equations'
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
  return sampleFunction(series.exprAst, xMin, xMax, series.independent || 'x', sampleCount);
}

function sampleFunction(exprAst, xMin, xMax, independent = 'x', sampleCount = SAMPLE_COUNT) {
  const points = [];
  const span = xMax - xMin;
  const n = Math.max(32, Math.floor(sampleCount));
  if (!(span > 0) || !Number.isFinite(span)) return points;
  for (let i = 0; i <= n; i++) {
    const x = xMin + (span * i) / n;
    const y = evalAstNumeric(exprAst, { [independent]: x });
    if (Number.isFinite(y) && Math.abs(y) < 1e8) {
      points.push({ x, y });
    } else {
      points.push(null);
    }
  }
  return points;
}

export { DEFAULT_X_MIN, DEFAULT_X_MAX, SAMPLE_COUNT };
