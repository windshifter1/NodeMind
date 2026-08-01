#!/usr/bin/env node
/**
 * NodeMind version CLI — single entry for show / help / bump / build increment.
 *
 * Usage:
 *   node scripts/version.mjs
 *   node scripts/version.mjs help
 *   node scripts/version.mjs bump
 *   node scripts/version.mjs bump patch|minor|major
 *   node scripts/version.mjs bump revert-patch|revert-minor|revert-major
 *   node scripts/version.mjs bump-build   (used by the pre-commit hook)
 */

import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import {
  VERSION_CHANGE_KINDS,
  bumpBuildNumber,
  bumpVersion,
  getHelpLines,
  getVersionReport,
  readVersion,
} from './lib/version-core.mjs';

function printLines(lines) {
  for (const line of lines) console.log(line);
}

function normalizeChangeKind(raw) {
  const value = String(raw || '').trim().toLowerCase();
  const aliases = {
    '1': 'patch',
    patch: 'patch',
    p: 'patch',
    '2': 'minor',
    minor: 'minor',
    n: 'minor',
    '3': 'major',
    major: 'major',
    m: 'major',
    '4': 'revert-patch',
    'revert patch': 'revert-patch',
    'revert-patch': 'revert-patch',
    '5': 'revert-minor',
    'revert minor': 'revert-minor',
    'revert-minor': 'revert-minor',
    '6': 'revert-major',
    'revert major': 'revert-major',
    'revert-major': 'revert-major',
    '7': 'none',
    none: 'none',
    esc: 'none',
    escape: 'none',
    cancel: 'none',
    q: 'none',
    quit: 'none',
    '': 'none',
  };
  return aliases[value] || null;
}

async function promptBumpKind() {
  const rl = readline.createInterface({ input, output });
  try {
    console.log('');
    console.log('Select version bump type:');
    console.log('');
    console.log('1. Patch');
    console.log('2. Minor');
    console.log('3. Major');
    console.log('4. Revert patch');
    console.log('5. Revert minor');
    console.log('6. Revert major');
    console.log('7. None (esc)');
    console.log('');
    const answer = (await rl.question('Enter choice: ')).trim().toLowerCase();
    const kind = normalizeChangeKind(answer);
    if (!kind) {
      throw new Error(
        `Invalid choice "${answer}". Expected 1–7 (or patch/minor/major/revert-*/none).`
      );
    }
    return kind;
  } finally {
    rl.close();
  }
}

function reportChange(before, after, kind) {
  const label = kind.startsWith('revert-')
    ? `Reverted ${kind.replace('revert-', '')}`
    : `Bumped ${kind}`;
  printLines([
    `${label}: ${before.version} → ${after.version}`,
    `Build unchanged: ${after.build}`,
    '',
    ...getVersionReport(),
  ]);
}

async function main(argv) {
  const [command, arg] = argv;

  if (!command) {
    printLines(getVersionReport());
    return;
  }

  if (command === 'help' || command === '--help' || command === '-h') {
    printLines(getHelpLines());
    return;
  }

  if (command === 'bump-build') {
    const before = readVersion();
    const after = bumpBuildNumber();
    printLines([
      `Build incremented: ${before.build} → ${after.build}`,
      `Version unchanged: ${after.version}`,
    ]);
    return;
  }

  if (command === 'bump') {
    const kind = arg ? normalizeChangeKind(arg) : await promptBumpKind();
    if (!kind) {
      throw new Error(
        `Unknown bump type "${arg}". Use patch, minor, major, revert-patch, revert-minor, revert-major, or none.`
      );
    }
    if (kind === 'none') {
      printLines(['No version change.']);
      return;
    }
    if (!VERSION_CHANGE_KINDS.includes(kind)) {
      throw new Error(`Unknown bump type "${arg}".`);
    }
    const before = readVersion();
    const after = bumpVersion(kind);
    reportChange(before, after, kind);
    return;
  }

  throw new Error(`Unknown command "${command}". Try: node scripts/version.mjs help`);
}

main(process.argv.slice(2)).catch((error) => {
  console.error(`Error: ${error.message || error}`);
  process.exitCode = 1;
});
