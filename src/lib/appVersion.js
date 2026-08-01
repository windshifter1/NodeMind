import versionInfo from '../../version.json';
import { formatVersionReport, VERSION_HELP_LINES, VERSION_BUMP_CLI_HINT } from './versioning/messages.js';

function gitMeta(key, fallback = 'unavailable') {
  try {
    if (key === 'commit' && typeof __NODEMIND_GIT_COMMIT__ !== 'undefined') {
      return __NODEMIND_GIT_COMMIT__ || fallback;
    }
    if (key === 'branch' && typeof __NODEMIND_GIT_BRANCH__ !== 'undefined') {
      return __NODEMIND_GIT_BRANCH__ || fallback;
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

/** Runtime version info. Version/build come from version.json; Git meta is injected at Vite startup. */
export function getAppVersionInfo() {
  return {
    version: versionInfo.version,
    build: versionInfo.build,
    commit: gitMeta('commit'),
    branch: gitMeta('branch'),
  };
}

export function getVersionReportLines() {
  return formatVersionReport(getAppVersionInfo());
}

export function getVersionHelpLines() {
  return [...VERSION_HELP_LINES];
}

export function getVersionBumpHintLines() {
  return [...VERSION_BUMP_CLI_HINT];
}
