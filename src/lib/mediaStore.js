/** IndexedDB blob store for PDFs, images, and workspace background art. MIT-friendly, no deps. */

const DB_NAME = 'nodemind-media-v1';
const STORE = 'blobs';
const DB_VERSION = 1;

function ensureStore(db) {
  if (!db.objectStoreNames.contains(STORE)) {
    db.createObjectStore(STORE, { keyPath: 'id' });
  }
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => ensureStore(req.result);
    req.onsuccess = () => {
      const db = req.result;
      if (db.objectStoreNames.contains(STORE)) {
        resolve(db);
        return;
      }
      const next = db.version + 1;
      db.close();
      const retry = indexedDB.open(DB_NAME, next);
      retry.onupgradeneeded = () => ensureStore(retry.result);
      retry.onsuccess = () => resolve(retry.result);
      retry.onerror = () => reject(retry.error || new Error('IndexedDB upgrade failed'));
    };
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
  });
}

function uid() {
  return `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function putBlob(blob, meta = {}) {
  const db = await openDb();
  const id = meta.id || uid();
  const record = {
    id,
    blob,
    name: meta.name || 'file',
    mime: meta.mime || blob.type || 'application/octet-stream',
    size: blob.size ?? 0,
    createdAt: meta.createdAt || new Date().toISOString(),
  };
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  return {
    fileId: id,
    name: record.name,
    mime: record.mime,
    size: record.size,
    createdAt: record.createdAt,
  };
}

export async function getBlobRecord(fileId) {
  if (!fileId) return null;
  const db = await openDb();
  const record = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(fileId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return record;
}

export async function getBlobUrl(fileId) {
  const record = await getBlobRecord(fileId);
  if (!record?.blob) return null;
  return URL.createObjectURL(record.blob);
}

export async function deleteBlob(fileId) {
  if (!fileId) return;
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(fileId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function putFileFromFileList(file) {
  if (!file) throw new Error('No file');
  return putBlob(file, { name: file.name, mime: file.type || guessMime(file.name) });
}

function guessMime(name = '') {
  const lower = name.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.json')) return 'application/json';
  if (lower.endsWith('.csv')) return 'text/csv';
  if (lower.endsWith('.md')) return 'text/markdown';
  if (lower.endsWith('.js')) return 'text/javascript';
  if (lower.endsWith('.ts')) return 'text/typescript';
  if (lower.endsWith('.jsx')) return 'text/javascript';
  if (lower.endsWith('.tsx')) return 'text/typescript';
  if (lower.endsWith('.py')) return 'text/x-python';
  if (lower.endsWith('.css')) return 'text/css';
  if (lower.endsWith('.html')) return 'text/html';
  if (lower.endsWith('.txt')) return 'text/plain';
  return 'application/octet-stream';
}

export function languageFromName(name = '', mime = '') {
  const lower = String(name).toLowerCase();
  if (lower.endsWith('.js') || lower.endsWith('.jsx') || mime.includes('javascript')) return 'javascript';
  if (lower.endsWith('.ts') || lower.endsWith('.tsx')) return 'typescript';
  if (lower.endsWith('.py')) return 'python';
  if (lower.endsWith('.css')) return 'css';
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'markup';
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.md')) return 'markdown';
  if (lower.endsWith('.svg')) return 'markup';
  if (lower.endsWith('.csv')) return 'plain';
  return 'plain';
}

export function isImageMime(mime = '') {
  return String(mime).startsWith('image/');
}

export function isPdfMime(mime = '', name = '') {
  return mime === 'application/pdf' || String(name).toLowerCase().endsWith('.pdf');
}

export function isCodeLike(mime = '', name = '') {
  const lang = languageFromName(name, mime);
  return lang !== 'plain' || mime.startsWith('text/') || mime === 'application/json';
}
