import { isGraphNode } from './nodeTypes.js';
import { edgeFlow } from './graphEdges.js';
import {
  SUB_SLOT_GAP,
  SUB_SLOT_PAD_TOP,
  SUB_SLOT_ROW_H,
  substituteSlotOffsetY,
} from './substituteSlots.js';
import { parseExpressionOrEquation } from './cas/engine.js';
import { listPlotModes, paramNamesForMode, pickDefaultMode } from './cas/graphModes.js';

export { SUB_SLOT_GAP, SUB_SLOT_PAD_TOP, SUB_SLOT_ROW_H };

/** Extra UI under each Graph slot when expanded (keep in sync with MathNodeBody). */
export const GRAPH_SLOT_MODE_ROW_H = 28;
export const GRAPH_SLOT_PARAM_ROW_H = 30;
/** mt-1 (4) + container py-1.5 (12) + 1px border top/bottom */
export const GRAPH_SLOT_EXPANDED_PAD = 18;
/** space-y-1.5 between mode row and each param row */
export const GRAPH_SLOT_EXPANDED_GAP = 6;

function cssEscapeAttr(value) {
  const raw = String(value ?? '');
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(raw);
  return raw.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`);
}

function seriesForSlot(seriesBySlot, slotId) {
  if (!seriesBySlot || !slotId) return null;
  if (typeof seriesBySlot.get === 'function') return seriesBySlot.get(slotId) || null;
  return seriesBySlot[slotId] || null;
}

/** Map slotId → plot series from a Graph eval result or plot payload. */
export function graphPlotSeriesBySlot(plotOrResult) {
  const series = plotOrResult?.plot?.series || plotOrResult?.series || [];
  const map = new Map();
  series.forEach((s) => {
    if (s?.slotId) map.set(s.slotId, s);
  });
  return map;
}

/**
 * Centre of a Graph expression row, in CSS pixels from the node’s top edge.
 * Used so sockets track the real DOM instead of drifting on later slots.
 */
export function measureGraphSlotCenterFromNode(nodeId, slotId) {
  if (typeof document === 'undefined' || !nodeId || !slotId) return null;
  const root = document.querySelector(`[data-note-node="${cssEscapeAttr(nodeId)}"]`);
  const row = root?.querySelector(`[data-graph-slot-row="${cssEscapeAttr(slotId)}"]`);
  if (!root || !row) return null;
  const rootRect = root.getBoundingClientRect();
  const rowRect = row.getBoundingClientRect();
  if (rootRect.height < 1) return null;
  const scale = root.offsetHeight / rootRect.height;
  return (rowRect.top + rowRect.height / 2 - rootRect.top) * scale;
}

/** Letter label for slot index: A, B, … Z, AA, AB, … */
export function graphSlotLetter(index) {
  let n = Math.max(0, index);
  let out = '';
  while (n >= 0) {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  }
  return out;
}

export function parseGraphSlotId(slotId) {
  const raw = String(slotId || '');
  if (!/^[A-Z]+$/.test(raw)) return null;
  // Decode A=0 … Z=25, AA=26, …
  let n = 0;
  for (let i = 0; i < raw.length; i++) {
    n = n * 26 + (raw.charCodeAt(i) - 64);
  }
  return n - 1;
}

export function isGraphSlotId(slotId) {
  return parseGraphSlotId(slotId) != null;
}

function textFilled(text) {
  return Boolean(String(text ?? '').replace(/\s+/g, ''));
}

/** Normalise stored equation texts on a Graph node (`graphExprs` array). */
export function normalizeGraphExprs(node) {
  let exprs = Array.isArray(node?.graphExprs)
    ? node.graphExprs.map((t) => String(t ?? ''))
    : [];
  // Always keep at least two rows (A and B), matching Substitute’s starting pair.
  while (exprs.length < 2) exprs.push('');
  return exprs;
}

export function connectedGraphSlots(edges, nodeId) {
  const map = new Map();
  (edges || []).forEach((edge) => {
    const { sourceId, targetId } = edgeFlow(edge);
    if (targetId !== nodeId) return;
    const slot = edge.inputSlot;
    if (!isGraphSlotId(slot)) return;
    if (!map.has(slot)) map.set(slot, sourceId);
  });
  return map;
}

/**
 * Visible slot count: at least 2 (A,B); after any filled trailing slot,
 * keep one grey empty row for the next letter.
 */
export function visibleGraphSlotCount(node, connected) {
  const exprs = normalizeGraphExprs(node);
  let lastFilled = -1;
  const maxCheck = Math.max(exprs.length, 2);
  for (let i = 0; i < maxCheck; i++) {
    const id = graphSlotLetter(i);
    if (textFilled(exprs[i]) || connected?.has(id)) lastFilled = i;
  }
  connected?.forEach((_src, slotId) => {
    const idx = parseGraphSlotId(slotId);
    if (idx != null && idx > lastFilled) lastFilled = idx;
  });
  if (lastFilled < 1) return 2;
  return lastFilled + 2;
}

/**
 * Ordered Graph slot descriptors (A, B, C, …).
 * @returns {{ id: string, label: string, index: number, text: string, connected: boolean, sourceId: string|null, greyed: boolean }[]}
 */
export function listGraphSlots(node, edges = []) {
  if (!isGraphNode(node)) return [];
  const exprs = normalizeGraphExprs(node);
  const connected = connectedGraphSlots(edges, node.id);
  const count = visibleGraphSlotCount(node, connected);
  const slots = [];
  for (let i = 0; i < count; i++) {
    const id = graphSlotLetter(i);
    const text = exprs[i] ?? '';
    const isConnected = connected.has(id);
    const filled = textFilled(text) || isConnected;
    // A and B are never grey when empty; trailing extras are.
    const greyed = !filled && i === count - 1 && i > 1;
    slots.push({
      id,
      label: id,
      index: i,
      text,
      connected: isConnected,
      sourceId: connected.get(id) || null,
      greyed,
    });
  }
  return slots;
}

export function patchGraphSlotText(node, slotId, nextText) {
  const index = parseGraphSlotId(slotId);
  if (index == null) return null;
  const exprs = normalizeGraphExprs(node);
  const next = [...exprs];
  while (next.length <= index) next.push('');
  next[index] = nextText;
  let lastFilled = -1;
  for (let i = 0; i < next.length; i++) {
    if (textFilled(next[i])) lastFilled = i;
  }
  const keep = lastFilled < 1 ? 2 : lastFilled + 2;
  while (next.length < keep) next.push('');
  while (next.length > keep) next.pop();
  return { graphExprs: next };
}

export function ensureGraphSlotCapacity(node, slotId) {
  const index = parseGraphSlotId(slotId);
  if (index == null) return null;
  const exprs = normalizeGraphExprs(node);
  if (exprs.length > index + 1 && exprs.length >= 2) return null;
  const next = [...exprs];
  while (next.length <= index) next.push('');
  if (next.length === index + 1) next.push('');
  while (next.length < 2) next.push('');
  return { graphExprs: next };
}

/**
 * Migrate legacy unslotted inbound edges onto A, B, C… in edge order.
 */
export function migrateGraphEdges(node, edges) {
  if (!isGraphNode(node)) {
    return { edges, nodePatch: null };
  }
  const exprs = normalizeGraphExprs(node);
  const nodePatch = !Array.isArray(node.graphExprs) ? { graphExprs: exprs } : null;

  const inbound = (edges || []).filter((edge) => edgeFlow(edge).targetId === node.id);
  const hasUnslotted = inbound.some((edge) => !isGraphSlotId(edge.inputSlot));
  if (!hasUnslotted) {
    return { edges, nodePatch };
  }

  let nextIndex = 0;
  const used = new Set(
    inbound.filter((edge) => isGraphSlotId(edge.inputSlot)).map((edge) => edge.inputSlot)
  );
  const nextEdges = (edges || []).map((edge) => {
    if (edgeFlow(edge).targetId !== node.id) return edge;
    if (isGraphSlotId(edge.inputSlot)) return edge;
    while (used.has(graphSlotLetter(nextIndex))) nextIndex += 1;
    const slot = graphSlotLetter(nextIndex);
    nextIndex += 1;
    used.add(slot);
    return { ...edge, inputSlot: slot };
  });
  return { edges: nextEdges, nodePatch };
}

/** Per-slot plot options: mode axes, params, expanded chrome. */
export function normalizeGraphSlotOpts(node) {
  const raw = node?.graphSlotOpts && typeof node.graphSlotOpts === 'object' ? node.graphSlotOpts : {};
  const out = {};
  Object.keys(raw).forEach((key) => {
    if (!isGraphSlotId(key)) return;
    const item = raw[key] && typeof raw[key] === 'object' ? raw[key] : {};
    const params = {};
    if (item.params && typeof item.params === 'object') {
      Object.keys(item.params).forEach((p) => {
        params[p] = String(item.params[p] ?? '');
      });
    }
    out[key] = {
      expanded: item.expanded !== false,
      independent: item.independent ? String(item.independent) : null,
      dependent: item.dependent ? String(item.dependent) : null,
      kind: item.kind ? String(item.kind) : null,
      params,
    };
  });
  return out;
}

export function getGraphSlotOpt(node, slotId) {
  const all = normalizeGraphSlotOpts(node);
  return (
    all[slotId] || {
      expanded: true,
      independent: null,
      dependent: null,
      kind: null,
      params: {},
    }
  );
}

export function patchGraphSlotOpt(node, slotId, patch) {
  if (!isGraphSlotId(slotId) || !patch || typeof patch !== 'object') return null;
  const all = normalizeGraphSlotOpts(node);
  const prev = getGraphSlotOpt(node, slotId);
  const nextParams =
    patch.params && typeof patch.params === 'object'
      ? { ...prev.params, ...patch.params }
      : prev.params;
  all[slotId] = {
    ...prev,
    ...patch,
    params: nextParams,
  };
  return { graphSlotOpts: all };
}

export function patchGraphSlotParam(node, slotId, varName, text) {
  if (!isGraphSlotId(slotId) || !varName) return null;
  return patchGraphSlotOpt(node, slotId, { params: { [varName]: String(text ?? '') } });
}

/**
 * Param rows actually rendered under a Graph slot (keep in sync with MathNodeBody).
 * Connected slots follow plot series names, not remembered typed text or stale param keys.
 */
export function visibleGraphSlotParamNames(node, slot, series = null) {
  if (Array.isArray(series?.paramNames)) return series.paramNames;
  if (slot?.connected) return [];
  const text = String(slot?.text ?? '');
  if (!textFilled(text)) return [];
  const parsed = parseExpressionOrEquation(text);
  if (parsed.error) return [];
  const opt = getGraphSlotOpt(node, slot.id);
  const modes = listPlotModes(parsed.ast);
  const mode = pickDefaultMode(modes, {
    independent: opt.independent,
    dependent: opt.dependent,
    kind: opt.kind,
  });
  return paramNamesForMode(parsed.ast, mode);
}

/** Infer free param names for layout/UI from typed text. */
export function inferGraphSlotParamNames(node, slotId, ast = null) {
  const opt = getGraphSlotOpt(node, slotId);
  if (ast != null && ast !== '') {
    const modes = listPlotModes(ast);
    const mode = pickDefaultMode(modes, {
      independent: opt.independent,
      dependent: opt.dependent,
      kind: opt.kind,
    });
    return paramNamesForMode(ast, mode);
  }
  const exprs = normalizeGraphExprs(node);
  const index = parseGraphSlotId(slotId);
  return visibleGraphSlotParamNames(node, {
    id: slotId,
    connected: false,
    text: index != null ? exprs[index] : '',
  });
}

export function graphSlotExpandedExtraHeight(paramCount) {
  const n = Math.max(0, paramCount | 0);
  // mode row + n param rows + n gaps after the mode row
  return (
    GRAPH_SLOT_EXPANDED_PAD +
    GRAPH_SLOT_MODE_ROW_H +
    n * (GRAPH_SLOT_PARAM_ROW_H + GRAPH_SLOT_EXPANDED_GAP)
  );
}

/**
 * Socket centre Y relative to the body top for Graph slot index.
 * Accounts for expanded per-slot chrome above the target row.
 * @param {object} [opts]
 * @param {object[]} [opts.edges]
 * @param {Map|object} [opts.seriesBySlot]
 */
export function graphSocketOffsetY(node, slotIndex, opts = {}) {
  const idx = Math.max(0, slotIndex | 0);
  const edges = opts?.edges || [];
  const seriesBySlot = opts?.seriesBySlot || null;
  const slots = listGraphSlots(node, edges);
  let y = SUB_SLOT_PAD_TOP;
  for (let i = 0; i < idx; i++) {
    const slot = slots[i] || {
      id: graphSlotLetter(i),
      connected: false,
      text: '',
      greyed: false,
    };
    y += SUB_SLOT_ROW_H;
    const opt = getGraphSlotOpt(node, slot.id);
    if (!slot.greyed && opt.expanded !== false) {
      const params = visibleGraphSlotParamNames(node, slot, seriesForSlot(seriesBySlot, slot.id));
      y += graphSlotExpandedExtraHeight(params.length);
    }
    y += SUB_SLOT_GAP;
  }
  return y + SUB_SLOT_ROW_H / 2;
}

/** Legacy fixed-row helper (Substitute-compatible). Prefer graphSocketOffsetY for Graph. */
export function graphSlotOffsetY(index) {
  return substituteSlotOffsetY(index);
}

/** Total height of the Graph slots block (pad + rows + expanded extras). */
export function graphSlotsBlockHeight(node, edges = []) {
  const slots = listGraphSlots(node, edges);
  if (!slots.length) return 0;
  let h = SUB_SLOT_PAD_TOP;
  slots.forEach((slot, i) => {
    h += SUB_SLOT_ROW_H;
    if (!slot.greyed && getGraphSlotOpt(node, slot.id).expanded !== false) {
      h += graphSlotExpandedExtraHeight(visibleGraphSlotParamNames(node, slot).length);
    }
    if (i < slots.length - 1) h += SUB_SLOT_GAP;
  });
  // Domain row under slots
  h += SUB_SLOT_GAP + SUB_SLOT_ROW_H;
  return h;
}
