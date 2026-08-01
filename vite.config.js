import react from '@vitejs/plugin-react';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));

function findGitExecutable() {
  const candidates = [
    process.env.GIT_EXECUTABLE,
    'git',
    'C:\\Program Files\\Git\\cmd\\git.exe',
    'C:\\Program Files\\Git\\bin\\git.exe',
    'C:\\Program Files (x86)\\Git\\cmd\\git.exe',
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

function git(args) {
  const gitExe = findGitExecutable();
  if (!gitExe) return 'unavailable';
  try {
    return execFileSync(gitExe, args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    }).trim() || 'unavailable';
  } catch {
    return 'unavailable';
  }
}

const gitCommit = git(['rev-parse', '--short', 'HEAD']);
const gitBranchCurrent = git(['branch', '--show-current']);
const gitBranch =
  gitBranchCurrent === 'unavailable' ? git(['rev-parse', '--abbrev-ref', 'HEAD']) : gitBranchCurrent;

export default defineConfig({
  base: '/NodeMind/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Version/build come only from version.json (imported by the app).
  // Git metadata is injected here because the browser cannot query Git at runtime.
  define: {
    __NODEMIND_GIT_COMMIT__: JSON.stringify(gitCommit),
    __NODEMIND_GIT_BRANCH__: JSON.stringify(gitBranch),
  },
});
