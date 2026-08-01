#!/usr/bin/env node
/**
 * Point Git at the repo-managed hooks/ directory so pre-commit works from any client.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, findGitExecutable, runGit } from './lib/version-core.mjs';

const hooksDir = path.join(ROOT, 'hooks');
const preCommit = path.join(hooksDir, 'pre-commit');

function main() {
  if (!fs.existsSync(hooksDir) || !fs.existsSync(preCommit)) {
    console.warn('hooks/pre-commit missing — skipping hook install.');
    return;
  }

  try {
    fs.chmodSync(preCommit, 0o755);
  } catch {
    /* ignore on Windows */
  }

  const gitExe = findGitExecutable();
  if (!gitExe || !runGit(['rev-parse', '--is-inside-work-tree'])) {
    console.warn('Not a Git repository (or Git unavailable) — hooks not configured.');
    console.warn('When Git is available, run: npm run hooks:install');
    return;
  }

  try {
    execFileSync(gitExe, ['config', 'core.hooksPath', 'hooks'], {
      cwd: ROOT,
      stdio: 'inherit',
      windowsHide: true,
    });
  } catch {
    console.warn('Could not set core.hooksPath. Run manually:');
    console.warn('  git config core.hooksPath hooks');
    return;
  }

  console.log('Git hooks installed (core.hooksPath = hooks).');
  console.log('pre-commit will increment version.json build before each commit.');
}

main();
