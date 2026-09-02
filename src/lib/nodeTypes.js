export const NODE_KIND = {
  NOTE: 'note',
  /** Algebraic expression without `=` (formerly Number). */
  EXPRESSION: 'expression',
  /** Equation text that must include `=` (formerly Expression). */
  EQUATION: 'equation',
  BASIC_OPERATION: 'basicOperation',
  MANIPULATION: 'manipulation',
  /** Core Solve node (variable dropdown). Stored id kept for compatibility. */
  EQUATION_OP: 'equationOp',
  /** @deprecated Prefer MANIPULATION; kept so older graphs still evaluate. */
  CAS_OP: 'casOp',
  COMBINE_LIKE: 'combineLike',
  EXPAND: 'expand',
  FACTOR: 'factor',
  COLLECT: 'collect',
  SIMPLIFY_FRAC: 'simplifyFrac',
  POWERS: 'powers',
  SAME_DENOM: 'sameDenom',
  MULT_BY_ONE: 'multByOne',
  POLY_DIV: 'polyDiv',
  PARTIAL_FRAC: 'partialFrac',
  APPLY_BOTH: 'applyBoth',
  DIFF: 'diff',
  INTEGRATE: 'integrate',
  APPLY_INVERSE: 'applyInverse',
  TRIG_IDENTITY: 'trigIdentity',
  LOG_REWRITE: 'logRewrite',
  EXP_REWRITE: 'expRewrite',
  COMPLEX: 'complex',
  EVALUATE: 'evaluate',
  CONVERT: 'convert',
  SUBSTITUTE: 'substitute',
  /** @deprecated Rewrite-style solve; hidden from picker in favour of EQUATION_OP. */
  SOLVE: 'solve',
};

export const DEFAULT_NODE_KIND = NODE_KIND.NOTE;

export const NODE_CATEGORIES = [
  { id: 'text', label: 'Text' },
  { id: 'math', label: 'Math' },
];

export const MATH_GROUPS = [
  { id: 'values', label: 'Core' },
  { id: 'algebra', label: 'Algebra' },
  { id: 'calculus', label: 'Calculus' },
  { id: 'trig', label: 'Trig' },
  { id: 'logexp', label: 'Log / Exp' },
  { id: 'complex', label: 'Complex' },
  { id: 'evaluate', label: 'Evaluate' },
  { id: 'solve', label: 'Solve' },
];

export const NODE_TYPE_DEFS = [
  { id: NODE_KIND.NOTE, category: 'text', label: 'Text' },
  {
    id: NODE_KIND.EXPRESSION,
    category: 'math',
    group: 'values',
    label: 'Expression',
    field: { key: 'expr', label: 'Expression', placeholder: 'x^2+2*x+1' },
  },
  {
    id: NODE_KIND.EQUATION,
    category: 'math',
    group: 'values',
    label: 'Equation',
    field: { key: 'expr', label: 'Equation', placeholder: 'x^2+2*x+1=0' },
  },
  {
    id: NODE_KIND.BASIC_OPERATION,
    category: 'math',
    group: 'values',
    label: 'Basic operation',
    modes: [
      { id: '+', label: 'Plus' },
      { id: '-', label: 'Minus' },
      { id: '*', label: 'Times' },
      { id: '/', label: 'Divide' },
    ],
  },
  {
    id: NODE_KIND.MANIPULATION,
    category: 'math',
    group: 'values',
    label: 'Manipulation',
  },
  {
    id: NODE_KIND.EQUATION_OP,
    category: 'math',
    group: 'values',
    label: 'Solve',
    field: { key: 'field', label: 'Variable', placeholder: 'x' },
  },
  {
    id: NODE_KIND.CAS_OP,
    category: 'math',
    group: 'algebra',
    label: 'Operation',
    picker: false,
  },
  {
    id: NODE_KIND.COMBINE_LIKE,
    category: 'math',
    group: 'algebra',
    label: 'Combine like terms',
    picker: false,
  },
  {
    id: NODE_KIND.EXPAND,
    category: 'math',
    group: 'algebra',
    label: 'Expand',
    modes: [
      { id: 'polynomial', label: 'Polynomial' },
      { id: 'fraction', label: 'Fraction' },
      { id: 'power', label: 'Power' },
      { id: 'neg1', label: 'Factor ±1' },
    ],
  },
  {
    id: NODE_KIND.FACTOR,
    category: 'math',
    group: 'algebra',
    label: 'Factor',
    modes: [
      { id: 'factor', label: 'Factor' },
      { id: 'polynomial', label: 'Polynomial' },
      { id: 'completeSquare', label: 'Complete the square' },
    ],
  },
  {
    id: NODE_KIND.COLLECT,
    category: 'math',
    group: 'algebra',
    label: 'Collect',
    field: { key: 'field', label: 'Collect', placeholder: 'x' },
  },
  {
    id: NODE_KIND.SIMPLIFY_FRAC,
    category: 'math',
    group: 'algebra',
    label: 'Simplify fraction',
  },
  {
    id: NODE_KIND.POWERS,
    category: 'math',
    group: 'algebra',
    label: 'Powers',
    modes: [
      { id: 'addPowers', label: 'Multiply by adding powers' },
      { id: 'combine', label: 'x^a y^a = (xy)^a' },
      { id: 'positive', label: 'Make powers positive' },
      { id: 'negative', label: 'Make power negative' },
    ],
  },
  {
    id: NODE_KIND.SAME_DENOM,
    category: 'math',
    group: 'algebra',
    label: 'Same denominator',
  },
  {
    id: NODE_KIND.MULT_BY_ONE,
    category: 'math',
    group: 'algebra',
    label: 'Multiply by one',
    modes: [
      { id: 'conjugate', label: 'Denominator conjugate' },
      { id: 'fracOverFrac', label: '(form)/(form)' },
      { id: 'e2piik', label: 'e^(2πik)' },
      { id: 'negi2', label: '-i²' },
      { id: 'powpow', label: 'x = (x^(1/a))^a' },
    ],
    field: { key: 'field', label: 'Power', placeholder: 'a (optional)', modes: ['powpow'] },
  },
  {
    id: NODE_KIND.POLY_DIV,
    category: 'math',
    group: 'algebra',
    label: 'Polynomial division',
    field: { key: 'field', label: 'Variable', placeholder: 'x' },
  },
  {
    id: NODE_KIND.PARTIAL_FRAC,
    category: 'math',
    group: 'algebra',
    label: 'Partial fractions',
    field: { key: 'field', label: 'Variable', placeholder: 'x' },
  },
  {
    id: NODE_KIND.APPLY_BOTH,
    category: 'math',
    group: 'algebra',
    label: 'Apply',
    modes: [
      { id: '+', label: 'Add to both sides' },
      { id: '*', label: 'Multiply both sides' },
      { id: '/', label: 'Divide both sides' },
      { id: '^', label: 'Raise both sides' },
    ],
    field: { key: 'field', label: 'Operand', placeholder: '1' },
  },
  {
    id: NODE_KIND.DIFF,
    category: 'math',
    group: 'calculus',
    label: 'Diff',
    modes: [
      { id: 'calculate', label: 'Calculate' },
      { id: 'swap', label: 'Swap order' },
      { id: 'productRule', label: 'Collect product-rule terms' },
    ],
  },
  {
    id: NODE_KIND.INTEGRATE,
    category: 'math',
    group: 'calculus',
    label: 'Integrate',
    modes: [
      { id: 'simple', label: 'Simple integral' },
      { id: 'byParts', label: 'By parts' },
      { id: 'splitSum', label: 'Split sum' },
      { id: 'combineSum', label: 'Combine sum' },
      { id: 'constOut', label: 'Constants out' },
      { id: 'constIn', label: 'Constants in' },
      { id: 'splitLimits', label: 'Split limits' },
      { id: 'swapLimits', label: 'Swap limits' },
    ],
    field: { key: 'field', label: 'Split at', placeholder: '0', modes: ['splitLimits'] },
  },
  {
    id: NODE_KIND.APPLY_INVERSE,
    category: 'math',
    group: 'trig',
    label: 'Apply inverse',
  },
  {
    id: NODE_KIND.TRIG_IDENTITY,
    category: 'math',
    group: 'trig',
    label: 'Trig identity',
    modes: [
      { id: 'angleSum', label: 'Angle sum' },
      { id: 'double', label: 'Double angle' },
      { id: 'triple', label: 'Triple angle' },
      { id: 'nAngle', label: 'Multiple angle' },
      { id: 'powerReduction', label: 'Power reduction' },
      { id: 'productToSum', label: 'Product to sum' },
      { id: 'tanToSinCos', label: 'tan = sin/cos' },
      { id: 'sinCosToTan', label: 'sin/cos = tan' },
      { id: 'sec2ToTan', label: '1/cos² = 1+tan²' },
      { id: 'tanToSec2', label: '1+tan² = 1/cos²' },
      { id: 'odd', label: 'Odd (f(-x) = -f(x))' },
      { id: 'even', label: 'Even (cos(-x) = cos(x))' },
      { id: 'pythagorean', label: 'Pythagorean' },
      { id: 'oneMinusCos', label: '1-cos² = sin²' },
      { id: 'oneMinusSin', label: '1-sin² = cos²' },
      { id: 'sinSq', label: 'sin² = 1-cos²' },
      { id: 'cosSq', label: 'cos² = 1-sin²' },
      { id: 'asinBcos', label: 'A sin + B cos' },
      { id: 'weierstrassSin', label: 'Weierstrass sin' },
      { id: 'weierstrassCos', label: 'Weierstrass cos' },
      { id: 'eulerSin', label: 'Euler sin' },
      { id: 'eulerCos', label: 'Euler cos' },
      { id: 'eulerTan', label: 'Euler tan' },
      { id: 'eulerArcsin', label: 'Euler arcsin' },
      { id: 'eulerArccos', label: 'Euler arccos' },
      { id: 'eulerArctan', label: 'Euler arctan' },
    ],
  },
  {
    id: NODE_KIND.LOG_REWRITE,
    category: 'math',
    group: 'logexp',
    label: 'Log',
    modes: [
      { id: 'powerOut', label: 'Move power out' },
      { id: 'coeffIn', label: 'Move coefficient in' },
      { id: 'combine', label: 'Combine logs' },
      { id: 'split', label: 'Split into sum' },
      { id: 'complex', label: 'Complex logarithm' },
    ],
  },
  {
    id: NODE_KIND.EXP_REWRITE,
    category: 'math',
    group: 'logexp',
    label: 'Exp',
    modes: [
      { id: 'sumToProduct', label: 'Sum in power → product' },
      { id: 'baseE', label: 'Make base e' },
      { id: 'base10', label: 'Make base 10' },
    ],
  },
  {
    id: NODE_KIND.COMPLEX,
    category: 'math',
    group: 'complex',
    label: 'Complex',
    modes: [
      { id: 'sinArg', label: 'sin(arg z)' },
      { id: 'cosArg', label: 'cos(arg z)' },
      { id: 'tanArg', label: 'tan(arg z)' },
      { id: 'real', label: 'real(z) definition' },
      { id: 'imag', label: 'imag(z) definition' },
      { id: 'absToConj', label: '|x| = √(x conj x)' },
      { id: 'conjToAbs', label: '√(x conj x) = |x|' },
      { id: 'argTrig', label: 'arg, trigonometric' },
      { id: 'argLog', label: 'arg, logarithmic' },
      { id: 'conj', label: 'Evaluate conjugate' },
      { id: 'polarToCart', label: 'Polar → Cartesian' },
      { id: 'cartToPolar', label: 'Cartesian → polar' },
      { id: 'simplifyI', label: 'Simplify i^n' },
    ],
  },
  {
    id: NODE_KIND.EVALUATE,
    category: 'math',
    group: 'evaluate',
    label: 'Evaluate',
    modes: [
      { id: 'exact', label: 'Function exactly' },
      { id: 'principal', label: 'All principal solutions' },
      { id: 'decimal', label: 'To decimal' },
    ],
  },
  {
    id: NODE_KIND.CONVERT,
    category: 'math',
    group: 'evaluate',
    label: 'Convert',
    modes: [
      { id: 'factors', label: 'Prime factors' },
      { id: 'fraction', label: 'To fraction' },
      { id: 'decimal', label: 'To decimal' },
    ],
  },
  {
    id: NODE_KIND.SUBSTITUTE,
    category: 'math',
    group: 'solve',
    label: 'Substitute',
    field: { key: 'field', label: 'Substitution', placeholder: 'u=x^2' },
  },
  {
    id: NODE_KIND.SOLVE,
    category: 'math',
    group: 'solve',
    label: 'Solve (rewrite)',
    picker: false,
    field: { key: 'field', label: 'Variable', placeholder: 'x' },
  },
];

export const EXPRESSION_NODE_BODY_HEIGHT = 120;
/** @deprecated Use EXPRESSION_NODE_BODY_HEIGHT */
export const NUMBER_NODE_BODY_HEIGHT = EXPRESSION_NODE_BODY_HEIGHT;
export const MATH_NODE_BODY_HEIGHT = 168;

export function defForKind(kind) {
  return NODE_TYPE_DEFS.find((item) => item.id === kind) || null;
}

export function normalizeNodeKind(kind) {
  return NODE_TYPE_DEFS.some((def) => def.id === kind) ? kind : DEFAULT_NODE_KIND;
}

function isPickerDef(def) {
  if (!def || def.picker === false) return false;
  if (def.category === 'text') return true;
  return def.group === 'values';
}

export function typesForCategory(categoryId) {
  return NODE_TYPE_DEFS.filter((def) => def.category === categoryId && isPickerDef(def));
}

export function mathTypesByGroup() {
  return MATH_GROUPS.map((group) => ({
    ...group,
    types: NODE_TYPE_DEFS.filter(
      (def) => def.category === 'math' && def.group === group.id && isPickerDef(def)
    ),
  })).filter((group) => group.types.length);
}

export function fieldsForKind(kind) {
  const normalised = normalizeNodeKind(kind);
  const def = defForKind(normalised);
  const fields = { kind: normalised, title: def?.label || 'Text', content: '' };
  if (normalised === NODE_KIND.EXPRESSION || normalised === NODE_KIND.EQUATION) {
    fields.expr = '';
  }
  if (
    normalised === NODE_KIND.CAS_OP ||
    normalised === NODE_KIND.MANIPULATION ||
    normalised === NODE_KIND.EQUATION_OP
  ) {
    fields.method = '';
    fields.selection = null;
    fields.opId = '';
  }
  if (def?.modes?.length) fields.mode = def.modes[0].id;
  if (def?.field?.key && def.field.key !== 'expr') fields.field = '';
  return fields;
}

export function nodeTypeLabel(kind) {
  const def = defForKind(normalizeNodeKind(kind));
  return def ? def.label : 'Text';
}

/** Display title: stored title, else type name (never a blank “Untitled”). */
export function displayNodeTitle(nodeOrKind, title) {
  const stored =
    typeof nodeOrKind === 'object' && nodeOrKind
      ? (nodeOrKind.title || '').trim()
      : (title || '').trim();
  if (stored && stored.toLowerCase() !== 'untitled') return stored;
  const kind = typeof nodeOrKind === 'object' ? nodeOrKind?.kind : nodeOrKind;
  return nodeTypeLabel(kind);
}

export function isExpressionNode(nodeOrKind) {
  const kind = typeof nodeOrKind === 'object' ? nodeOrKind?.kind : nodeOrKind;
  return normalizeNodeKind(kind) === NODE_KIND.EXPRESSION;
}

/** @deprecated Use isExpressionNode */
export function isNumberNode(nodeOrKind) {
  return isExpressionNode(nodeOrKind);
}

export function isEquationNode(nodeOrKind) {
  const kind = typeof nodeOrKind === 'object' ? nodeOrKind?.kind : nodeOrKind;
  return normalizeNodeKind(kind) === NODE_KIND.EQUATION;
}

/** Expression / Equation — valid sources when filling a Math input socket. */
export function isValueSourceKind(nodeOrKind) {
  const kind = typeof nodeOrKind === 'object' ? nodeOrKind?.kind : nodeOrKind;
  const normalised = normalizeNodeKind(kind);
  return normalised === NODE_KIND.EXPRESSION || normalised === NODE_KIND.EQUATION;
}

export function isBasicOperationNode(nodeOrKind) {
  const kind = typeof nodeOrKind === 'object' ? nodeOrKind?.kind : nodeOrKind;
  return normalizeNodeKind(kind) === NODE_KIND.BASIC_OPERATION;
}

/** Math nodes that may accept more than one inbound edge. */
export function allowsMultipleInputs(nodeOrKind) {
  return isBasicOperationNode(nodeOrKind);
}

/** Selection-menu driven Math nodes with a method/op picker (Manipulation). */
export function isSelectionOpNode(nodeOrKind) {
  const kind = typeof nodeOrKind === 'object' ? nodeOrKind?.kind : nodeOrKind;
  const normalised = normalizeNodeKind(kind);
  return normalised === NODE_KIND.MANIPULATION || normalised === NODE_KIND.CAS_OP;
}

/** Core Solve node (variable dropdown). */
export function isEquationOpNode(nodeOrKind) {
  const kind = typeof nodeOrKind === 'object' ? nodeOrKind?.kind : nodeOrKind;
  return normalizeNodeKind(kind) === NODE_KIND.EQUATION_OP;
}

export function isSolveNode(nodeOrKind) {
  return isEquationOpNode(nodeOrKind);
}

export function isMathNode(nodeOrKind) {
  const kind = typeof nodeOrKind === 'object' ? nodeOrKind?.kind : nodeOrKind;
  const def = defForKind(normalizeNodeKind(kind));
  return def?.category === 'math';
}

export function isNoteNode(nodeOrKind) {
  return !isMathNode(nodeOrKind);
}

export function fieldVisibleForNode(def, node) {
  if (!def?.field) return false;
  if (!def.field.modes) return true;
  return def.field.modes.includes(node?.mode || def.modes?.[0]?.id);
}
