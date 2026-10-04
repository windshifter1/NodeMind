import { remapWorkspaceFileIds } from './fileRefs.js';

export const WORKSPACE_FORMAT = 'nodemind-workspace';
export const BACKUP_FORMAT = 'nodemind-backup';
export const BACKUP_VERSION = 2;
export const BACKUP_ZIP_MANIFEST = 'backup.json';
export const BACKUP_ZIP_FILES_DIR = 'files/';

export function workspaceMetaFrom(workspace = {}) {
  return {
    name: workspace.name,
    colour: workspace.colour,
    icon: workspace.icon,
    orientation: workspace.orientation,
    layoutOnOrientationChange: workspace.layoutOnOrientationChange,
    layoutSettings: workspace.layoutSettings,
  };
}

export function buildWorkspacePayload(workspace) {
  return {
    format: WORKSPACE_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    workspace: workspaceMetaFrom(workspace),
    nodes: workspace.nodes || [],
    edges: workspace.edges || [],
    nextZ: workspace.nextZ,
    terminal: workspace.terminal,
    backgroundArt: workspace.backgroundArt,
  };
}

export function buildBackupPayload(state) {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    packaging: 'zip',
    exportedAt: new Date().toISOString(),
    activeId: state?.activeId || null,
    workspaces: Array.isArray(state?.workspaces) ? state.workspaces : [],
  };
}

export function parseImportPayload(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Unrecognized NodeMind file');
  }

  if (data.format === BACKUP_FORMAT || (Array.isArray(data.workspaces) && !data.nodes)) {
    const workspaces = (data.workspaces || []).filter((ws) => ws && typeof ws === 'object');
    if (!workspaces.length) throw new Error('Backup contains no workspaces');
    return { kind: 'backup', workspaces, files: Array.isArray(data.files) ? data.files : [] };
  }

  if (data.format === WORKSPACE_FORMAT || Array.isArray(data.nodes)) {
    const meta = data.workspace && typeof data.workspace === 'object' ? data.workspace : {};
    return {
      kind: 'workspace',
      workspaces: [
        {
          ...meta,
          nodes: data.nodes,
          edges: data.edges,
          nextZ: data.nextZ,
          terminal: data.terminal ?? meta.terminal,
          backgroundArt: data.backgroundArt ?? meta.backgroundArt,
        },
      ],
      files: Array.isArray(data.files) ? data.files : [],
    };
  }

  throw new Error('Unrecognized NodeMind file');
}

export function applyFileIdMap(workspaces, idMap) {
  return (workspaces || []).map((workspace) => remapWorkspaceFileIds(workspace, idMap));
}

/** Stable JSON for equality checks (sorted object keys). */
export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys
    .filter((key) => value[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
}

function rewriteFileIdsInValue(value, digestByFileId) {
  if (Array.isArray(value)) {
    return value.map((item) => rewriteFileIdsInValue(item, digestByFileId));
  }
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [key, child] of Object.entries(value)) {
    if ((key === 'fileId' || key === 'outputFileId') && typeof child === 'string') {
      out[key] = digestByFileId[child] || `missing:${child}`;
    } else {
      out[key] = rewriteFileIdsInValue(child, digestByFileId);
    }
  }
  return out;
}

/**
 * Content fingerprint for duplicate detection.
 * Ignores workspace id; substitutes file digests for file ids so remapped imports match.
 */
export function workspaceContentFingerprint(workspace, digestByFileId = {}) {
  const content = {
    colour: workspace?.colour ?? null,
    icon: workspace?.icon ?? null,
    orientation: workspace?.orientation ?? null,
    layoutOnOrientationChange: workspace?.layoutOnOrientationChange ?? null,
    layoutSettings: workspace?.layoutSettings ?? null,
    nodes: workspace?.nodes || [],
    edges: workspace?.edges || [],
    nextZ: workspace?.nextZ ?? null,
    terminal: workspace?.terminal ?? null,
    backgroundArt: workspace?.backgroundArt ?? null,
  };
  return stableStringify(rewriteFileIdsInValue(content, digestByFileId));
}

export function workspaceNamesEqual(a, b) {
  return String(a || '') === String(b || '');
}

export function isDuplicateWorkspace(incoming, existing, incomingDigests, existingDigests) {
  if (!workspaceNamesEqual(incoming?.name, existing?.name)) return false;
  return (
    workspaceContentFingerprint(incoming, incomingDigests) ===
    workspaceContentFingerprint(existing, existingDigests)
  );
}

export function filterNewWorkspaces(incoming = [], existing = [], incomingDigests = {}, existingDigests = {}) {
  return incoming.filter(
    (ws) => !existing.some((ex) => isDuplicateWorkspace(ws, ex, incomingDigests, existingDigests))
  );
}

export function downloadFileName(name, fallback = 'workspace') {
  const stem = String(name || fallback).replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || fallback;
  return `${stem}.json`;
}

export function backupFileName(date = new Date()) {
  const stamp = date.toISOString().slice(0, 10);
  return `NodeMind_backup_${stamp}.zip`;
}
