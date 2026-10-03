import {
  KV_DOCUMENT,
  KV_META,
  kvGet,
  kvPut,
  migrateLegacyMediaBlobs,
  withAppDb,
} from '@/lib/idb';

export const LS_WORKSPACES_V2 = 'thoughts-canvas-workspaces-v2';
export const LS_GRAPH_V1 = 'thoughts-canvas-graph-v1';
export const LS_MIGRATED = 'nodemind-storage-migrated-v1';

export function emptyPersistMeta() {
  return {
    lastSavedAt: null,
    lastError: null,
    persisted: false,
    migratedMediaV1: false,
  };
}

export function persistErrorMessage(error) {
  const name = error?.name || '';
  const message = String(error?.message || '');
  if (name === 'QuotaExceededError' || /quota/i.test(message)) {
    return 'Storage is full. Export a backup, then delete unused workspaces or files.';
  }
  return message || 'Could not save workspaces.';
}

function markMigratedFlag() {
  try {
    localStorage.setItem(LS_MIGRATED, '1');
  } catch {
    /* ignore */
  }
}

export function clearLegacyGraphKeys() {
  try {
    localStorage.removeItem(LS_WORKSPACES_V2);
    localStorage.removeItem(LS_GRAPH_V1);
  } catch {
    /* ignore */
  }
  markMigratedFlag();
}

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function readLocalStorageDocument() {
  const v2 = readJson(LS_WORKSPACES_V2);
  if (v2 && Array.isArray(v2.workspaces) && v2.workspaces.length) return v2;

  const legacy = readJson(LS_GRAPH_V1);
  if (legacy && (Array.isArray(legacy.nodes) || Array.isArray(legacy.edges))) {
    return {
      workspaces: [
        {
          name: 'My Canvas',
          nodes: legacy.nodes,
          edges: legacy.edges,
          nextZ: legacy.nextZ,
        },
      ],
      activeId: null,
    };
  }
  return null;
}

export function isValidRawDocument(raw) {
  return Boolean(raw && Array.isArray(raw.workspaces) && raw.workspaces.length);
}

async function readMeta(db) {
  const meta = await kvGet(db, KV_META);
  return meta && typeof meta === 'object' ? { ...emptyPersistMeta(), ...meta } : emptyPersistMeta();
}

export async function loadRawDocument() {
  let mediaMigration = { copied: 0, skipped: true };
  try {
    mediaMigration = await migrateLegacyMediaBlobs();
  } catch {
    /* keep going — graph migrate must not fail because of blobs */
  }

  const fromIdb = await withAppDb(async (db) => {
    const raw = await kvGet(db, KV_DOCUMENT);
    const meta = await readMeta(db);
    return { raw, meta };
  });

  if (mediaMigration && !fromIdb.meta.migratedMediaV1) {
    fromIdb.meta = { ...fromIdb.meta, migratedMediaV1: true };
    try {
      await withAppDb((db) => kvPut(db, KV_META, fromIdb.meta));
    } catch {
      /* ignore */
    }
  }

  if (isValidRawDocument(fromIdb.raw)) {
    markMigratedFlag();
    clearLegacyGraphKeys();
    return { raw: fromIdb.raw, meta: fromIdb.meta, source: 'idb' };
  }

  const fromLs = readLocalStorageDocument();
  if (fromLs) {
    return { raw: fromLs, meta: fromIdb.meta, source: 'localStorage' };
  }

  return { raw: null, meta: fromIdb.meta, source: 'empty' };
}

export async function saveWorkspaceDocument(document) {
  const metaPatch = {
    lastSavedAt: new Date().toISOString(),
    lastError: null,
  };
  try {
    const meta = await withAppDb(async (db) => {
      const prev = await readMeta(db);
      const next = { ...prev, ...metaPatch };
      await kvPut(db, KV_DOCUMENT, document);
      await kvPut(db, KV_META, next);
      return next;
    });
    markMigratedFlag();
    return { ok: true, meta };
  } catch (error) {
    const lastError = persistErrorMessage(error);
    let meta = { ...emptyPersistMeta(), lastError };
    try {
      meta = await withAppDb(async (db) => {
        const prev = await readMeta(db);
        const next = { ...prev, lastError };
        await kvPut(db, KV_META, next);
        return next;
      });
    } catch {
      /* ignore secondary meta write */
    }
    return { ok: false, meta, error };
  }
}

export async function requestPersistentStorage() {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) {
      return { persisted: false, supported: false };
    }
    const already = navigator.storage.persisted ? await navigator.storage.persisted() : false;
    if (already) return { persisted: true, supported: true };
    const persisted = await navigator.storage.persist();
    return { persisted, supported: true };
  } catch {
    return { persisted: false, supported: true };
  }
}

export async function estimateStorage() {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
    const estimate = await navigator.storage.estimate();
    return {
      usage: Number(estimate?.usage) || 0,
      quota: Number(estimate?.quota) || 0,
    };
  } catch {
    return null;
  }
}

export function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${Math.round(n)} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = n / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
}
