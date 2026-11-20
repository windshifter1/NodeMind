/** @see https://lucide.dev — open-source icon set (MIT), loaded on demand in the UI. */
export const LUCIDE_ICON_CATALOG_URL = 'https://lucide.dev/icons/';

export const WORKSPACE_COLORS = [
  '#6366f1',
  '#3b82f6',
  '#06b6d4',
  '#10b981',
  '#84cc16',
  '#f59e0b',
  '#f97316',
  '#ef4444',
  '#ec4899',
  '#8b5cf6',
  '#14b8a6',
  '#64748b',
];

/** Legacy canvas icon ids from the first fixed palette → Lucide kebab names. */
const LEGACY_ICON_IDS = {
  note: 'sticky-note',
  book: 'book-open',
};

export const WORKSPACE_ICON_QUICK_PICKS = [
  'sticky-note',
  'lightbulb',
  'star',
  'heart',
  'folder',
  'brain',
  'rocket',
  'palette',
  'book-open',
  'code',
  'sparkles',
  'zap',
  'layers',
  'layout-grid',
  'pen-line',
  'git-branch',
  'target',
  'compass',
  'music',
  'coffee',
];

let lucideNameListPromise = null;

async function lucideIconNames() {
  if (!lucideNameListPromise) {
    lucideNameListPromise = import('lucide-react/dynamic').then((mod) => mod.iconNames);
  }
  return lucideNameListPromise;
}

/**
 * @param {string | null | undefined} id
 * @returns {string}
 */
export function normalizeWorkspaceIconId(id) {
  if (!id) return 'sticky-note';
  if (LEGACY_ICON_IDS[id]) return LEGACY_ICON_IDS[id];
  const kebab = String(id)
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();
  return kebab || 'sticky-note';
}

export async function loadLucideIconNames() {
  return lucideIconNames();
}

export async function searchWorkspaceIconIds(query, { limit = 120 } = {}) {
  const names = await lucideIconNames();
  const set = new Set(names);
  const q = String(query || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
  if (!q) {
    return WORKSPACE_ICON_QUICK_PICKS.filter((name) => set.has(name));
  }
  const matches = [];
  for (let i = 0; i < names.length; i += 1) {
    const name = names[i];
    if (name.includes(q)) {
      matches.push(name);
      if (matches.length >= limit) break;
    }
  }
  return matches;
}