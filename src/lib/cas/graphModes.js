import { collectVariables } from './selectionOps.js';
import { isEquationAst, parseExpressionOrEquation, printflat } from './engine.js';
import { evalAstNumeric } from './numericEval.js';

function isAtomVar(name) {
  return typeof name === 'string' && Number.isNaN(Number(name)) && name !== 'π' && name !== 'e' && name !== 'i';
}

function labelForAst(ast) {
  try {
    return String(printflat(ast) ?? '');
  } catch {
    return '';
  }
}

/** True when the param field is empty or a plain number (show scrubbers). */
export function isPlainNumberParam(text) {
  const raw = String(text ?? '').trim();
  if (!raw) return true;
  return /^-?\d*\.?\d+(e[-+]?\d+)?$/i.test(raw);
}

/** Resolve a param field: empty → 1; number or numeric expression. */
export function resolveParamValue(text) {
  const raw = String(text ?? '').trim();
  if (!raw) return 1;
  if (isPlainNumberParam(raw)) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : NaN;
  }
  const parsed = parseExpressionOrEquation(raw);
  if (parsed?.error || parsed?.ast == null || parsed?.ast === '') return NaN;
  // Reject free variables in param expressions (must be a closed form).
  const vars = collectVariables(parsed.ast);
  if (vars.size > 0) return NaN;
  return evalAstNumeric(parsed.ast, {});
}

export function resolveParamMap(paramTexts = {}, names = []) {
  const out = {};
  names.forEach((name) => {
    out[name] = resolveParamValue(paramTexts[name]);
  });
  return out;
}

/**
 * List plottable modes for an AST: "dependent in terms of independent".
 * Skips fully implicit F(x,y)=0 (not rearrangeable to a single explicit side).
 */
export function listPlotModes(ast) {
  if (ast === '' || ast == null) return [];

  if (isEquationAst(ast)) {
    const lhs = ast[1];
    const rhs = ast[2];
    const modes = [];
    const seen = new Set();

    const add = (dependent, independent, kind, exprAst = null, valueAst = null) => {
      const key = `${kind}:${dependent || ''}:${independent || ''}`;
      if (seen.has(key)) return;
      seen.add(key);
      const label =
        kind === 'hline'
          ? `${dependent} = constant`
          : kind === 'vline'
            ? `${independent} = constant`
            : `${dependent} in terms of ${independent}`;
      modes.push({
        kind,
        dependent: dependent || null,
        independent: independent || null,
        exprAst,
        valueAst,
        label,
      });
    };

    const considerSide = (depSide, exprSide) => {
      if (!isAtomVar(depSide)) return;
      const exprVars = [...collectVariables(exprSide)].filter((v) => v !== depSide);
      if (exprVars.length === 0) {
        add(depSide, null, 'hline', null, exprSide);
        return;
      }
      exprVars.forEach((indep) => {
        add(depSide, indep, 'function', exprSide, null);
      });
    };

    considerSide(lhs, rhs);
    considerSide(rhs, lhs);

    // Independent = constant (vertical line in the plot’s independent axis).
    if (isAtomVar(lhs) && collectVariables(rhs).size === 0) {
      // Already covered as hline when lhs is dependent; also offer as vline mode
      // when the user picks lhs as the independent axis elsewhere — handled by mode pick.
    }
    if (isAtomVar(lhs) && collectVariables(rhs).size === 0 && modes.every((m) => m.kind !== 'vline')) {
      // x = 3 → vline when plotting with independent x
      add(null, lhs, 'vline', null, rhs);
    }
    if (isAtomVar(rhs) && collectVariables(lhs).size === 0) {
      add(null, rhs, 'vline', null, lhs);
    }

    return modes;
  }

  const vars = [...collectVariables(ast)];
  if (vars.length === 0) {
    return [
      {
        kind: 'hline',
        dependent: 'y',
        independent: null,
        exprAst: null,
        valueAst: ast,
        label: 'constant',
      },
    ];
  }
  return vars.map((indep) => ({
    kind: 'function',
    dependent: null,
    independent: indep,
    exprAst: ast,
    valueAst: null,
    label: `f in terms of ${indep}`,
  }));
}

function modeKey(mode) {
  return `${mode.kind}:${mode.dependent || ''}:${mode.independent || ''}`;
}

/** Pick a default mode: prefer y in terms of x, then y=const / x=const, then first. */
export function pickDefaultMode(modes, preferred = null) {
  if (!modes?.length) return null;
  if (preferred && (preferred.independent || preferred.dependent || preferred.kind)) {
    const match = modes.find(
      (m) =>
        (!preferred.kind || m.kind === preferred.kind) &&
        (m.independent || null) === (preferred.independent || null) &&
        (m.dependent || null) === (preferred.dependent || null)
    );
    if (match) return match;
    const soft = modes.find(
      (m) =>
        (m.independent || null) === (preferred.independent || null) &&
        (m.dependent || null) === (preferred.dependent || null)
    );
    if (soft) return soft;
  }
  const yx = modes.find((m) => m.kind === 'function' && m.dependent === 'y' && m.independent === 'x');
  if (yx) return yx;
  const yAny = modes.find((m) => m.kind === 'function' && m.dependent === 'y');
  if (yAny) return yAny;
  const yH = modes.find((m) => m.kind === 'hline' && m.dependent === 'y');
  if (yH) return yH;
  const xV = modes.find((m) => m.kind === 'vline' && m.independent === 'x');
  if (xV) return xV;
  const fx = modes.find((m) => m.kind === 'function' && m.independent === 'x');
  if (fx) return fx;
  const fn = modes.find((m) => m.kind === 'function');
  if (fn) return fn;
  return modes[0];
}

/** Free variables that become adjustable params for a chosen mode. */
export function paramNamesForMode(ast, mode) {
  if (!mode) return [];
  const all = [...collectVariables(ast)];
  const skip = new Set();
  if (mode.independent) skip.add(mode.independent);
  if (mode.dependent) skip.add(mode.dependent);
  if (mode.kind === 'function' && mode.exprAst) {
    return [...collectVariables(mode.exprAst)].filter((v) => v !== mode.independent).sort();
  }
  return all.filter((v) => !skip.has(v)).sort();
}

/**
 * Classify an AST for plotting with an optional preferred mode + param texts.
 */
export function describePlottableWithMode(ast, preferred = null, paramTexts = {}) {
  if (ast === '' || ast == null) {
    return { kind: 'error', error: 'Empty input', label: '' };
  }

  const modes = listPlotModes(ast);
  if (!modes.length) {
    return {
      kind: 'error',
      error: 'No plottable form — use an explicit equation like d = g² or an expression in one free variable',
      label: labelForAst(ast),
      modes: [],
    };
  }

  const mode = pickDefaultMode(modes, preferred);
  const paramNames = paramNamesForMode(ast, mode);
  const params = resolveParamMap(paramTexts, paramNames);
  const badParam = paramNames.find((name) => !Number.isFinite(params[name]));
  if (badParam) {
    return {
      kind: 'error',
      error: `Parameter ${badParam} is not a valid number or closed expression`,
      label: labelForAst(ast),
      modes,
      mode,
      paramNames,
      params,
    };
  }

  if (mode.kind === 'hline') {
    const value = evalAstNumeric(mode.valueAst, params);
    return {
      kind: Number.isFinite(value) ? 'hline' : 'error',
      error: Number.isFinite(value) ? null : 'Could not evaluate constant',
      valueAst: mode.valueAst,
      value,
      label: mode.label || labelForAst(ast),
      independent: mode.independent || 'x',
      dependent: mode.dependent || 'y',
      modes,
      mode,
      paramNames,
      params,
    };
  }

  if (mode.kind === 'vline') {
    const value = evalAstNumeric(mode.valueAst, params);
    return {
      kind: Number.isFinite(value) ? 'vline' : 'error',
      error: Number.isFinite(value) ? null : 'Could not evaluate constant',
      valueAst: mode.valueAst,
      value,
      label: mode.label || labelForAst(ast),
      independent: mode.independent || 'x',
      dependent: mode.dependent || 'y',
      modes,
      mode,
      paramNames,
      params,
    };
  }

  // function
  return {
    kind: 'function',
    exprAst: mode.exprAst,
    independent: mode.independent || 'x',
    dependent: mode.dependent || 'y',
    label: mode.label || labelForAst(ast),
    modes,
    mode,
    paramNames,
    params,
    error: null,
  };
}

export { modeKey, isAtomVar, labelForAst };
