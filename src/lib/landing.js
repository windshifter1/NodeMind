import { LS_MIGRATED, LS_WORKSPACES_V2 } from '@/lib/workspaceStore';

const SEEN_KEY = 'nodemind-landing-seen-v1';
const ALWAYS_KEY = 'nodemind-landing-always-v1';

/** Storage keys that imply this device already used the app before the landing page existed. */
const PRIOR_USE_KEYS = [
  LS_MIGRATED,
  LS_WORKSPACES_V2,
  'thoughts-canvas-workspaces',
  'nodemind-onboarding-completed-v1',
  'nodemind-maths-credit-seen-v1',
];

export function readLandingSeen() {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function setLandingSeen(seen = true) {
  try {
    if (seen) localStorage.setItem(SEEN_KEY, '1');
    else localStorage.removeItem(SEEN_KEY);
  } catch {
    /* ignore */
  }
}

export function readLandingAlways() {
  try {
    return localStorage.getItem(ALWAYS_KEY) === '1';
  } catch {
    return false;
  }
}

export function setLandingAlways(always = true) {
  try {
    if (always) localStorage.setItem(ALWAYS_KEY, '1');
    else localStorage.removeItem(ALWAYS_KEY);
  } catch {
    /* ignore */
  }
}

function hasPriorAppUse() {
  try {
    return PRIOR_USE_KEYS.some((key) => {
      const value = localStorage.getItem(key);
      return value != null && value !== '';
    });
  } catch {
    return false;
  }
}

/** First visit, or permanently enabled in Settings. */
export function shouldShowLanding() {
  if (readLandingAlways()) return true;
  if (readLandingSeen()) return false;
  // Existing installs (pre-landing feature) should not get a surprise splash.
  if (hasPriorAppUse()) {
    setLandingSeen(true);
    return false;
  }
  return true;
}

export function dismissLanding() {
  setLandingSeen(true);
}
