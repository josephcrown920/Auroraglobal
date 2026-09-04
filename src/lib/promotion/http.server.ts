// Outbound HTTP helpers for Promotion platform adapters.
// Server-only: every call goes through a strict per-platform host allow-list
// and a hard timeout, and never throws raw provider errors at the caller.

const DEFAULT_TIMEOUT_MS = 12_000;

export class HostNotAllowedError extends Error {
  constructor(url: string) {
    super(`Blocked outbound host for promotion fetch: ${new URL(url).hostname}`);
    this.name = "HostNotAllowedError";
  }
}

/** Throws unless the URL is https and its host is on the allow-list. */
export function assertAllowedHost(url: string, allowedHosts: readonly string[]): void {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new HostNotAllowedError("http://invalid.invalid");
  }
  const ok =
    u.protocol === "https:" &&
    allowedHosts.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));
  if (!ok) throw new HostNotAllowedError(url);
}

export interface FetchJsonOutcome {
  ok: boolean;
  status: number;
  json: unknown;
  /** Short body excerpt for diagnostics (never surfaced raw to users). */
  excerpt: string;
}

const MAX_REDIRECT_HOPS = 3;

/**
 * Fetch with manual redirect handling. Redirects are followed hop-by-hop and
 * EVERY hop is re-validated against the same allow-list, so an approved host
 * can never bounce a request to an internal or unapproved address.
 */
async function fetchValidated(
  url: string,
  allowedHosts: readonly string[],
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  assertAllowedHost(url, allowedHosts);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    let current = url;
    for (let hop = 0; ; hop++) {
      const res = await fetch(current, { ...init, signal: ctrl.signal, redirect: "manual" });
      const location = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && location) {
        await res.arrayBuffer().catch(() => {}); // drain & discard the redirect body
        if (hop >= MAX_REDIRECT_HOPS) {
          throw new Error(`Too many redirects fetching ${new URL(url).hostname}`);
        }
        const next = new URL(location, current).toString();
        assertAllowedHost(next, allowedHosts);
        current = next;
        continue;
      }
      return res;
    }
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson(
  url: string,
  allowedHosts: readonly string[],
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<FetchJsonOutcome> {
  const res = await fetchValidated(url, allowedHosts, init, timeoutMs);
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    // HTML error pages etc. — excerpt below is enough.
  }
  return {
    ok: res.ok,
    status: res.status,
    json,
    excerpt: text.slice(0, 200),
  };
}

export async function fetchText(
  url: string,
  allowedHosts: readonly string[],
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<{ ok: boolean; status: number; text: string }> {
  const res = await fetchValidated(url, allowedHosts, init, timeoutMs);
  const text = await res.text();
  return { ok: res.ok, status: res.status, text: text.slice(0, 200_000) };
}

/** Numeric coercion that never returns NaN/undefined-shaped junk. */
export function num(value: unknown): number | undefined {
  const n = typeof value === "string" ? Number(value) : (value as number);
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
}

export function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}
