#!/usr/bin/env node
/**
 * Install NodeMind Git hooks so pre-commit build increments work from any client
 * (Cursor, CMD, PowerShell, VS Code, GitHub Desktop).
 *
 * Strategy:
 * 1. Set local core.hooksPath=hooks (via git, or by editing .git/config).
 * 2. Also install a fallback copy into .git/hooks/pre-commit for clients that
 *    ignore hooksPath.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, findGitExecutable, runGit } from './lib/version-core.mjs';

const hooksDir = path.join(ROOT, 'hooks');
const preCommitSrc = path.join(hooksDir, 'pre-commit');
const gitDir = path.join(ROOT, '.git');
const gitConfigPath = path.join(gitDir, 'config');
const gitHooksDir = path.join(gitDir, 'hooks');
const preCommitFallback = path.join(gitHooksDir, 'pre-commit');

function ensureHooksPathInGitConfig() {
  if (!fs.existsSync(gitConfigPath)) return false;
  let text = fs.readFileSync(gitConfigPath, 'utf8');
  if (/^\s*hooksPath\s*=/m.test(text)) {
    text = text.replace(/^\s*hooksPath\s*=\s*.*$/m, '\thooksPath = hooks');
  } else if (/^\[core\]/m.test(text)) {
    text = text.replace(/^\[core\]\s*$/m, '[core]\n\thooksPath = hooks');
  } else {
    text = `[core]\n\thooksPath = hooks\n${text}`;
  }
  fs.writeFileSync(gitConfigPath, text, 'utf8');
  return true;
}

function installFallbackHook() {
  if (!fs.existsSync(gitHooksDir)) {
    fs.mkdirSync(gitHooksDir, { recursive: true });
  }
  const source = fs.readFileSync(preCommitSrc, 'utf8');
  fs.writeFileSync(preCommitFallback, source, 'utf8');
  try {
    fs.chmodSync(preCommitFallback, 0o755);
  } catch {
    /* ignore on Windows */
  }
}

function main() {
  if (!fs.existsSync(hooksDir) || !fs.existsSync(preCommitSrc)) {
    console.warn('hooks/pre-commit missing — skipping hook install.');
    return;
  }

  if (!fs.existsSync(gitDir)) {
    console.warn('No .git directory — hooks not configured.');
    return;
  }

  try {
    fs.chmodSync(preCommitSrc, 0o755);
  } catch {
    /* ignore on Windows */
  }

  let configured = false;
  const gitExe = findGitExecutable();
  if (gitExe && runGit(['rev-parse', '--is-inside-work-tree'])) {
    try {
      execFileSync(gitExe, ['config', 'core.hooksPath', 'hooks'], {
        cwd: ROOT,
        stdio: 'inherit',
        windowsHide: true,
      });
      configured = true;
    } catch {
      /* fall through to direct config edit */
    }
  }

  if (!configured) {
    configured = ensureHooksPathInGitConfig();
  }

  installFallbackHook();

  if (!configured) {
    console.warn('Could not set core.hooksPath, but installed .git/hooks/pre-commit fallback.');
    console.warn('If builds still do not increment, run: git config core.hooksPath hooks');
    return;
  }

  console.log('Git hooks installed.');
  console.log('  core.hooksPath = hooks');
  console.log('  fallback: .git/hooks/pre-commit');
  console.log('pre-commit will increment version.json build before each commit.');
}

main();
