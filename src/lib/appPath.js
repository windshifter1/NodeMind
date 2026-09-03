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

/** Match `/mockup1` … `/mockup3` → 1…3, else null. */
export function matchMockupPath(path = getAppPath()) {
  const m = /^\/mockup([1-3])$/.exec(path);
  return m ? Number(m[1]) : null;
}
