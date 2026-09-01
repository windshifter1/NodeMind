export const NODE_KIND = {
  NOTE: 'note',
  NUMBER: 'number',
};

export const DEFAULT_NODE_KIND = NODE_KIND.NOTE;

export const NODE_CATEGORIES = [
  { id: 'text', label: 'Text' },
  { id: 'math', label: 'Math' },
];

export const NODE_TYPE_DEFS = [
  { id: NODE_KIND.NOTE, category: 'text', label: 'Note' },
  { id: NODE_KIND.NUMBER, category: 'math', label: 'Number' },
];

export const NUMBER_NODE_BODY_HEIGHT = 120;

export function normalizeNodeKind(kind) {
  return NODE_TYPE_DEFS.some((def) => def.id === kind) ? kind : DEFAULT_NODE_KIND;
}

export function typesForCategory(categoryId) {
  return NODE_TYPE_DEFS.filter((def) => def.category === categoryId);
}

export function fieldsForKind(kind) {
  const normalised = normalizeNodeKind(kind);
  if (normalised === NODE_KIND.NUMBER) {
    return { kind: normalised, title: '', content: '', value: '' };
  }
  return { kind: normalised, title: '', content: '' };
}

export function nodeTypeLabel(kind) {
  const def = NODE_TYPE_DEFS.find((item) => item.id === normalizeNodeKind(kind));
  return def ? def.label : 'Note';
}

export function isNumberNode(nodeOrKind) {
  const kind = typeof nodeOrKind === 'object' ? nodeOrKind?.kind : nodeOrKind;
  return normalizeNodeKind(kind) === NODE_KIND.NUMBER;
}
