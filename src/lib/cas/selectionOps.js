/**
 * Build selection-scoped CAS operations using the same predicates as
 * equation.detectevents() / #opmenu in the original Algebra Backend.
 */
import { createPreviewEquation, deepCopy, printflat, selectAllPreview } from './engine.js';

/** Equation-level selection-menu methods (Solve). Everything else is Manipulation. */
export function isEquationSelectionMethod(method) {
  return method === 'solveui';
}

export function flattenSelectionOps(ops = []) {
  const out = [];
  for (const op of ops) {
    if (op?.submenu?.length) {
      for (const child of op.submenu) {
        if (child?.method) out.push(child);
      }
    } else if (op?.method) {
      out.push(op);
    }
  }
  return out;
}

export function selectionOpKey(opOrNode) {
  if (!opOrNode) return '';
  const method = opOrNode.method || '';
  if (!method) return '';
  const arg = opOrNode.extra?.arg ?? opOrNode.selection?.arg;
  const callStyle = opOrNode.extra?.callStyle ?? opOrNode.selection?.callStyle;
  const id = opOrNode.id || opOrNode.opId || '';
  if (id) return id;
  return `${method}:${arg != null ? JSON.stringify(arg) : ''}:${callStyle || ''}`;
}

const NON_VARIABLE_ATOMS = new Set(['π', 'i', 'e', 'true', 'false']);

/** Collect free variable names from an AST (skips function heads and constants). */
export function collectVariables(ast, out = new Set()) {
  if (typeof ast === 'string') {
    if (ast && Number.isNaN(Number(ast)) && !NON_VARIABLE_ATOMS.has(ast)) out.add(ast);
    return out;
  }
  if (!Array.isArray(ast)) return out;
  for (let i = 1; i < ast.length; i++) collectVariables(ast[i], out);
  return out;
}

/** Equation-operation choices for an upstream AST (Solve for each variable). */
export function listEquationOpsForAst(ast) {
  if (ast === '' || ast == null) return [];
  return [...collectVariables(ast)].sort().map((v) => ({
    id: `solveui:Solve equation for ${v}`,
    label: `Solve equation for ${v}`,
    method: 'solveui',
    extra: { arg: v, callStyle: 'solve' },
    selection: {
      path: [],
      issel: null,
      arg: v,
      callStyle: 'solve',
    },
  }));
}

/**
 * List selection-menu ops applicable to an AST (whole-expression selection).
 * `category`: 'manipulation' | 'equation' | 'all'
 */
export function listApplicableOpsForAst(ast, category = 'manipulation') {
  if (ast === '' || ast == null) return [];

  if (category === 'equation') {
    return listEquationOpsForAst(ast);
  }

  const canvasId = `cas-ops-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  let canvas = null;
  try {
    canvas = document.createElement('canvas');
    canvas.id = canvasId;
    canvas.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;pointer-events:none;';
    document.body.appendChild(canvas);

    const eq = createPreviewEquation(ast, canvasId);
    if (Array.isArray(eq.equation)) {
      try {
        eq.printimage(eq.equation);
      } catch {
        /* some leaves have no glyph layout */
      }
    }
    selectAllPreview(eq);
    const resolved = resolveSelection(eq);
    if (!resolved) return category === 'all' ? listEquationOpsForAst(ast) : [];

    const ops = flattenSelectionOps(listSelectionOps(eq, { printflat }));
    const baseSelection = {
      path: resolved.path || [],
      issel: resolved.issel || null,
    };

    const manipulation = ops
      .filter((op) => !isEquationSelectionMethod(op.method))
      .map((op) => ({
        ...op,
        selection: {
          ...baseSelection,
          ...(op.extra || {}),
        },
      }));

    if (category === 'all') {
      return [...manipulation, ...listEquationOpsForAst(ast)];
    }
    return manipulation;
  } catch {
    return [];
  } finally {
    try {
      canvas?.remove();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Whether a stored selection-scoped operation still applies to `ast`.
 * Used when an upstream equation changes after the op node was created.
 */
export function isSelectionOpApplicable(ast, method, selection = null, field = '') {
  if (ast === '' || ast == null || !method) return false;

  if (isEquationSelectionMethod(method)) {
    const variable = selection?.arg ?? field;
    if (variable == null || variable === '') return false;
    return collectVariables(ast).has(String(variable));
  }

  const canvasId = `cas-applicable-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  let canvas = null;
  try {
    canvas = document.createElement('canvas');
    canvas.id = canvasId;
    canvas.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;pointer-events:none;';
    document.body.appendChild(canvas);

    const eq = createPreviewEquation(ast, canvasId);
    if (Array.isArray(eq.equation)) {
      try {
        eq.printimage(eq.equation);
      } catch {
        /* some leaves have no glyph layout */
      }
    }

    let path = Array.isArray(selection?.path) ? selection.path : [];
    let issel = Array.isArray(selection?.issel) ? selection.issel : null;

    if (path.length && walkAstPath(eq.equation, path) == null) {
      return false;
    }

    // Dropdown-picked / whole-expression ops may omit issel — fall back to select-all.
    if (!issel) {
      selectAllPreview(eq);
      const resolved = resolveSelection(eq);
      if (!resolved) return false;
      path = resolved.path || [];
      issel = resolved.issel || null;
    }

    return checkMethod(eq, method, path, issel);
  } catch {
    return false;
  } finally {
    try {
      canvas?.remove();
    } catch {
      /* ignore */
    }
  }
}

/** Soft status when a Manipulation / Equation op no longer matches its input. */
export const OPERATION_IGNORED_ERROR = 'Operation not applicable';

export const OPERATION_IGNORED_MESSAGE =
  'Operation not applicable. This node is ignored until applicable.';

function plainLabel(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function push(ops, labelHtml, method, extra = null) {
  const label = plainLabel(labelHtml);
  if (!label || label.toLowerCase() === 'copy' || label.toLowerCase() === 'back') return;
  ops.push({
    id: `${method}:${label}`,
    label,
    method,
    extra,
  });
}

function nodeContainsRef(root, target) {
  if (root === target) return true;
  if (!Array.isArray(root)) return false;
  for (let i = 1; i < root.length; i++) {
    if (nodeContainsRef(root[i], target)) return true;
  }
  return false;
}

function walkAstPath(root, path = []) {
  let node = root;
  for (const index of path) {
    if (!Array.isArray(node) || node[index] === undefined) return null;
    node = node[index];
  }
  return node;
}

/** Run a CAS check-mode call on a scratch equation so the live preview is never mutated. */
function checkMethod(liveEq, method, path, issel) {
  if (typeof liveEq[method] !== 'function') return false;
  try {
    const scratch = createPreviewEquation(deepCopy(liveEq.equation), '');
    scratch.draw = function noopDraw() {};
    scratch.sortanddraw = function sortHeadless() {
      this.changedgraph = true;
      for (let i = 0; i < 100; i++) {
        this.changedgraph = false;
        this.simplifygraph(this.equation);
        this.rem01(this.equation);
        this.ordergraph(this.equation);
        if (!this.changedgraph) break;
      }
    };
    const target = walkAstPath(scratch.equation, path) ?? scratch.equation;
    if (Array.isArray(issel)) {
      scratch.isselected = function selectedForCheck(node) {
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
      scratch.countselected = function countForCheck(node) {
        if (node === target) return Math.max(1, issel.filter(Boolean).length);
        if (Array.isArray(node) && nodeContainsRef(node, target)) {
          return Math.max(1, issel.filter(Boolean).length);
        }
        return 0;
      };
    }
    const result = scratch[method](target, true);
    if (typeof result === 'boolean') return result;
    if (Array.isArray(result)) return result.length > 0;
    if (result === false || result == null) return false;
    return true;
  } catch {
    return false;
  }
}

function methodResult(liveEq, method, path, issel) {
  if (typeof liveEq[method] !== 'function') return null;
  try {
    const scratch = createPreviewEquation(deepCopy(liveEq.equation), '');
    scratch.draw = function noopDraw() {};
    scratch.sortanddraw = function sortHeadless() {
      this.changedgraph = true;
      for (let i = 0; i < 100; i++) {
        this.changedgraph = false;
        this.simplifygraph(this.equation);
        this.rem01(this.equation);
        this.ordergraph(this.equation);
        if (!this.changedgraph) break;
      }
    };
    const target = walkAstPath(scratch.equation, path) ?? scratch.equation;
    if (Array.isArray(issel)) {
      scratch.isselected = function selectedForCheck(node) {
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
    }
    return scratch[method](target, true);
  } catch {
    return null;
  }
}

/** Deepest selected AST node + path/issel (mirrors detectevents resolution). */
export function resolveSelection(eq) {
  if (!eq || eq.equation === '' || eq.equation == null) return null;
  let node = eq.equation;
  const path = [];
  const numsel = eq.countselected(node);
  if (!numsel) return null;

  for (let i = 1; i < node.length; ) {
    if (Array.isArray(node[i]) && eq.countselected(node[i]) === numsel) {
      path.push(i);
      node = node[i];
      i = 1;
    } else {
      i += 1;
    }
  }

  return {
    node,
    path,
    issel: eq.isselected(node),
    numsel,
    parent: typeof eq.getparent === 'function' ? eq.getparent(node) : undefined,
  };
}

/**
 * List ops available for the current character selection on `eq`
 * (must already have nodeproperties + selected flags from printimage/draw).
 */
export function listSelectionOps(eq, helpers = {}) {
  const { printflat } = helpers;
  const resolved = resolveSelection(eq);
  if (!resolved) return [];

  const { node, path, issel, numsel } = resolved;
  const THIS = eq;
  const ops = [];
  const can = (method) => checkMethod(THIS, method, path, issel);

  // Complex / arg identities (structure on resolved node)
  if (Array.isArray(node) && node[0] === 'sin' && Array.isArray(node[1]) && node[1][0] === 'arg') {
    push(ops, 'Apply identity: sin(arg(z))=imag(z)/abs(z)', 'sinarg2imagabs');
  }
  if (Array.isArray(node) && node[0] === 'cos' && Array.isArray(node[1]) && node[1][0] === 'arg') {
    push(ops, 'Apply identity: cos(arg(z))=real(z)/abs(z)', 'cosarg2realabs');
  }
  if (Array.isArray(node) && node[0] === 'tan' && Array.isArray(node[1]) && node[1][0] === 'arg') {
    push(ops, 'Apply identity: tan(arg(z))=imag(z)/real(z)', 'tanarg2imagreal');
  }
  if (Array.isArray(node) && node[0] === 'real') push(ops, 'Evaluate real(z)=(conj(z)+z)/2', 'real2def');
  if (Array.isArray(node) && node[0] === 'imag') push(ops, 'Evaluate imag(z)=i*(conj(z)-z)/2', 'imag2def');
  if (Array.isArray(node) && node[0] === 'abs') push(ops, 'Apply identity: abs(x)=(x*conj(x))^(1/2)', 'abs2conjdef');
  if (Array.isArray(node) && node[0] === 'arg') {
    push(ops, 'Evaluate complex argument using trigonometric definition', 'evalargtrig');
    push(ops, 'Evaluate complex argument using logarithmic definition', 'evalarglog');
  }
  if (Array.isArray(node) && node[0] === 'conj') push(ops, 'Evaluate complex conjugate', 'evalconj');

  if (can('powpow2mult')) {
    push(ops, 'Evaluate power to power by multiplying the powers', 'powpow2mult');
  }
  if (
    Array.isArray(node) &&
    node[0] === '^' &&
    Array.isArray(node[2]) &&
    ((node[2][0] === '*' && THIS.isselected(node[2]).some((el) => el) && THIS.isselected(node[2]).some((el) => !el)) ||
      (node[2][0] === '/' && THIS.isselected(node[2]).some((el) => el))) &&
    node[2][1] !== '1'
  ) {
    push(ops, 'Product of powers to power raised to power (selected to power)', 'powmult2powpow');
  }

  // Calculus
  if (Array.isArray(node) && node[0] === 'diff') {
    push(ops, 'Calculate derivative', 'calcdiff');
    if (Array.isArray(node[1]) && node[1][0] === 'diff') {
      push(ops, 'Swap the order of differentiation', 'diffswaporder');
    }
  }
  if (Array.isArray(node) && node[0] === '+' && can('diffcombineproductrule')) {
    push(ops, 'Collect terms of product rule.', 'diffcombineproductrule');
  }
  if (can('intsplitlimits')) {
    push(ops, 'Split the limits of the integral.', 'intsplitlimits', { needsField: true, fieldPlaceholder: '0' });
  }
  if (Array.isArray(node) && node[0] === 'int') {
    push(ops, 'Calculate simple integral', 'intsimple');
    push(ops, 'Integrate by parts ∫udv=uv-∫vdu where u is highlighted.', 'intbyparts');
  }
  if (
    Array.isArray(node) &&
    node[0] === 'int' &&
    Array.isArray(node[1]) &&
    node[1][0] === '+' &&
    !THIS.isselected(node[1]).slice(1).every((x, _i, a) => a[0] === x)
  ) {
    push(ops, 'Split an integral of a sum into a sum of two integrals.', 'intsplitsum');
  }
  if (can('intcombinesum')) push(ops, 'Combine a sum of integrals into one integral.', 'intcombinesum');
  if (can('intconstout')) push(ops, 'Move constants out of integral.', 'intconstout');
  if (can('intconstin')) push(ops, 'Move constants into integral.', 'intconstin');
  if (can('intswaplimits')) push(ops, 'Swap the limits of the integral.', 'intswaplimits');

  // Apply inverse (same structural check as original)
  if (
    (node[0] === 'sin' && Array.isArray(node[1]) && (node[1][0] === 'arcsin' || node[1][0] === 'arccos' || node[1][0] === 'arctan')) ||
    (node[0] === 'cos' && Array.isArray(node[1]) && (node[1][0] === 'arcsin' || node[1][0] === 'arccos' || node[1][0] === 'arctan')) ||
    (node[0] === 'tan' && Array.isArray(node[1]) && (node[1][0] === 'arcsin' || node[1][0] === 'arccos' || node[1][0] === 'arctan')) ||
    (node[0] === 'arcsin' && Array.isArray(node[1]) && node[1][0] === 'sin') ||
    (node[0] === 'arccos' && Array.isArray(node[1]) && node[1][0] === 'cos') ||
    (node[0] === 'arctan' && Array.isArray(node[1]) && node[1][0] === 'tan') ||
    (node[0] === '^' && node[1] === 'e' && Array.isArray(node[2]) && node[2][0] === 'ln') ||
    (node[0] === 'ln' && Array.isArray(node[1]) && node[1][0] === '^' && node[1][1] === 'e') ||
    (node[0] === '^' && node[1] === '10' && Array.isArray(node[2]) && node[2][0] === 'log') ||
    (node[0] === 'log' && Array.isArray(node[1]) && node[1][0] === '^' && node[1][1] === '10') ||
    (node[0] === 'diff' && Array.isArray(node[1]) && node[1][0] === 'int' && node[1].length === 3 && node[1][2] === node[2])
  ) {
    push(ops, 'Apply inverse', 'applyinverse');
  }

  // Trig identities (function head)
  if ((node[0] === 'sin' || node[0] === 'cos' || node[0] === 'tan') && Array.isArray(node[1]) && node[1].length >= 3 && node[1][0] === '+') {
    push(ops, 'Apply angle-sum trigonometric identity', 'trig2angleidentity');
  }
  if (
    (node[0] === 'sin' || node[0] === 'cos' || node[0] === 'tan') &&
    Array.isArray(node[1]) &&
    node[1].length >= 3 &&
    node[1][0] === '*' &&
    node[1].includes('2')
  ) {
    push(ops, 'Apply double-angle trigonometric identity', 'trigdoubleangleidentity');
  }
  if (
    (node[0] === 'sin' || node[0] === 'cos' || node[0] === 'tan') &&
    Array.isArray(node[1]) &&
    node[1].length >= 3 &&
    node[1][0] === '*' &&
    node[1].includes('3')
  ) {
    push(ops, 'Apply triple-angle trigonometric identity', 'trigtripleangleidentity');
  }
  if (can('trignangleidentity')) push(ops, 'Apply multiple angle identity', 'trignangleidentity');
  if (can('trigpowerreductionidentity')) {
    push(ops, 'Apply trigonometric power reduction identity', 'trigpowerreductionidentity');
  }
  if (can('trigprod2sumidentity')) {
    push(ops, 'Apply product to sum trigonometric identity', 'trigprod2sumidentity');
  }
  if (Array.isArray(node) && node[0] === 'tan') push(ops, 'Apply identity: tan(x)=sin(x)/cos(x)', 'tan2sincos');
  if (can('sincos2tan')) push(ops, 'Apply identity: sin(x)/cos(x)=tan(x)', 'sincos2tan');
  if (can('trig1oncos2oneaddtan2')) push(ops, 'Apply identity: 1/cos(x)^2=1+tan(x)^2', 'trig1oncos2oneaddtan2');
  if (can('trig1addtan22oneoncos')) push(ops, 'Apply identity: 1+tan(x)^2=1/cos(x)^2', 'trig1addtan22oneoncos');
  if (can('applypythagoreanidentity')) push(ops, 'Apply Pythagorean identity', 'applypythagoreanidentity');
  if (can('oneminuscos2tosin2')) push(ops, 'Apply 1-cos(x)^2=sin(x)^2', 'oneminuscos2tosin2');
  if (can('oneminussin2tocos2')) push(ops, 'Apply 1-sin(x)^2=cos(x)^2', 'oneminussin2tocos2');
  if (can('sin2to1minuscos2')) push(ops, 'Apply sin(x)^2=1-cos(x)^2', 'sin2to1minuscos2');
  if (can('cos2to1minussin2')) push(ops, 'Apply cos(x)^2=1-sin(x)^2', 'cos2to1minussin2');
  if (can('sincos2cos')) push(ops, 'Apply identity: Asin(x)+Bcos(x)', 'sincos2cos');
  if (Array.isArray(node) && node[0] === 'sin') {
    push(ops, 'Apply identity: sin(x)=2tan(x/2)/(1+tan(x/2)^2)', 'sin2tan');
    push(ops, 'Apply identity: sin(x)=(e^(ix)-e^(-ix))/(2i)', 'sin2ei');
  }
  if (Array.isArray(node) && node[0] === 'cos') {
    push(ops, 'Apply identity: cos(x)=(1-tan(x/2)^2)/(1+tan(x/2)^2)', 'cos2tan');
    push(ops, 'Apply identity: cos(x)=(e^(ix)+e^(-ix))/2', 'cos2ei');
  }
  if (Array.isArray(node) && node[0] === 'tan') {
    push(ops, 'Apply identity: tan(x)=i(e^(-ix)-e^(ix))/(e^(ix)+e^(-ix))', 'tan2ei');
  }
  if (Array.isArray(node) && node[0] === 'arcsin') push(ops, 'Apply identity: arcsin(x)=-iln(...)', 'arcsin2ei');
  if (Array.isArray(node) && node[0] === 'arccos') push(ops, 'Apply identity: arccos(x)=-iln(...)', 'arccos2ei');
  if (Array.isArray(node) && node[0] === 'arctan') push(ops, 'Apply identity: arctan(x)=ln(...)/(2i)', 'arctan2ei');

  // Log / exp
  if (can('logpower2coefficient')) push(ops, 'Move the power out of the log', 'logpower2coefficient');
  if (can('logcoefficient2power')) push(ops, 'Move coefficient(s) into log function', 'logcoefficient2power');
  if (can('logsum2prod')) push(ops, 'Combine logs', 'logsum2prod');
  if (can('logprod2sum')) push(ops, 'Convert to sum of logs', 'logprod2sum');
  if (can('log2logabsarg')) push(ops, 'Evaluate complex logarithm', 'log2logabsarg');
  if (can('expsum2prod')) push(ops, 'Convert sum in power to product of exponentials', 'expsum2prod');

  // Algebra core (selection-sensitive)
  if (can('combineliketermsrecursive')) push(ops, 'Combine like terms', 'combineliketermsrecursive');
  if (
    Array.isArray(node) &&
    typeof THIS.countcond === 'function' &&
    THIS.countcond(node, (p, i) => Array.isArray(p) && p[0] === '^' && p[1] === 'i' && !isNaN(p[2]) && Number(p[2]) % 1 === 0)
  ) {
    push(ops, 'Simplify powers of i', 'simplifyipow');
  }
  if (can('expand')) push(ops, 'Expand', 'expand');
  if (Array.isArray(node) && node[0] === '/' && Array.isArray(node[1]) && node[1][0] === '+') {
    push(ops, 'Expand Fraction', 'expandfraction');
  }
  if (can('expandfactorneg1')) push(ops, 'Expand or factor -1', 'expandfactorneg1');
  if (can('factorcompletesquare')) push(ops, 'Factor by completing the square', 'factorcompletesquare');
  if (can('factor')) push(ops, 'Factor', 'factor');
  if (
    Array.isArray(node) &&
    node[0] === '+' &&
    numsel > 1 &&
    typeof THIS.factorpolynomialcheckif === 'function' &&
    THIS.factorpolynomialcheckif(node)
  ) {
    push(ops, 'Factor polynomial', 'factorpolynomial');
  }
  if (numsel > 1 && Array.isArray(node) && node[0] === '+') {
    push(ops, 'Collect terms containing what is written in the input', 'collect', {
      needsField: true,
      fieldPlaceholder: 'x',
    });
  }
  if (can('simplifyfrac')) push(ops, 'Simplify fraction', 'simplifyfrac');
  if (can('multbyaddpower')) push(ops, 'Multiply by adding powers', 'multbyaddpower');
  if (can('expandpower')) push(ops, 'Expand power', 'expandpower');
  if (can('combinepower')) push(ops, 'Combine power x^ay^a=(xy)^a', 'combinepower');
  if (can('multiplyfracby1')) push(ops, 'Multiply by 1 to get same denominator', 'multiplyfracby1');

  if (can('makebasee')) push(ops, 'Make the base e, a^b=e^(bln(a))', 'makebasee');
  if (can('makebase10')) push(ops, 'Make the base 10, a^b=10^(blog(a))', 'makebase10');

  if (
    Array.isArray(node) &&
    node[0] === '^' &&
    node[1] === 'e' &&
    typeof THIS.countcond === 'function' &&
    THIS.countcond(node, (p, i) => p[i] === 'i') > 0
  ) {
    push(ops, 'Convert polar complex number to Cartesian form', 'polari2cartesian');
  }
  if (
    typeof THIS.countcond === 'function' &&
    THIS.countcond(node, (p, i) => p[i] === 'i') > 0 &&
    !(Array.isArray(node) && node[0] === '^' && node[1] === 'e' && THIS.countcond(node, (p, i) => p[i] === 'i') > 0)
  ) {
    push(ops, 'Convert Cartesian complex number to polar form', 'cartesiani2polar');
  }

  if (can('polynomialdivision')) {
    push(ops, 'Polynomial division', 'polynomialdivision', { needsField: true, fieldPlaceholder: 'x' });
  }
  if (can('partialfractions')) {
    push(ops, 'Partial fraction expansion', 'partialfractions', { needsField: true, fieldPlaceholder: 'x' });
  }
  if (can('pospow')) push(ops, 'Make powers positive', 'pospow');
  push(ops, 'Make power negative', 'negpow');

  // Multiply by one — original nested submenu
  const mult1Children = [];
  if (Array.isArray(node) && node[0] === '/' && typeof THIS.countcond === 'function' && THIS.countcond(node, (p, i) => p[i] === 'i') > 0) {
    mult1Children.push({
      id: 'mult1conj:conjugate',
      label: 'Multiply by one, in the form of the denominator complex conjugate',
      method: 'mult1conj',
    });
  }
  const fracForm = methodResult(THIS, 'mult1fracoverfrac', path, issel);
  if (fracForm !== false && fracForm != null) {
    const formLabel = printflat ? printflat(fracForm) : 'form';
    mult1Children.push({
      id: `mult1fracoverfrac:${formLabel}`,
      label: `Multiply by one, in the form of (${formLabel})/(${formLabel})`,
      method: 'mult1fracoverfrac',
    });
  }
  mult1Children.push({
    id: 'mult1e2piik:e2piik',
    label: 'Multiply by one, in the form of e^(2πik)',
    method: 'mult1e2piik',
  });
  mult1Children.push({
    id: 'mult1negi2:negi2',
    label: 'Multiply by one, in the form of -i^2',
    method: 'mult1negi2',
  });
  const powers = methodResult(THIS, 'mult1powpow', path, issel);
  if (Array.isArray(powers)) {
    for (const pow of powers) {
      let formLabel = printflat ? `x=(x^(1/${printflat(pow)}))^…` : 'x=(x^(1/a))^a';
      if (typeof THIS.solvesimplifygraph === 'function' && printflat) {
        try {
          const formAst = THIS.solvesimplifygraph(['^', ['^', 'x', ['/', '1', pow]], pow]);
          formLabel = `x=${printflat(formAst)}`;
        } catch {
          /* keep fallback */
        }
      }
      mult1Children.push({
        id: `mult1powpow:${formLabel}`,
        label: `Multiply by one, in the form of ${formLabel}`,
        method: 'mult1powpow',
        extra: { arg: pow },
      });
    }
  }
  ops.push({
    id: 'submenu:multByOne',
    label: 'Multiply by one',
    submenu: mult1Children,
  });

  // Solve for selected variable
  if (issel.filter(Boolean).length === 1) {
    const si = issel.indexOf(true);
    const v = node[si];
    if (si > 0 && typeof v === 'string' && isNaN(v) && v !== 'π' && v !== 'i' && v !== 'e') {
      push(ops, `Solve equation for ${v}`, 'solveui', { arg: v, callStyle: 'solve' });
    }
  }

  // Evaluate / convert (selection-aware)
  if (Array.isArray(node) && (node[0] === 'arcsin' || node[0] === 'arccos' || node[0] === 'arctan' || node[0] === 'arg')) {
    push(ops, 'All solutions in terms of principal solution', 'allsolintermsofprincipal');
  }
  if (numsel === 1) {
    for (let i = 1; i < node.length; i++) {
      if (issel[i] && !isNaN(node[i]) && Number(node[i]) % 1 === 0 && Number(node[i]) > 3) {
        push(ops, 'Convert number to product of factors', 'factorsofint', { arg: i });
        break;
      }
    }
  }
  if (issel.filter(Boolean).length === 1) {
    const posInNode = issel.findIndex((flag, i) => i > 0 && flag);
    const v = posInNode > 0 ? node[posInNode] : undefined;
    if (typeof v === 'string' && !isNaN(v) && v.split('.').length === 2) {
      push(ops, 'Convert to fraction', 'dec2frac', { arg: posInNode });
    }
  }
  if (Array.isArray(node) && node[0] === '/') {
    let containsnum = 0;
    for (let i = 1; i <= 2; i++) {
      if (!isNaN(node[i])) containsnum += 1;
    }
    if (containsnum > 1) push(ops, 'Convert to decimal', 'frac2dec');
  }
  if (typeof THIS.evaltodecimal === 'function' && typeof THIS.countcond === 'function') {
    const nnsel = THIS.countcond(node, (p, i) => (!isNaN(p[i]) || p[i] === 'e' || p[i] === 'π') && THIS.isselected(p)[i]);
    if (nnsel >= 1) push(ops, 'Evaluate to decimal', 'evaltodecimal');
  }

  return ops;
}

export { walkAstPath };
