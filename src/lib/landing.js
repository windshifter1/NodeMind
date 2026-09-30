const SEEN_KEY = 'nodemind-landing-seen-v1';
const ALWAYS_KEY = 'nodemind-landing-always-v1';

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

/** First visit, or permanently enabled in Settings. */
export function shouldShowLanding() {
  return readLandingAlways() || !readLandingSeen();
}

export function dismissLanding() {
  setLandingSeen(true);
}
