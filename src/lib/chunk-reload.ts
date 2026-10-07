const KEY = 'innowiut:chunk-reload-at';

/** True when an error means a lazily loaded file from an older deploy is gone. */
export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported|Unable to preload CSS/i.test(
    message,
  );
}

/**
 * Reloads the page once to pick up the latest deploy. Returns false (and does nothing)
 * when it already reloaded in the last minute, so a real outage cannot cause a loop.
 */
export function reloadOnceForNewVersion(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}
