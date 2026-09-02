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
    if (ast.length < 3) return NaN;
    return evalAstNumeric(ast[1], vars) - evalAstNumeric(ast[2], vars);
  }
  if (op === 'sqrt') {
    return Math.sqrt(evalAstNumeric(ast[1], vars));
  }
  if (UNARY_FUNCS[op]) {
    return UNARY_FUNCS[op](evalAstNumeric(ast[1], vars));
  }
  return NaN;
}
