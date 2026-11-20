import { collectReferencedFileIds } from '@/lib/fileRefs';
import { normalizeBackgroundArt } from '@/lib/backgroundArt';
import { getBlobRecord, putBlob } from '@/lib/mediaStore';
import {
  applyFileIdMap,
  BACKUP_ZIP_FILES_DIR,
  BACKUP_ZIP_MANIFEST,
  buildBackupPayload,
  buildWorkspacePayload,
  filterNewWorkspaces,
  parseImportPayload,
} from '@/lib/workspaceBackupFormat';
import { createZipBlob, readZipEntries, zipEntryJson } from '@/lib/zipArchive';

function normalizeWorkspaceForCompare(workspace) {
  const terminal = workspace?.terminal && typeof workspace.terminal === 'object' ? workspace.terminal : {};
  return {
    ...workspace,
    name: workspace?.name || 'Untitled',
    colour: workspace?.colour || '#6366f1',
    icon: workspace?.icon || 'note',
    nodes: Array.isArray(workspace?.nodes) ? workspace.nodes : [],
    edges: Array.isArray(workspace?.edges) ? workspace.edges : [],
    nextZ: typeof workspace?.nextZ === 'number' ? workspace.nextZ : 1,
    terminal: {
      lines: Array.isArray(terminal.lines) ? terminal.lines.map(String) : [],
      history: Array.isArray(terminal.history) ? terminal.history.map(String) : [],
      cwdId: typeof terminal.cwdId === 'string' && terminal.cwdId ? terminal.cwdId : null,
      welcomeHidden: Boolean(terminal.welcomeHidden),
    },
    backgroundArt: normalizeBackgroundArt(workspace?.backgroundArt),
  };
}

export {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  BACKUP_ZIP_FILES_DIR,
  BACKUP_ZIP_MANIFEST,
  WORKSPACE_FORMAT,
  applyFileIdMap,
  backupFileName,
  buildBackupPayload,
  buildWorkspacePayload,
  downloadFileName,
  filterNewWorkspaces,
  isDuplicateWorkspace,
  parseImportPayload,
  workspaceContentFingerprint,
  workspaceMetaFrom,
} from '@/lib/workspaceBackupFormat';

export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      const comma = text.indexOf(',');
      resolve(comma >= 0 ? text.slice(comma + 1) : text);
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(blob);
  });
}

export function base64ToBlob(data, mime = 'application/octet-stream') {
  const raw = String(data || '');
  const payload = raw.includes(',') ? raw.slice(raw.indexOf(',') + 1) : raw;
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime || 'application/octet-stream' });
}

function bytesToHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function digestBytes(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  if (globalThis.crypto?.subtle?.digest) {
    const hash = await globalThis.crypto.subtle.digest('SHA-256', data);
    return bytesToHex(new Uint8Array(hash));
  }
  // Fallback for rare environments without SubtleCrypto.
  let h = 2166136261;
  for (let i = 0; i < data.length; i += 1) {
    h ^= data[i];
    h = Math.imul(h, 16777619);
  }
  return `fnv_${(h >>> 0).toString(16)}_${data.length}`;
}

export async function digestBlob(blob) {
  if (!blob) return 'empty';
  return digestBytes(new Uint8Array(await blob.arrayBuffer()));
}

/** Prefer real names stored on load/converter nodes when media meta is generic. */
export function collectFileNameHints(workspaces = []) {
  const hints = {};
  for (const workspace of workspaces) {
    for (const node of workspace?.nodes || []) {
      if (node?.fileId && node.fileName) hints[node.fileId] = node.fileName;
      if (node?.outputFileId && node.outputFileName) hints[node.outputFileId] = node.outputFileName;
    }
  }
  return hints;
}

function resolveExportFileName(recordName, fileId, hints) {
  const fromRecord = String(recordName || '').trim();
  const fromHint = String(hints[fileId] || '').trim();
  if (fromRecord && fromRecord !== 'file') return fromRecord;
  if (fromHint) return fromHint;
  return fromRecord || 'file';
}

export async function collectExportFiles(workspaces) {
  const ids = [...collectReferencedFileIds(workspaces)];
  const hints = collectFileNameHints(workspaces);
  const files = [];
  for (const id of ids) {
    const record = await getBlobRecord(id);
    if (!record?.blob) continue;
    const data = await blobToBase64(record.blob);
    files.push({
      id,
      name: resolveExportFileName(record.name, id, hints),
      mime: record.mime || record.blob.type || 'application/octet-stream',
      data,
    });
  }
  return files;
}

export async function collectExportFileRecords(workspaces) {
  const ids = [...collectReferencedFileIds(workspaces)];
  const hints = collectFileNameHints(workspaces);
  const files = [];
  for (const id of ids) {
    const record = await getBlobRecord(id);
    if (!record?.blob) continue;
    files.push({
      id,
      name: resolveExportFileName(record.name, id, hints),
      mime: record.mime || record.blob.type || 'application/octet-stream',
      blob: record.blob,
    });
  }
  return files;
}

export async function restoreImportedFiles(files = [], nameHints = {}) {
  const idMap = {};
  for (const file of files) {
    if (!file?.id) continue;
    let blob = file.blob;
    if (!blob && file.data) blob = base64ToBlob(file.data, file.mime);
    if (!blob) continue;
    const name = resolveExportFileName(file.name, file.id, nameHints);
    const meta = await putBlob(blob, { name, mime: file.mime });
    idMap[file.id] = meta.fileId;
  }
  return idMap;
}

export async function buildFileDigestMapFromRecords(files = []) {
  const digests = {};
  for (const file of files) {
    if (!file?.id) continue;
    if (file.digest) {
      digests[file.id] = file.digest;
      continue;
    }
    let bytes = file.bytes;
    if (!bytes && file.blob) bytes = new Uint8Array(await file.blob.arrayBuffer());
    if (!bytes && file.data) {
      const blob = base64ToBlob(file.data, file.mime);
      bytes = new Uint8Array(await blob.arrayBuffer());
    }
    if (!bytes) continue;
    digests[file.id] = await digestBytes(bytes);
  }
  return digests;
}

export async function buildFileDigestMapForWorkspaces(workspaces = []) {
  const ids = [...collectReferencedFileIds(workspaces)];
  const digests = {};
  for (const id of ids) {
    const record = await getBlobRecord(id);
    if (!record?.blob) {
      digests[id] = `missing:${id}`;
      continue;
    }
    digests[id] = await digestBlob(record.blob);
  }
  return digests;
}

export async function packWorkspaceExport(workspace) {
  const payload = buildWorkspacePayload(workspace);
  const files = await collectExportFiles([workspace]);
  if (files.length) payload.files = files;
  return payload;
}

/** @deprecated Prefer packZipBackupExport for Settings backups. */
export async function packBackupExport(state) {
  const payload = buildBackupPayload(state);
  const files = await collectExportFiles(state?.workspaces || []);
  if (files.length) payload.files = files;
  delete payload.packaging;
  return payload;
}

export async function packZipBackupExport(state) {
  const workspaces = state?.workspaces || [];
  const files = await collectExportFileRecords(workspaces);
  const manifest = buildBackupPayload(state);
  manifest.files = files.map((file) => ({
    id: file.id,
    name: file.name,
    mime: file.mime,
    path: `${BACKUP_ZIP_FILES_DIR}${file.id}`,
  }));

  const entries = [{ name: BACKUP_ZIP_MANIFEST, data: JSON.stringify(manifest, null, 2) }];
  for (const file of files) {
    entries.push({
      name: `${BACKUP_ZIP_FILES_DIR}${file.id}`,
      data: file.blob,
    });
  }
  return createZipBlob(entries);
}

function looksLikeZip(file) {
  const name = String(file?.name || '').toLowerCase();
  const type = String(file?.type || '').toLowerCase();
  return name.endsWith('.zip') || type.includes('zip');
}

export async function parseBackupZip(blob) {
  const entries = await readZipEntries(blob);
  const manifest = zipEntryJson(entries, BACKUP_ZIP_MANIFEST);
  if (!manifest) throw new Error('Backup zip is missing backup.json');
  const parsed = parseImportPayload(manifest);
  const files = [];
  for (const meta of parsed.files.length ? parsed.files : manifest.files || []) {
    if (!meta?.id) continue;
    const path = meta.path || `${BACKUP_ZIP_FILES_DIR}${meta.id}`;
    const bytes = entries.get(path);
    if (!bytes) continue;
    files.push({
      id: meta.id,
      name: meta.name || 'file',
      mime: meta.mime || 'application/octet-stream',
      bytes,
      blob: new Blob([bytes], { type: meta.mime || 'application/octet-stream' }),
      digest: await digestBytes(bytes),
    });
  }
  // Also pick up any files/* entries not listed (forward compatible).
  for (const [path, bytes] of entries.entries()) {
    if (!path.startsWith(BACKUP_ZIP_FILES_DIR) || path === BACKUP_ZIP_FILES_DIR) continue;
    const id = path.slice(BACKUP_ZIP_FILES_DIR.length);
    if (!id || files.some((f) => f.id === id)) continue;
    files.push({
      id,
      name: id,
      mime: 'application/octet-stream',
      bytes,
      blob: new Blob([bytes]),
      digest: await digestBytes(bytes),
    });
  }
  return { kind: 'backup', workspaces: parsed.workspaces, files };
}

export async function prepareImportedWorkspaces(data) {
  const parsed = parseImportPayload(data);
  const nameHints = collectFileNameHints(parsed.workspaces);
  const idMap = await restoreImportedFiles(parsed.files, nameHints);
  const workspaces = applyFileIdMap(parsed.workspaces, idMap).map((workspace) =>
    syncNodeFileNamesFromHints(workspace, parsed.files, idMap)
  );
  return {
    kind: parsed.kind,
    workspaces,
    skipped: 0,
  };
}

/** If a node lost fileName but the pack still has it, write it back onto the node. */
function syncNodeFileNamesFromHints(workspace, files, idMap) {
  if (!workspace?.nodes?.length) return workspace;
  const nameByOldId = {};
  for (const file of files || []) {
    if (file?.id && file.name) nameByOldId[file.id] = file.name;
  }
  const reverse = {};
  for (const [oldId, newId] of Object.entries(idMap || {})) reverse[newId] = oldId;

  let changed = false;
  const nodes = workspace.nodes.map((node) => {
    if (!node) return node;
    let next = node;
    if (node.fileId && !node.fileName) {
      const oldId = reverse[node.fileId] || node.fileId;
      const name = nameByOldId[oldId];
      if (name) {
        next = { ...next, fileName: name };
        changed = true;
      }
    }
    if (node.outputFileId && !node.outputFileName) {
      const oldId = reverse[node.outputFileId] || node.outputFileId;
      const name = nameByOldId[oldId];
      if (name) {
        next = { ...next, outputFileName: name };
        changed = true;
      }
    }
    return next;
  });
  return changed ? { ...workspace, nodes } : workspace;
}

/**
 * Import a backup zip (or legacy JSON backup / workspace), skipping workspaces that
 * already exist with the exact same name and contents (including loaded file bytes).
 */
export async function prepareBackupImport(fileOrData, existingWorkspaces = []) {
  let parsed;
  if (typeof Blob !== 'undefined' && fileOrData instanceof Blob) {
    if (looksLikeZip(fileOrData)) {
      parsed = await parseBackupZip(fileOrData);
    } else {
      const text = await fileOrData.text();
      parsed = parseImportPayload(JSON.parse(text));
      // Upgrade base64 file entries with digests for duplicate detection.
      const enriched = [];
      for (const file of parsed.files) {
        if (!file?.id || !file.data) continue;
        const blob = base64ToBlob(file.data, file.mime);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        enriched.push({
          ...file,
          blob,
          bytes,
          digest: await digestBytes(bytes),
        });
      }
      parsed = { ...parsed, files: enriched };
    }
  } else {
    parsed = parseImportPayload(fileOrData);
  }

  const incomingDigests = await buildFileDigestMapFromRecords(parsed.files);
  const existingDigests = await buildFileDigestMapForWorkspaces(existingWorkspaces);
  const incomingNormalized = parsed.workspaces.map(normalizeWorkspaceForCompare);
  const existingNormalized = existingWorkspaces.map(normalizeWorkspaceForCompare);
  const freshNormalized = filterNewWorkspaces(
    incomingNormalized,
    existingNormalized,
    incomingDigests,
    existingDigests
  );
  // Preserve original incoming objects (pre-normalize) for the ones that survived.
  const fresh = parsed.workspaces.filter((ws, index) =>
    freshNormalized.includes(incomingNormalized[index])
  );
  const skipped = parsed.workspaces.length - fresh.length;

  const neededIds = collectReferencedFileIds(fresh);
  const filesToRestore = (parsed.files || []).filter((file) => neededIds.has(file.id));
  const nameHints = collectFileNameHints(fresh);
  const idMap = await restoreImportedFiles(filesToRestore, nameHints);

  return {
    kind: parsed.kind,
    workspaces: applyFileIdMap(fresh, idMap).map((workspace) =>
      syncNodeFileNamesFromHints(workspace, filesToRestore, idMap)
    ),
    skipped,
    total: parsed.workspaces.length,
  };
}
