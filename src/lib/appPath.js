/** Pathname relative to Vite `base` (e.g. `/mockup1`, `/`). */
export function getAppPath() {
  const base = String(import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  let path = typeof window !== 'undefined' ? window.location.pathname : '/';
  if (base && path.startsWith(base)) {
    path = path.slice(base.length) || '/';
  }
  if (!path.startsWith('/')) path = `/${path}`;
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return path;
}

/** Match `/mockup1` … `/mockup8` → 1…8, else null. */
export function matchMockupPath(path = getAppPath()) {
  const m = /^\/mockup([1-8])$/.exec(path);
  return m ? Number(m[1]) : null;
}

/** Match `/dev1` → 1. Mobile layout mockup (/dev2 is an organise experiment). */
export function matchDevPath(path = getAppPath()) {
  return path === '/dev1' ? 1 : null;
}

/**
 * Edge-aware organise experiments:
 * - `/dev`  → curve-fan (bend overlapping edges apart)
 * - `/dev2` → node-spread (move nodes to clear overlapping corridors)
 */
export function matchDevOrganisePath(path = getAppPath()) {
  if (path === '/dev') return 'curve-fan';
  if (path === '/dev2') return 'node-spread';
  return null;
}

/** @deprecated use matchDevOrganisePath */
export function isDevOrganisePath(path = getAppPath()) {
  return matchDevOrganisePath(path) != null;
}
