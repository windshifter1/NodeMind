/**
 * Prevents a tap-away that closes the add-node menu from immediately
 * reopening it at the tap location (window capture closes before the
 * canvas board can record that the picker was already open).
 */

let suppressUntil = 0;

export function suppressNodePickerOpen(ms = 400) {
  const until = performance.now() + Math.max(0, ms);
  if (until > suppressUntil) suppressUntil = until;
}

export function shouldSuppressNodePickerOpen() {
  return performance.now() < suppressUntil;
}

/** Returns true once while suppression is active, then clears it. */
export function consumeNodePickerOpenSuppressed() {
  if (performance.now() >= suppressUntil) return false;
  suppressUntil = 0;
  return true;
}
