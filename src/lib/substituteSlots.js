import { isSubstituteNode } from './nodeTypes.js';
import { edgeFlow } from './graphEdges.js';

/** Geometry shared by Substitute body rows and socketWorld. */
export const SUB_SLOT_PAD_TOP = 8;
export const SUB_SLOT_ROW_H = 36;
export const SUB_SLOT_GAP = 8;
export const SUB_SLOT_PAD_BOTTOM = 4;

export function slotIdA() {
  return 'A';
}

export function slotIdB(index) {
  return `B${index}`;
}

export function parseSlotId(slotId) {
  if (slotId === 'A') return { kind: 'A', index: 0 };
  const match = /^B(\d+)$/.exec(String(slotId || ''));
  if (!match) return null;
  return { kind: 'B', index: Number(match[1]) };
}

export function isSlotId(slotId) {
  return Boolean(parseSlotId(slotId));
}

/** Normalise stored text fields on a Substitute node. */
export function normalizeSubstituteTexts(node) {
  const subA = String(node?.subA ?? '');
  let subB = Array.isArray(node?.subB) ? node.subB.map((t) => String(t ?? '')) : [];
  if (!subB.length) subB = [''];
  return { subA, subB };
}

function textFilled(text) {
  return Boolean(String(text ?? '').replace(/\s+/g, ''));
}

/** Map of slotId → source node id for inbound edges on a Substitute node. */
export function connectedSlotsForNode(edges, nodeId) {
  const map = new Map();
  (edges || []).forEach((edge) => {
    const { sourceId, targetId } = edgeFlow(edge);
    if (targetId !== nodeId) return;
    const slot = edge.inputSlot;
    if (!isSlotId(slot)) return;
    if (!map.has(slot)) map.set(slot, sourceId);
  });
  return map;
}

export function hasInboundEdgeOnSlot(edges, nodeId, slotId) {
  if (!nodeId || !isSlotId(slotId)) return false;
  return connectedSlotsForNode(edges, nodeId).has(slotId);
}

/**
 * How many B rows to show: always at least one; after any filled B,
 * keep one trailing empty (grey) row for the next substitution.
 */
export function visibleBCount(node, connected) {
  const { subB } = normalizeSubstituteTexts(node);
  let lastFilled = -1;
  const maxCheck = Math.max(subB.length, 1);
  for (let i = 0; i < maxCheck; i++) {
    const filled = textFilled(subB[i]) || connected?.has(slotIdB(i));
    if (filled) lastFilled = i;
  }
  // Also count connected slots beyond current array length.
  connected?.forEach((_src, slotId) => {
    const parsed = parseSlotId(slotId);
    if (parsed?.kind === 'B' && parsed.index > lastFilled) lastFilled = parsed.index;
  });
  if (lastFilled < 0) return 1;
  return lastFilled + 2;
}

/**
 * Ordered slot descriptors for UI / eval.
 * @returns {{ id: string, label: 'A'|'B', index: number, text: string, connected: boolean, sourceId: string|null, greyed: boolean }[]}
 */
export function listSubstituteSlots(node, edges = []) {
  if (!isSubstituteNode(node)) return [];
  const { subA, subB } = normalizeSubstituteTexts(node);
  const connected = connectedSlotsForNode(edges, node.id);
  const bCount = visibleBCount(node, connected);
  const slots = [
    {
      id: slotIdA(),
      label: 'A',
      index: 0,
      text: subA,
      connected: connected.has(slotIdA()),
      sourceId: connected.get(slotIdA()) || null,
      greyed: false,
    },
  ];
  for (let i = 0; i < bCount; i++) {
    const id = slotIdB(i);
    const text = subB[i] ?? '';
    const isConnected = connected.has(id);
    const filled = textFilled(text) || isConnected;
    // Trailing empty placeholder is greyed; the initial empty B0 is not.
    const greyed = !filled && i === bCount - 1 && i > 0;
    slots.push({
      id,
      label: 'B',
      index: i,
      text,
      connected: isConnected,
      sourceId: connected.get(id) || null,
      greyed,
    });
  }
  return slots;
}

/** Patch helper when editing A or a B text field. */
export function patchSubstituteSlotText(node, slotId, nextText) {
  const parsed = parseSlotId(slotId);
  if (!parsed) return null;
  const { subA, subB } = normalizeSubstituteTexts(node);
  if (parsed.kind === 'A') {
    return { subA: nextText };
  }
  const nextB = [...subB];
  while (nextB.length <= parsed.index) nextB.push('');
  nextB[parsed.index] = nextText;
  // Keep one trailing empty after the last filled text slot (connections handled at render).
  let lastFilled = -1;
  for (let i = 0; i < nextB.length; i++) {
    if (textFilled(nextB[i])) lastFilled = i;
  }
  const keep = lastFilled < 0 ? 1 : lastFilled + 2;
  while (nextB.length < keep) nextB.push('');
  while (nextB.length > keep) nextB.pop();
  return { subB: nextB };
}

/** Ensure subB is long enough when an edge lands on a high B index. */
export function ensureSubstituteSlotCapacity(node, slotId) {
  const parsed = parseSlotId(slotId);
  if (!parsed || parsed.kind !== 'B') return null;
  const { subB } = normalizeSubstituteTexts(node);
  if (subB.length > parsed.index + 1) return null;
  const nextB = [...subB];
  while (nextB.length <= parsed.index) nextB.push('');
  // Trailing grey placeholder.
  if (nextB.length === parsed.index + 1) nextB.push('');
  return { subB: nextB };
}

/** World Y offset (from node.y) for a Substitute input slot centre. */
export function substituteSlotOffsetY(slotIndex) {
  return (
    // TOP_BAR_HEIGHT imported by callers via summing; keep pure offset from body start + bar
    SUB_SLOT_PAD_TOP + slotIndex * (SUB_SLOT_ROW_H + SUB_SLOT_GAP) + SUB_SLOT_ROW_H / 2
  );
}

/**
 * Migrate legacy unslotted inbound edges onto A, B0, B1… in edge order.
 * Returns { edges, nodePatch } — nodePatch may add default subA/subB.
 */
export function migrateSubstituteEdges(node, edges) {
  if (!isSubstituteNode(node)) {
    return { edges, nodePatch: null };
  }
  const texts = normalizeSubstituteTexts(node);
  const nodePatch =
    node.subA == null || !Array.isArray(node.subB)
      ? { subA: texts.subA, subB: texts.subB }
      : null;

  const inbound = (edges || []).filter((edge) => edgeFlow(edge).targetId === node.id);
  const hasUnslotted = inbound.some((edge) => !isSlotId(edge.inputSlot));
  if (!hasUnslotted) {
    return { edges, nodePatch };
  }

  let nextA = false;
  let nextB = 0;
  const used = new Set(
    inbound.filter((edge) => isSlotId(edge.inputSlot)).map((edge) => edge.inputSlot)
  );
  const nextEdges = (edges || []).map((edge) => {
    if (edgeFlow(edge).targetId !== node.id) return edge;
    if (isSlotId(edge.inputSlot)) return edge;
    let slot = slotIdA();
    if (!used.has(slotIdA()) && !nextA) {
      nextA = true;
      slot = slotIdA();
    } else {
      while (used.has(slotIdB(nextB))) nextB += 1;
      slot = slotIdB(nextB);
      nextB += 1;
    }
    used.add(slot);
    return { ...edge, inputSlot: slot };
  });
  return { edges: nextEdges, nodePatch };
}
