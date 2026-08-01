import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  VERSION_HELP_LINES,
  formatVersionReport,
} from '../../src/lib/versioning/messages.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '../..');
export const VERSION_FILE = path.join(ROOT, 'version.json');

const UNAVAILABLE = 'unavailable';

function githubDesktopGitCandidates() {
  const base = path.join(os.homedir(), 'AppData', 'Local', 'GitHubDesktop');
  const found = [];
  if (!fs.existsSync(base)) return found;
  try {
    for (const entry of fs.readdirSync(base)) {
      if (!entry.startsWith('app-')) continue;
      found.push(
        path.join(base, entry, 'resources', 'app', 'git', 'cmd', 'git.exe'),
        path.join(base, entry, 'resources', 'app', 'git', 'mingw64', 'bin', 'git.exe')
      );
    }
  } catch {
    /* ignore */
  }
  // Prefer newest app-* folders last → reverse so latest is tried first.
  return found.reverse();
}

export function findGitExecutable() {
  const candidates = [
    process.env.GIT_EXECUTABLE,
    'git',
    'C:\\Program Files\\Git\\cmd\\git.exe',
    'C:\\Program Files\\Git\\bin\\git.exe',
    'C:\\Program Files (x86)\\Git\\cmd\\git.exe',
    ...githubDesktopGitCandidates(),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ['--version'], {
        stdio: ['ignore', 'pipe', 'ignore'],
        windowsHide: true,
      });
      return candidate;
    } catch {
      /* try next */
    }
  }
  return null;
}

export function runGit(args) {
  const gitExe = findGitExecutable();
  if (!gitExe) return null;
  try {
    return execFileSync(gitExe, args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    }).trim();
  } catch {
    return null;
  }
}

export function getGitInfo() {
  return {
    commit: runGit(['rev-parse', '--short', 'HEAD']) || UNAVAILABLE,
    branch: runGit(['branch', '--show-current']) || runGit(['rev-parse', '--abbrev-ref', 'HEAD']) || UNAVAILABLE,
  };
}

export function readVersion() {
  const raw = fs.readFileSync(VERSION_FILE, 'utf8');
  const data = JSON.parse(raw);
  if (typeof data.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(data.version)) {
    throw new Error(`Invalid version in ${VERSION_FILE}: ${data.version}`);
  }
  if (!Number.isInteger(data.build) || data.build < 0) {
    throw new Error(`Invalid build in ${VERSION_FILE}: ${data.build}`);
  }
  return { version: data.version, build: data.build };
}

/** Persist the central version.json source of truth. */
export function writeVersion({ version, build }) {
  const next = { version, build };
  fs.writeFileSync(VERSION_FILE, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return next;
}

export function parseSemver(version) {
  const match = String(version).match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) throw new Error(`Invalid semver: ${version}`);
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

export function bumpSemver(version, kind) {
  const parts = parseSemver(version);
  switch (kind) {
    case 'major':
      return `${parts.major + 1}.0.0`;
    case 'minor':
      return `${parts.major}.${parts.minor + 1}.0`;
    case 'patch':
      return `${parts.major}.${parts.minor}.${parts.patch + 1}`;
    case 'revert-patch':
      if (parts.patch <= 0) {
        throw new Error(`Cannot revert patch: version is already ${version}`);
      }
      return `${parts.major}.${parts.minor}.${parts.patch - 1}`;
    case 'revert-minor':
      if (parts.minor <= 0) {
        throw new Error(`Cannot revert minor: version is already ${version}`);
      }
      return `${parts.major}.${parts.minor - 1}.0`;
    case 'revert-major':
      if (parts.major <= 0) {
        throw new Error(`Cannot revert major: version is already ${version}`);
      }
      return `${parts.major - 1}.0.0`;
    default:
      throw new Error(`Unknown bump kind: ${kind}`);
  }
}

export const VERSION_CHANGE_KINDS = [
  'patch',
  'minor',
  'major',
  'revert-patch',
  'revert-minor',
  'revert-major',
];

export function bumpBuildNumber() {
  const current = readVersion();
  return writeVersion({ version: current.version, build: current.build + 1 });
}

export function bumpVersion(kind) {
  const current = readVersion();
  return writeVersion({
    version: bumpSemver(current.version, kind),
    build: current.build,
  });
}

export function getVersionReport() {
  const { version, build } = readVersion();
  const { commit, branch } = getGitInfo();
  return formatVersionReport({ version, build, commit, branch });
}

export function getHelpLines() {
  return [
    ...VERSION_HELP_LINES,
    '',
    'CLI usage (from the project root):',
    '  node scripts/version.mjs',
    '  node scripts/version.mjs help',
    '  node scripts/version.mjs bump',
    '  node scripts/version.mjs bump patch|minor|major',
    '  node scripts/version.mjs bump revert-patch|revert-minor|revert-major',
    '',
    'npm shortcuts:',
    '  npm run version:info',
    '  npm run version:bump',
    '  npm run version:bump -- patch',
  ];
}
