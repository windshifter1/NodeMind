import { collectReferencedFileIds } from '@/lib/fileRefs';
import { getBlobRecord, putBlob } from '@/lib/mediaStore';
import {
  applyFileIdMap,
  buildBackupPayload,
  buildWorkspacePayload,
  parseImportPayload,
} from '@/lib/workspaceBackupFormat';

export {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  WORKSPACE_FORMAT,
  applyFileIdMap,
  backupFileName,
  buildBackupPayload,
  buildWorkspacePayload,
  downloadFileName,
  parseImportPayload,
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

export async function collectExportFiles(workspaces) {
  const ids = [...collectReferencedFileIds(workspaces)];
  const files = [];
  for (const id of ids) {
    const record = await getBlobRecord(id);
    if (!record?.blob) continue;
    const data = await blobToBase64(record.blob);
    files.push({
      id,
      name: record.name || 'file',
      mime: record.mime || record.blob.type || 'application/octet-stream',
      data,
    });
  }
  return files;
}

export async function restoreImportedFiles(files = []) {
  const idMap = {};
  for (const file of files) {
    if (!file?.id || !file.data) continue;
    const blob = base64ToBlob(file.data, file.mime);
    const meta = await putBlob(blob, { name: file.name, mime: file.mime });
    idMap[file.id] = meta.fileId;
  }
  return idMap;
}

export async function packWorkspaceExport(workspace) {
  const payload = buildWorkspacePayload(workspace);
  const files = await collectExportFiles([workspace]);
  if (files.length) payload.files = files;
  return payload;
}

export async function packBackupExport(state) {
  const payload = buildBackupPayload(state);
  const files = await collectExportFiles(state?.workspaces || []);
  if (files.length) payload.files = files;
  return payload;
}

export async function prepareImportedWorkspaces(data) {
  const parsed = parseImportPayload(data);
  const idMap = await restoreImportedFiles(parsed.files);
  return {
    kind: parsed.kind,
    workspaces: applyFileIdMap(parsed.workspaces, idMap),
  };
}
