/** Shared IndexedDB helpers for the NodeMind app database. */

export const APP_DB_NAME = 'nodemind-app-v1';
export const APP_DB_VERSION = 1;
export const KV_STORE = 'kv';
export const BLOBS_STORE = 'blobs';

export const KV_DOCUMENT = 'document';
export const KV_META = 'meta';

const LEGACY_MEDIA_DB = 'nodemind-media-v1';
const LEGACY_BLOBS_STORE = 'blobs';

export function openAppDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(APP_DB_NAME, APP_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(KV_STORE)) {
        db.createObjectStore(KV_STORE);
      }
      if (!db.objectStoreNames.contains(BLOBS_STORE)) {
        db.createObjectStore(BLOBS_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
  });
}

function requestToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function withAppDb(fn) {
  const db = await openAppDb();
  try {
    return await fn(db);
  } finally {
    db.close();
  }
}

export function kvGet(db, key) {
  const tx = db.transaction(KV_STORE, 'readonly');
  return requestToPromise(tx.objectStore(KV_STORE).get(key));
}

export function kvPut(db, key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KV_STORE, 'readwrite');
    tx.objectStore(KV_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function blobPut(db, record) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOBS_STORE, 'readwrite');
    tx.objectStore(BLOBS_STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function blobGet(db, id) {
  const tx = db.transaction(BLOBS_STORE, 'readonly');
  return requestToPromise(tx.objectStore(BLOBS_STORE).get(id));
}

export function blobDelete(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOBS_STORE, 'readwrite');
    tx.objectStore(BLOBS_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function blobGetAll(db) {
  const tx = db.transaction(BLOBS_STORE, 'readonly');
  return requestToPromise(tx.objectStore(BLOBS_STORE).getAll());
}

export function blobGetAllKeys(db) {
  const tx = db.transaction(BLOBS_STORE, 'readonly');
  return requestToPromise(tx.objectStore(BLOBS_STORE).getAllKeys());
}

function openExistingLegacyMediaDb() {
  return new Promise((resolve) => {
    let createdFresh = false;
    const req = indexedDB.open(LEGACY_MEDIA_DB);
    req.onupgradeneeded = (event) => {
      if (event.oldVersion === 0) createdFresh = true;
    };
    req.onsuccess = () => {
      const db = req.result;
      if (createdFresh || !db.objectStoreNames.contains(LEGACY_BLOBS_STORE)) {
        db.close();
        try {
          indexedDB.deleteDatabase(LEGACY_MEDIA_DB);
        } catch {
          /* ignore */
        }
        resolve(null);
        return;
      }
      resolve(db);
    };
    req.onerror = () => resolve(null);
  });
}

/** Copy blobs from the old media-only database into the unified app DB. */
export async function migrateLegacyMediaBlobs() {
  const legacy = await openExistingLegacyMediaDb();
  if (!legacy) return { copied: 0, skipped: true };

  const records = await new Promise((resolve, reject) => {
    const tx = legacy.transaction(LEGACY_BLOBS_STORE, 'readonly');
    const req = tx.objectStore(LEGACY_BLOBS_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
  legacy.close();

  if (!records.length) {
    try {
      indexedDB.deleteDatabase(LEGACY_MEDIA_DB);
    } catch {
      /* ignore */
    }
    return { copied: 0, skipped: false };
  }

  await withAppDb(async (db) => {
    for (const record of records) {
      if (!record?.id) continue;
      const existing = await blobGet(db, record.id);
      if (!existing) await blobPut(db, record);
    }
  });

  try {
    indexedDB.deleteDatabase(LEGACY_MEDIA_DB);
  } catch {
    /* ignore */
  }
  return { copied: records.length, skipped: false };
}
