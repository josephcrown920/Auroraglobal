/**
 * Stale-build (chunk load) failure detection + one-shot recovery.
 *
 * When the server redeploys — or the dev server restarts — while a client is
 * open, the lazy route chunks referenced by the running page no longer exist
 * on the server. The next navigation then fails with a dynamic-import error
 * and, without handling, the user is stuck on a dead page until they manually
 * refresh. These helpers classify that failure and drive a guarded,
 * loop-proof automatic reload (used by the router's default error component).
 *
 * Pure + dependency-injected so the guard logic is unit-testable under bun.
 */

export const STALE_CHUNK_PATTERN =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk [\w-]* failed|Unable to preload CSS|'text\/html' is not a valid JavaScript MIME type/i;

export function isStaleChunkError(error: unknown): boolean {
  if (!error) return false;
  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === "string"
        ? error
        : String((error as { message?: unknown })?.message ?? "");
  return STALE_CHUNK_PATTERN.test(message);
}

const GUARD_PREFIX = "aurora:stale-chunk-reload:";

/** A second reload for the same path within this window is refused (loop guard). */
export const RELOAD_GUARD_TTL_MS = 30_000;

export type ReloadDeps = {
  storage?: Pick<Storage, "getItem" | "setItem"> | undefined;
  now?: () => number;
  reload?: () => void;
};

/**
 * Reload the page at most once per pathname per TTL window.
 * Returns true when a reload was triggered; false when the guard refused —
 * either we already reloaded this path moments ago (a reload didn't fix it,
 * so looping won't either) or storage is unavailable (never reload blindly).
 */
export function reloadOnceForStaleChunk(pathname: string, deps: ReloadDeps = {}): boolean {
  const storage =
    deps.storage !== undefined
      ? deps.storage
      : typeof sessionStorage !== "undefined"
        ? sessionStorage
        : undefined;
  const now = deps.now ?? Date.now;
  const reload = deps.reload ?? (() => window.location.reload());
  if (!storage) return false;
  const key = GUARD_PREFIX + pathname;
  try {
    const last = Number(storage.getItem(key) ?? 0);
    if (Number.isFinite(last) && last > 0 && now() - last < RELOAD_GUARD_TTL_MS) {
      return false;
    }
    storage.setItem(key, String(now()));
  } catch {
    return false;
  }
  reload();
  return true;
}
