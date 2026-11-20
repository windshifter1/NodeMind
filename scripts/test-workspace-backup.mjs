/**
 * Smoke-test workspace backup parse / remap / zip / duplicate helpers.
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
  filterNewWorkspaces,
  parseImportPayload,
  workspaceContentFingerprint,
} from '../src/lib/workspaceBackupFormat.js';
import { createZipBlob, readZipEntries, zipEntryJson } from '../src/lib/zipArchive.js';

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
assert(backup.packaging === 'zip', 'backup packaging');
const parsedBackup = parseImportPayload(backup);
assert(parsedBackup.kind === 'backup' && parsedBackup.workspaces.length === 1, 'parse backup');

const mapped = applyFileIdMap(parsedBackup.workspaces, { f_one: 'imported' });
assert(mapped[0].nodes[0].fileId === 'imported', 'applyFileIdMap remaps');

assert(downloadFileName('My Canvas!') === 'My_Canvas.json', 'download file name');
assert(backupFileName(new Date('2026-10-03T00:00:00.000Z')) === 'NodeMind_backup_2026-10-03.zip', 'backup file name');

const digests = { f_one: 'aaa', f_two: 'bbb', f_bg: 'ccc' };
const fp1 = workspaceContentFingerprint(workspace, digests);
const fp2 = workspaceContentFingerprint(
  remapWorkspaceFileIds(workspace, { f_one: 'x', f_two: 'y', f_bg: 'z' }),
  { x: 'aaa', y: 'bbb', z: 'ccc' }
);
assert(fp1 === fp2, 'fingerprints match across remapped file ids');

const dupFiltered = filterNewWorkspaces([workspace], [workspace], digests, digests);
assert(dupFiltered.length === 0, 'duplicate workspace should be skipped');

const renamed = { ...workspace, name: 'Other' };
assert(
  filterNewWorkspaces([renamed], [workspace], digests, digests).length === 1,
  'different name should import'
);

const changed = {
  ...workspace,
  nodes: [...workspace.nodes, { id: '9', kind: 'note', title: 'extra' }],
};
assert(
  filterNewWorkspaces([changed], [workspace], digests, digests).length === 1,
  'different contents should import'
);

let threw = false;
try {
  parseImportPayload({ hello: true });
} catch {
  threw = true;
}
assert(threw, 'unknown payload should throw');

const fileBytes = new TextEncoder().encode('hello-file');
const zipBlob = await createZipBlob([
  {
    name: 'backup.json',
    data: JSON.stringify({
      ...backup,
      files: [{ id: 'f_one', name: 'hello.txt', mime: 'text/plain', path: 'files/f_one' }],
    }),
  },
  { name: 'files/f_one', data: fileBytes },
]);
const entries = await readZipEntries(zipBlob);
const manifest = zipEntryJson(entries, 'backup.json');
assert(manifest.format === BACKUP_FORMAT, 'zip manifest readable');
assert(entries.get('files/f_one')?.length === fileBytes.length, 'zip file bytes readable');

console.log('workspace backup tests ok');
