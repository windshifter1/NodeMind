/**
 * Smoke-test workspace backup parse / remap helpers.
 * Run: node scripts/test-workspace-backup.mjs
 */
import { collectReferencedFileIds, remapWorkspaceFileIds } from '../src/lib/fileRefs.js';
import {
  BACKUP_FORMAT,
  WORKSPACE_FORMAT,
  applyFileIdMap,
  backupFileName,
  buildBackupPayload,
  buildWorkspacePayload,
  downloadFileName,
  parseImportPayload,
} from '../src/lib/workspaceBackupFormat.js';

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const workspace = {
  id: 'w_old',
  name: 'Calc',
  colour: '#6366f1',
  icon: 'note',
  nodes: [
    { id: '1', kind: 'loadFile', fileId: 'f_one' },
    { id: '2', kind: 'fileConverter', outputFileId: 'f_two' },
    { id: '3', kind: 'note', title: 'plain' },
  ],
  edges: [],
  nextZ: 4,
  backgroundArt: { images: [{ id: 'img1', fileId: 'f_bg' }] },
};

const ids = collectReferencedFileIds([workspace]);
assert(ids.size === 3, 'should collect node and background file ids');
assert(ids.has('f_one') && ids.has('f_two') && ids.has('f_bg'), 'expected file ids missing');

const remapped = remapWorkspaceFileIds(workspace, { f_one: 'f_new', f_bg: 'f_bg2' });
assert(remapped.nodes[0].fileId === 'f_new', 'node fileId should remap');
assert(remapped.nodes[1].outputFileId === 'f_two', 'unmapped ids stay');
assert(remapped.backgroundArt.images[0].fileId === 'f_bg2', 'background fileId should remap');
assert(workspace.nodes[0].fileId === 'f_one', 'remap must not mutate source');

const single = buildWorkspacePayload(workspace);
assert(single.format === WORKSPACE_FORMAT, 'workspace format');
assert(single.backgroundArt.images[0].fileId === 'f_bg', 'export keeps backgroundArt');
assert(single.workspace.name === 'Calc', 'export keeps meta name');

const parsedSingle = parseImportPayload(single);
assert(parsedSingle.kind === 'workspace', 'parse workspace kind');
assert(parsedSingle.workspaces[0].backgroundArt.images[0].fileId === 'f_bg', 'import keeps art');

const legacy = parseImportPayload({
  workspace: { name: 'Legacy' },
  nodes: [{ id: '1' }],
  edges: [],
});
assert(legacy.kind === 'workspace', 'legacy export still imports');
assert(legacy.workspaces[0].name === 'Legacy', 'legacy meta name');

const backup = buildBackupPayload({ workspaces: [workspace], activeId: 'w_old' });
assert(backup.format === BACKUP_FORMAT, 'backup format');
const parsedBackup = parseImportPayload(backup);
assert(parsedBackup.kind === 'backup' && parsedBackup.workspaces.length === 1, 'parse backup');

const mapped = applyFileIdMap(parsedBackup.workspaces, { f_one: 'imported' });
assert(mapped[0].nodes[0].fileId === 'imported', 'applyFileIdMap remaps');

assert(downloadFileName('My Canvas!') === 'My_Canvas.json', 'download file name');
assert(backupFileName(new Date('2026-10-03T00:00:00.000Z')) === 'NodeMind_backup_2026-10-03.json', 'backup file name');

let threw = false;
try {
  parseImportPayload({ hello: true });
} catch {
  threw = true;
}
assert(threw, 'unknown payload should throw');

console.log('workspace backup tests ok');
