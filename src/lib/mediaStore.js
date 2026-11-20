/** IndexedDB blob store for PDFs, images, and workspace background art. MIT-friendly, no deps. */

import {
  blobDelete,
  blobGet,
  blobGetAllKeys,
  blobPut,
  withAppDb,
} from '@/lib/idb';

function uid() {
  return `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function putBlob(blob, meta = {}) {
  const id = meta.id || uid();
  const record = {
    id,
    blob,
    name: meta.name || 'file',
    mime: meta.mime || blob.type || 'application/octet-stream',
    size: blob.size ?? 0,
    createdAt: meta.createdAt || new Date().toISOString(),
  };
  await withAppDb((db) => blobPut(db, record));
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
  return withAppDb((db) => blobGet(db, fileId));
}

export async function getBlobUrl(fileId) {
  const record = await getBlobRecord(fileId);
  if (!record?.blob) return null;
  return URL.createObjectURL(record.blob);
}

export async function deleteBlob(fileId) {
  if (!fileId) return;
  await withAppDb((db) => blobDelete(db, fileId));
}

export async function listBlobIds() {
  const keys = await withAppDb((db) => blobGetAllKeys(db));
  return (keys || []).map((key) => String(key));
}

export async function sweepOrphanBlobs(liveIds) {
  const live = liveIds instanceof Set ? liveIds : new Set(liveIds || []);
  const stored = await listBlobIds();
  const orphans = stored.filter((id) => !live.has(id));
  for (const id of orphans) {
    try {
      await deleteBlob(id);
    } catch {
      /* keep going */
    }
  }
  return orphans;
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
