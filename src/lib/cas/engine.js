import equationSource from './equation.js?raw';
import { bindEquation } from './loadEquation.js';

const { equation, text2eq, printflat, printlatex, deepCopy } = bindEquation(equationSource);

const FUNCTION_NAMES = equation.functionnames;

function cloneAst(ast) {
  return deepCopy(ast);
}

function formatResult(ast) {
  try {
    return {
      ast,
      flat: ast === '' || ast == null ? '' : String(printflat(ast) ?? ''),
      latex: ast === '' || ast == null ? '' : String(printlatex(ast) ?? ''),
      error: null,
    };
  } catch (err) {
    return { ast, flat: '', latex: '', error: err?.message || String(err) };
  }
}

function createHeadlessEquation(ast) {
  const eq = new equation();
  eq.headless = true;
  eq.history = undefined;
  eq.canvasid = '';
  eq.equation = ast === undefined ? '' : ast;
  eq.sortanddraw = function sortHeadless() {
    this.changedgraph = true;
    for (let i = 0; i < 100; i++) {
      this.changedgraph = false;
      this.simplifygraph(this.equation);
      this.rem01(this.equation);
      this.ordergraph(this.equation);
      if (!this.changedgraph) break;
    }
  };
  eq.isselected = function selectAll(node) {
    if (!Array.isArray(node)) return [true];
    return new Array(node.length).fill(true);
  };
  eq.countselected = function countAll(node) {
    if (!Array.isArray(node)) return 1;
    let n = 1;
    for (let i = 1; i < node.length; i++) {
      n += Array.isArray(node[i]) ? eq.countselected(node[i]) : 1;
    }
    return n;
  };
  eq.draw = function noopDraw() {};
  eq.printimage = function noopPrint() {
    return '';
  };
  return eq;
}

function simplifyAst(ast) {
  const eq = createHeadlessEquation(cloneAst(ast));
  eq.sortanddraw();
  return eq.equation;
}

export function parseExpression(text) {
  const input = String(text ?? '').replace(/\s+/g, '');
  if (!input) {
    return { ast: '', errors: '', applyOp: '', flat: '', latex: '', error: 'Empty expression' };
  }
  try {
    const [ast, errors, applyOp] = text2eq(input);
    const errText = String(errors || '').replace(/<br>/g, '\n').trim();
    if (errText) {
      return { ast: ast || '', errors: errText, applyOp: applyOp || '', flat: '', latex: '', error: errText };
    }
    const simplified = ast === '' ? ast : simplifyAst(ast);
    return {
      ...formatResult(simplified),
      errors: '',
      applyOp: applyOp || '',
    };
  } catch (err) {
    return {
      ast: '',
      errors: err?.message || String(err),
      applyOp: '',
      flat: '',
      latex: '',
      error: err?.message || String(err),
    };
  }
}

function parseField(text) {
  const parsed = parseExpression(text);
  if (parsed.error) return parsed;
  return parsed;
}

function findDecimalIndex(node) {
  if (!Array.isArray(node)) return null;
  for (let i = 1; i < node.length; i++) {
    if (typeof node[i] === 'string' && !Number.isNaN(Number(node[i])) && node[i].includes('.')) {
      return i;
    }
  }
  return null;
}

function findIntegerFactorIndex(node) {
  if (!Array.isArray(node)) return null;
  for (let i = 1; i < node.length; i++) {
    const v = node[i];
    if (typeof v === 'string' && !Number.isNaN(Number(v))) {
      const num = Number(v);
      if (num % 1 === 0 && num >= 4) return i;
    }
  }
  return null;
}

function withFakeInput(value, fn) {
  if (typeof document === 'undefined') return fn();
  const original = document.getElementById.bind(document);
  document.getElementById = (id) => {
    if (id === 'input' || id === 'inputdisplay' || id === 'errors') {
      return { value: value ?? '', innerHTML: '', style: {} };
    }
    return original(id);
  };
  try {
    return fn();
  } finally {
    document.getElementById = original;
  }
}

function applyBothSides(ast, op, rhsAst) {
  const next = cloneAst(ast);
  const applyTo = (side) => {
    if (op === '^^') return ['^', cloneAst(rhsAst), cloneAst(side)];
    if (FUNCTION_NAMES.includes(op)) return [op, cloneAst(side)];
    return [op, cloneAst(side), cloneAst(rhsAst)];
  };
  if (Array.isArray(next) && next[0] === '=') {
    for (let i = 1; i < next.length; i++) next[i] = applyTo(next[i]);
    return next;
  }
  return applyTo(next);
}

function runMethod(eq, method, args) {
  const fn = eq[method];
  if (typeof fn !== 'function') {
    throw new Error(`Unknown CAS method: ${method}`);
  }
  return fn.apply(eq, args);
}

const OP_DISPATCH = {
  combineLike: { method: 'combineliketermsrecursive' },
  expand: {
    polynomial: { method: 'expand' },
    fraction: { method: 'expandfraction' },
    power: { method: 'expandpower' },
    neg1: { method: 'expandfactorneg1' },
  },
  factor: {
    factor: { method: 'factor' },
    polynomial: { method: 'factorpolynomial' },
    completeSquare: { method: 'factorcompletesquare' },
  },
  collect: { method: 'collect', fieldAs: 'menu' },
  simplifyFrac: { method: 'simplifyfrac' },
  powers: {
    addPowers: { method: 'multbyaddpower' },
    combine: { method: 'combinepower' },
    positive: { method: 'pospow' },
    negative: { method: 'negpow' },
  },
  sameDenom: { method: 'multiplyfracby1' },
  multByOne: {
    conjugate: { method: 'mult1conj' },
    fracOverFrac: { method: 'mult1fracoverfrac' },
    e2piik: { method: 'mult1e2piik' },
    negi2: { method: 'mult1negi2' },
    powpow: { method: 'mult1powpow' },
  },
  polyDiv: { method: 'polynomialdivision', fieldAs: 'menu' },
  partialFrac: { method: 'partialfractions', fieldAs: 'menu' },
  diff: {
    calculate: { method: 'calcdiff' },
    swap: { method: 'diffswaporder' },
    productRule: { method: 'diffcombineproductrule' },
  },
  integrate: {
    simple: { method: 'intsimple' },
    byParts: { method: 'intbyparts' },
    splitSum: { method: 'intsplitsum' },
    combineSum: { method: 'intcombinesum' },
    constOut: { method: 'intconstout' },
    constIn: { method: 'intconstin' },
    splitLimits: { method: 'intsplitlimits', fieldAs: 'input' },
    swapLimits: { method: 'intswaplimits' },
  },
  applyInverse: { method: 'applyinverse' },
  trigIdentity: {
    angleSum: { method: 'trig2angleidentity' },
    double: { method: 'trigdoubleangleidentity' },
    triple: { method: 'trigtripleangleidentity' },
    nAngle: { method: 'trignangleidentity' },
    powerReduction: { method: 'trigpowerreductionidentity' },
    productToSum: { method: 'trigprod2sumidentity' },
    tanToSinCos: { method: 'tan2sincos' },
    sinCosToTan: { method: 'sincos2tan' },
    sec2ToTan: { method: 'trig1oncos2oneaddtan2' },
    tanToSec2: { method: 'trig1addtan22oneoncos' },
    odd: { method: 'negbeforeafterfunc' },
    even: { method: 'negchangeinfunc' },
    pythagorean: { method: 'applypythagoreanidentity' },
    oneMinusCos: { method: 'oneminuscos2tosin2' },
    oneMinusSin: { method: 'oneminussin2tocos2' },
    sinSq: { method: 'sin2to1minuscos2' },
    cosSq: { method: 'cos2to1minussin2' },
    asinBcos: { method: 'sincos2cos' },
    weierstrassSin: { method: 'sin2tan' },
    weierstrassCos: { method: 'cos2tan' },
    eulerSin: { method: 'sin2ei' },
    eulerCos: { method: 'cos2ei' },
    eulerTan: { method: 'tan2ei' },
    eulerArcsin: { method: 'arcsin2ei' },
    eulerArccos: { method: 'arccos2ei' },
    eulerArctan: { method: 'arctan2ei' },
  },
  logRewrite: {
    powerOut: { method: 'logpower2coefficient' },
    coeffIn: { method: 'logcoefficient2power' },
    combine: { method: 'logsum2prod' },
    split: { method: 'logprod2sum' },
    complex: { method: 'log2logabsarg' },
  },
  expRewrite: {
    sumToProduct: { method: 'expsum2prod' },
    baseE: { method: 'makebasee' },
    base10: { method: 'makebase10' },
  },
  complex: {
    sinArg: { method: 'sinarg2imagabs' },
    cosArg: { method: 'cosarg2realabs' },
    tanArg: { method: 'tanarg2imagreal' },
    real: { method: 'real2def' },
    imag: { method: 'imag2def' },
    absToConj: { method: 'abs2conjdef' },
    conjToAbs: { method: 'conj2absdef' },
    argTrig: { method: 'evalargtrig' },
    argLog: { method: 'evalarglog' },
    conj: { method: 'evalconj' },
    polarToCart: { method: 'polari2cartesian' },
    cartToPolar: { method: 'cartesiani2polar' },
    simplifyI: { method: 'simplifyipow' },
  },
  evaluate: {
    exact: { method: 'eval2exact' },
    principal: { method: 'allsolintermsofprincipal' },
    decimal: { method: 'evaltodecimal' },
  },
  convert: {
    factors: { method: 'factorsofint' },
    fraction: { method: 'dec2frac' },
    decimal: { method: 'frac2dec' },
  },
};

function resolveDispatch(kind, mode) {
  const entry = OP_DISPATCH[kind];
  if (!entry) return null;
  if (entry.method) return entry;
  return entry[mode] || null;
}

export function applyRewrite(ast, kind, mode, field) {
  if (ast === '' || ast == null) {
    return { ast: '', flat: '', latex: '', error: 'No input expression' };
  }

  try {
    if (kind === 'applyBoth') {
      const rhsText = String(field || '').trim();
      let rhsAst = '0';
      if (mode !== 'sin' && mode !== 'cos' && mode !== 'ln' && FUNCTION_NAMES.indexOf(mode) < 0) {
        const parsed = parseField(rhsText || '1');
        if (parsed.error) return { ast: cloneAst(ast), flat: '', latex: '', error: parsed.error };
        rhsAst = parsed.ast;
      }
      const next = simplifyAst(applyBothSides(ast, mode, rhsAst));
      return formatResult(next);
    }

    if (kind === 'substitute') {
      const parsed = parseField(field);
      if (parsed.error) return { ast: cloneAst(ast), flat: '', latex: '', error: parsed.error || 'Enter a substitution such as a=b' };
      const eq = createHeadlessEquation(cloneAst(ast));
      eq.subsitute(parsed.ast);
      eq.sortanddraw();
      return formatResult(eq.equation);
    }

    if (kind === 'solve') {
      const variable = String(field || '').trim();
      if (!variable) return { ast: cloneAst(ast), flat: '', latex: '', error: 'Enter the variable to solve for' };
      const eq = createHeadlessEquation(cloneAst(ast));
      eq.solveui(variable);
      return formatResult(eq.equation);
    }

    const spec = resolveDispatch(kind, mode);
    if (!spec) {
      return { ast: cloneAst(ast), flat: '', latex: '', error: `Unknown operation ${kind}/${mode || ''}` };
    }

    const eq = createHeadlessEquation(cloneAst(ast));
    const target = eq.equation;
    const fieldText = String(field || '').trim();

    if (spec.method === 'factorsofint') {
      if (typeof target === 'string') {
        const num = Number(target);
        if (Number.isNaN(num) || num % 1 !== 0 || num < 4) {
          return { ast: cloneAst(ast), flat: '', latex: '', error: 'No integer ≥ 4 to factor' };
        }
        const holder = ['+', target];
        eq.equation = holder;
        runMethod(eq, spec.method, [holder, 1]);
        eq.equation = Array.isArray(eq.equation) && eq.equation[0] === '+' && eq.equation.length === 2
          ? eq.equation[1]
          : eq.equation;
        return formatResult(eq.equation);
      }
      const idx = findIntegerFactorIndex(target);
      if (idx == null) {
        return { ast: cloneAst(ast), flat: '', latex: '', error: 'No integer ≥ 4 to factor' };
      }
      runMethod(eq, spec.method, [target, idx]);
      return formatResult(eq.equation);
    }

    if (spec.method === 'dec2frac') {
      const idx = findDecimalIndex(target);
      if (idx == null) {
        return { ast: cloneAst(ast), flat: '', latex: '', error: 'No decimal number to convert' };
      }
      runMethod(eq, spec.method, ['e', target, idx]);
      return formatResult(eq.equation);
    }

    if (spec.method === 'mult1powpow') {
      const powers = eq.mult1powpow(target, true) || [];
      const pow = fieldText ? parseField(fieldText).ast : powers[0];
      if (pow == null || pow === '') {
        return { ast: cloneAst(ast), flat: '', latex: '', error: 'No power available for this form' };
      }
      runMethod(eq, spec.method, [target, undefined, pow]);
      return formatResult(eq.equation);
    }

    if (spec.fieldAs === 'menu') {
      let menuArg = fieldText;
      if (spec.method === 'collect' && fieldText) {
        const parsed = parseField(fieldText);
        if (parsed.error) return { ast: cloneAst(ast), flat: '', latex: '', error: parsed.error };
        menuArg = parsed.ast;
      }
      runMethod(eq, spec.method, [target, menuArg || undefined]);
      return formatResult(eq.equation);
    }

    if (spec.fieldAs === 'input') {
      withFakeInput(fieldText, () => {
        runMethod(eq, spec.method, [target]);
      });
      return formatResult(eq.equation);
    }

    runMethod(eq, spec.method, [target]);
    return formatResult(eq.equation);
  } catch (err) {
    return { ast: cloneAst(ast), flat: '', latex: '', error: err?.message || String(err) };
  }
}

export function astFromNumber(value) {
  const text = String(value ?? '').trim();
  if (!text) return { ast: '', flat: '', latex: '', error: 'Empty number' };
  return parseExpression(text);
}

function treeHas(node, pred) {
  if (pred(node)) return true;
  if (!Array.isArray(node)) return false;
  for (let i = 1; i < node.length; i++) {
    if (treeHas(node[i], pred)) return true;
  }
  return false;
}

function checkMethod(eq, method, node) {
  const fn = eq[method];
  if (typeof fn !== 'function') return false;
  try {
    const before = deepCopy(eq.equation);
    const result = fn.call(eq, node, true);
    eq.equation = before;
    if (typeof result === 'boolean') return result;
    if (Array.isArray(result)) return result.length > 0;
    if (result === false) return false;
    if (result == null) return false;
    return true;
  } catch {
    try {
      eq.equation = deepCopy(eq.equation);
    } catch {
      /* ignore */
    }
    return false;
  }
}

function structuralModeCheck(eq, kind, mode, node) {
  if (kind === 'expand' && mode === 'fraction') {
    return Array.isArray(node) && node[0] === '/' && Array.isArray(node[1]) && node[1][0] === '+';
  }
  if (kind === 'factor' && mode === 'polynomial') {
    return Array.isArray(node) && node[0] === '+' && typeof eq.factorpolynomialcheckif === 'function' && eq.factorpolynomialcheckif(node);
  }
  if (kind === 'powers' && mode === 'negative') return true;
  if (kind === 'multByOne') {
    if (mode === 'conjugate') {
      return Array.isArray(node) && node[0] === '/' && eq.countcond(node, (p, i) => p[i] === 'i') > 0;
    }
    if (mode === 'fracOverFrac') return checkMethod(eq, 'mult1fracoverfrac', node);
    if (mode === 'e2piik' || mode === 'negi2') return true;
    if (mode === 'powpow') return checkMethod(eq, 'mult1powpow', node);
  }
  if (kind === 'evaluate' && mode === 'decimal') {
    return treeHas(node, (n) => n === 'e' || n === 'π' || (typeof n === 'string' && n !== '' && !Number.isNaN(Number(n))));
  }
  if (kind === 'convert') {
    if (mode === 'factors') {
      if (typeof node === 'string') {
        const num = Number(node);
        return !Number.isNaN(num) && num % 1 === 0 && num >= 4;
      }
      return findIntegerFactorIndex(node) != null;
    }
    if (mode === 'fraction') return findDecimalIndex(node) != null;
    if (mode === 'decimal') {
      if (!Array.isArray(node) || node[0] !== '/') return false;
      const numeric = (part) =>
        typeof part === 'string' && part !== '' && !Number.isNaN(Number(part));
      return numeric(node[1]) && numeric(node[2]);
    }
  }
  if (kind === 'complex') {
    if (mode === 'simplifyI') {
      return treeHas(node, (n) => Array.isArray(n) && n[0] === '^' && n[1] === 'i');
    }
    if (mode === 'conj') return treeHas(node, (n) => Array.isArray(n) && n[0] === 'conj') || treeHas(node, (n) => n === 'i');
    if (mode === 'polarToCart' || mode === 'cartToPolar') return treeHas(node, (n) => n === 'i');
  }
  if (kind === 'collect') {
    return Array.isArray(node) && node[0] === '+';
  }
  if (kind === 'solve') {
    return Array.isArray(node) && node[0] === '=';
  }
  if (kind === 'applyBoth' || kind === 'substitute') return true;
  return null;
}

/** Whether a rewrite kind/mode can apply to this AST (whole expression selected). */
export function isOpApplicable(ast, kind, mode) {
  if (ast === '' || ast == null) return false;
  if (kind === 'number' || kind === 'expression' || kind === 'note') return false;

  const structural = structuralModeCheck(createHeadlessEquation(cloneAst(ast)), kind, mode, ast);
  if (structural === true) return true;
  if (structural === false) return false;

  const entry = OP_DISPATCH[kind];
  if (!entry) return kind === 'applyBoth' || kind === 'substitute' || kind === 'solve' || kind === 'collect';

  const spec = entry.method ? entry : entry[mode];
  if (!spec?.method) {
    return kind === 'applyBoth' || kind === 'substitute' || kind === 'solve' || kind === 'collect';
  }

  const eq = createHeadlessEquation(cloneAst(ast));
  const checked = checkMethod(eq, spec.method, eq.equation);
  if (checked) return true;

  // Methods without a reliable check mode: keep common always-useful ops visible.
  if (kind === 'applyBoth' || kind === 'substitute') return true;
  if (kind === 'solve') return Array.isArray(ast) && ast[0] === '=';
  if (kind === 'collect') return Array.isArray(ast) && ast[0] === '+';
  if (kind === 'trigIdentity' || kind === 'logRewrite' || kind === 'expRewrite' || kind === 'complex') {
    return false;
  }
  return false;
}

/**
 * List Math kinds/modes applicable to an AST (for the filtered add-node picker).
 * Returns { kinds: string[], modesByKind: Record<string, string[]> }.
 */
export function listApplicableOps(ast) {
  const kinds = [];
  const modesByKind = {};
  if (ast === '' || ast == null) {
    return { kinds, modesByKind };
  }

  const always = ['applyBoth', 'substitute'];
  always.forEach((kind) => {
    kinds.push(kind);
  });

  Object.keys(OP_DISPATCH).forEach((kind) => {
    const entry = OP_DISPATCH[kind];
    if (entry.method) {
      if (isOpApplicable(ast, kind, null)) {
        if (!kinds.includes(kind)) kinds.push(kind);
      }
      return;
    }
    const modes = Object.keys(entry).filter((mode) => isOpApplicable(ast, kind, mode));
    if (modes.length) {
      if (!kinds.includes(kind)) kinds.push(kind);
      modesByKind[kind] = modes;
    }
  });

  ['collect', 'solve'].forEach((kind) => {
    if (isOpApplicable(ast, kind, null) && !kinds.includes(kind)) kinds.push(kind);
  });

  return { kinds, modesByKind };
}

function walkPath(root, path = []) {
  let node = root;
  for (const index of path) {
    if (!Array.isArray(node) || node[index] === undefined) return null;
    node = node[index];
  }
  return node;
}

function nodeContainsRef(root, target) {
  if (root === target) return true;
  if (!Array.isArray(root)) return false;
  for (let i = 1; i < root.length; i++) {
    if (nodeContainsRef(root[i], target)) return true;
  }
  return false;
}

const PREVIEW_INK = '#a1a1aa';
const DEFAULT_GHOST_SELECTION_COLOR = '#6366f1';

function isBlackInk(value) {
  return (
    value === 'black' ||
    value === '#000' ||
    value === '#000000' ||
    value === 'rgb(0, 0, 0)' ||
    value === 'rgba(0, 0, 0, 1)'
  );
}

function isSelectionInk(value) {
  if (!value || typeof value !== 'string') return false;
  const v = value.toLowerCase();
  return (
    v === 'red' ||
    v === '#f00' ||
    v === '#ff0000' ||
    v === 'rgb(255, 0, 0)' ||
    v === 'blue' ||
    v === '#00f' ||
    v === '#0000ff' ||
    v === 'rgb(0, 0, 255)'
  );
}

function installPreviewInk(canvas, ink = PREVIEW_INK) {
  if (!canvas || canvas._nmInkMapped) return;
  canvas._nmInkMapped = true;
  const nativeGet = canvas.getContext.bind(canvas);
  const fillDesc = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'fillStyle');
  const strokeDesc = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'strokeStyle');
  canvas.getContext = function getContextMapped(type, attrs) {
    const ctx = nativeGet(type, attrs);
    if (type === '2d' && fillDesc?.set && !ctx._nmInk) {
      ctx._nmInk = true;
      Object.defineProperty(ctx, 'fillStyle', {
        configurable: true,
        get() {
          return fillDesc.get.call(this);
        },
        set(v) {
          if (isBlackInk(v)) {
            fillDesc.set.call(this, ink);
            return;
          }
          if (canvas._nmGhostColor && isSelectionInk(v)) {
            fillDesc.set.call(this, canvas._nmGhostColor);
            return;
          }
          fillDesc.set.call(this, v);
        },
      });
      if (strokeDesc?.set) {
        Object.defineProperty(ctx, 'strokeStyle', {
          configurable: true,
          get() {
            return strokeDesc.get.call(this);
          },
          set(v) {
            strokeDesc.set.call(this, !v || isBlackInk(v) ? ink : v);
          },
        });
      }
      ctx.fillStyle = ink;
      ctx.strokeStyle = ink;
    }
    return ctx;
  };
}

/** Live equation bound to a canvas for selectable grey previews. */
export function createPreviewEquation(ast, canvasId) {
  const eq = new equation();
  eq.history = undefined;
  eq.headless = false;
  eq.canvasid = canvasId;
  eq.inputid = '';
  eq.fontsize = 22 * ((typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  equation.fontname = 'Georgia, "Times New Roman", serif';
  eq.equation = ast === undefined || ast === '' ? '' : cloneAst(ast);
  return eq;
}

function ensureSelectedFlags(value) {
  const n = Math.max(value?.char?.length || 0, value?.x?.length || 0);
  if (!Array.isArray(value.selected) || value.selected.length !== n) {
    value.selected = Array(n).fill(false);
  }
  return value.selected;
}

/** Measure + paint without simplifying (eval already simplified the AST). */
export function layoutSelectablePreview(eq) {
  const canvas = typeof document !== 'undefined' ? document.getElementById(eq.canvasid) : null;
  if (!canvas) return { width: 0, height: 0 };
  installPreviewInk(canvas);
  canvas._nmGhostColor = '';
  eq.nodeproperties = new Map();
  if (eq.equation === '' || eq.equation == null) {
    canvas.width = 1;
    canvas.height = 1;
    canvas.style.width = '0px';
    canvas.style.height = '0px';
    return { width: 0, height: 0 };
  }
  if (Array.isArray(eq.equation)) {
    eq.printimage(eq.equation);
    eq.nodeproperties.forEach((value) => {
      ensureSelectedFlags(value);
      value.selected.fill(false);
    });
  }
  eq.draw(eq.equation);
  const width = Math.ceil(canvas.offsetWidth || parseFloat(canvas.style.width) || 0);
  const height = Math.ceil(canvas.offsetHeight || parseFloat(canvas.style.height) || 0);
  return { width, height };
}

/** Hit-test like original detectevents (vars + function names). */
export function selectPreviewAt(eq, canvas, clientX, clientY, additive, localX, localY) {
  if (!eq || !canvas) return;
  let cssX;
  let cssY;
  if (Number.isFinite(localX) && Number.isFinite(localY)) {
    cssX = localX;
    cssY = localY;
  } else {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    cssX = ((clientX - rect.left) / rect.width) * (canvas.offsetWidth || rect.width);
    cssY = ((clientY - rect.top) / rect.height) * (canvas.offsetHeight || rect.height);
  }
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  const x = cssX * dpr - eq.borderwidth;
  const y = cssY * dpr - eq.borderwidth;
  eq.nodeproperties.forEach((value) => {
    const selected = ensureSelectedFlags(value);
    for (let i = 0; i < value.x.length; i++) {
      if (!(value.isvar[i] || value.isfunc[i])) continue;
      const hit =
        x > value.x[i] && x < value.x[i] + value.w[i] && y > value.y[i] && y < value.y[i] + value.h[i];
      if (additive) {
        if (hit) selected[i] = true;
      } else {
        selected[i] = hit;
      }
    }
  });
  eq.draw(eq.equation);
}

/** Select every selectable glyph (for double-click / whole-expression ops). */
export function selectAllPreview(eq) {
  if (!eq) return;
  eq.nodeproperties.forEach((value) => {
    const selected = ensureSelectedFlags(value);
    for (let i = 0; i < value.x.length; i++) {
      selected[i] = !!(value.isvar[i] || value.isfunc[i]);
    }
  });
  if (eq.equation !== '' && eq.equation != null) eq.draw(eq.equation);
}

/** Clear red/blue selection highlight after an op is applied or the menu is cancelled. */
export function clearPreviewSelection(eq) {
  if (!eq?.nodeproperties) return;
  eq.nodeproperties.forEach((value) => {
    const selected = ensureSelectedFlags(value);
    selected.fill(false);
  });
  const canvas = typeof document !== 'undefined' ? document.getElementById(eq.canvasid) : null;
  if (canvas) canvas._nmGhostColor = '';
  if (eq.equation !== '' && eq.equation != null && eq.canvasid) {
    try {
      eq.draw(eq.equation);
    } catch {
      /* ignore */
    }
  }
}

/** Mark every glyph under an AST node as selected (no simplify/redraw side effects). */
function selectSubtreeGlyphs(eq, node) {
  if (!eq?.nodeproperties || !Array.isArray(node)) return;
  const queue = [node];
  while (queue.length) {
    const cn = queue.shift();
    const prop = eq.nodeproperties.get(cn);
    if (prop) {
      const selected = ensureSelectedFlags(prop);
      selected.fill(true);
    }
    for (let i = 1; i < cn.length; i++) {
      if (Array.isArray(cn[i])) queue.push(cn[i]);
    }
  }
}

/** Select leaf variable glyphs on a node that match `atom`. */
function selectLeafAtom(eq, parentNode, atom) {
  const prop = eq.nodeproperties.get(parentNode);
  if (!prop || atom == null) return;
  const selected = ensureSelectedFlags(prop);
  const text = String(atom);
  const parts = text.split('_');
  for (let i = 0; i < prop.char.length; i++) {
    if (!prop.isvar[i]) continue;
    if (parts.length > 1) {
      if (prop.char[i] === parts[0] && prop.char[i + 1] === parts[1]) {
        selected[i] = true;
        if (i + 1 < selected.length) selected[i + 1] = true;
        return;
      }
    } else if (prop.char[i] === text) {
      selected[i] = true;
      return;
    }
  }
}

/**
 * Paint a read-only highlight for a stored selection (`path` + `issel`) on an
 * already-laid-out preview equation. Color defaults to the node outline tint
 * (`selection.color`) so the ghost matches the selected operation chain.
 */
export function applyVisualSelection(eq, selection) {
  if (!eq?.nodeproperties || eq.equation === '' || eq.equation == null) return false;

  eq.nodeproperties.forEach((value) => {
    ensureSelectedFlags(value).fill(false);
  });

  const path = Array.isArray(selection?.path) ? selection.path : [];
  const target = walkPath(eq.equation, path) ?? eq.equation;
  const issel = Array.isArray(selection?.issel) ? selection.issel : null;
  const ghostColor =
    typeof selection?.color === 'string' && selection.color
      ? selection.color
      : DEFAULT_GHOST_SELECTION_COLOR;

  if (!issel || !Array.isArray(target)) {
    if (Array.isArray(target)) selectSubtreeGlyphs(eq, target);
    else if (Array.isArray(eq.equation)) selectSubtreeGlyphs(eq, eq.equation);
  } else {
    const prop = eq.nodeproperties.get(target);
    if (prop && issel[0]) {
      const selected = ensureSelectedFlags(prop);
      for (let i = 0; i < selected.length; i++) {
        if (prop.isfunc[i] || prop.isop[i]) selected[i] = true;
      }
    }
    for (let i = 1; i < target.length; i++) {
      if (!issel[i]) continue;
      if (Array.isArray(target[i])) selectSubtreeGlyphs(eq, target[i]);
      else selectLeafAtom(eq, target, target[i]);
    }
  }

  const canvas = typeof document !== 'undefined' ? document.getElementById(eq.canvasid) : null;
  if (canvas) canvas._nmGhostColor = ghostColor;

  try {
    eq.draw(eq.equation);
    return true;
  } catch {
    if (canvas) canvas._nmGhostColor = '';
    return false;
  }
}

/**
 * Apply a selection-scoped CAS method (from the original op menu) to an AST.
 * `selection` is { path: number[], issel: boolean[] } from resolveSelection.
 */
export function applySelectionOp(ast, method, selection, field) {
  if (ast === '' || ast == null) {
    return { ast: '', flat: '', latex: '', error: 'No input expression' };
  }
  if (!method) {
    return { ast: cloneAst(ast), flat: '', latex: '', error: 'No operation selected' };
  }

  const canvasId = `cas-apply-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  let canvas = null;
  let menu = null;

  try {
    canvas = document.createElement('canvas');
    canvas.id = canvasId;
    canvas.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;pointer-events:none;';
    document.body.appendChild(canvas);

    menu = document.createElement('div');
    menu.id = 'opmenu';
    menu.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
    document.body.appendChild(menu);

    const eq = createPreviewEquation(ast, canvasId);
    if (Array.isArray(eq.equation)) {
      try {
        eq.printimage(eq.equation);
      } catch {
        /* some leaves have no glyph layout */
      }
    }

    const path = selection?.path || [];
    const issel = Array.isArray(selection?.issel) ? selection.issel : null;
    const target = walkPath(eq.equation, path) ?? eq.equation;

    if (issel) {
      eq.isselected = function selectedForOp(node) {
        if (node === target) return issel.slice();
        if (Array.isArray(node) && nodeContainsRef(node, target)) {
          const flags = new Array(node.length).fill(false);
          for (let i = 1; i < node.length; i++) {
            if (nodeContainsRef(node[i], target) || node[i] === target) flags[i] = true;
          }
          if (flags.some(Boolean)) flags[0] = true;
          return flags;
        }
        if (!Array.isArray(node)) return [false];
        return new Array(node.length).fill(false);
      };
      eq.countselected = function countForOp(node) {
        if (node === target) return Math.max(1, issel.filter(Boolean).length);
        if (Array.isArray(node) && nodeContainsRef(node, target)) {
          return Math.max(1, issel.filter(Boolean).length);
        }
        return 0;
      };
    }

    const callStyle = selection?.callStyle || (method === 'solveui' ? 'solve' : 'node');
    const extraArg = selection?.arg;
    const fieldText = field != null && field !== '' ? field : selection?.field;

    if (callStyle === 'solve') {
      runMethod(eq, method, [extraArg ?? fieldText, menu]);
    } else if (method === 'collect' || method === 'polynomialdivision' || method === 'partialfractions') {
      let menuArg = fieldText;
      if (method === 'collect' && fieldText) {
        const parsed = parseField(fieldText);
        if (parsed.error) return { ast: cloneAst(ast), flat: '', latex: '', error: parsed.error };
        menuArg = parsed.ast;
      }
      runMethod(eq, method, [target, menuArg || undefined]);
    } else if (method === 'mult1powpow') {
      runMethod(eq, method, [target, menu, extraArg]);
    } else if (method === 'intsplitlimits') {
      withFakeInput(fieldText || '0', () => {
        runMethod(eq, method, [target, menu]);
      });
    } else if (method === 'factorsofint') {
      runMethod(eq, method, [target, extraArg, menu]);
    } else if (method === 'dec2frac') {
      runMethod(eq, method, ['e', target, extraArg, menu]);
    } else {
      runMethod(eq, method, [target, menu]);
    }

    return formatResult(eq.equation);
  } catch (err) {
    return { ast: cloneAst(ast), flat: '', latex: '', error: err?.message || String(err) };
  } finally {
    try {
      menu?.remove();
    } catch {
      /* ignore */
    }
    try {
      canvas?.remove();
    } catch {
      /* ignore */
    }
  }
}

export { printflat, printlatex, deepCopy, simplifyAst, OP_DISPATCH, equation };
