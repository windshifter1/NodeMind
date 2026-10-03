import { remapWorkspaceFileIds } from './fileRefs.js';

export const WORKSPACE_FORMAT = 'nodemind-workspace';
export const BACKUP_FORMAT = 'nodemind-backup';
export const BACKUP_VERSION = 1;

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

export function downloadFileName(name, fallback = 'workspace') {
  const stem = String(name || fallback).replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || fallback;
  return `${stem}.json`;
}

export function backupFileName(date = new Date()) {
  const stamp = date.toISOString().slice(0, 10);
  return `NodeMind_backup_${stamp}.json`;
}
