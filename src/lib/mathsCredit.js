const SEEN_KEY = 'nodemind-maths-credit-seen-v1';

export function readMathsCreditSeen() {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function setMathsCreditSeen(seen = true) {
  try {
    if (seen) localStorage.setItem(SEEN_KEY, '1');
    else localStorage.removeItem(SEEN_KEY);
  } catch {
    /* ignore */
  }
}
