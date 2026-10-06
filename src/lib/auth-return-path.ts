/**
 * Search params for a sign-in redirect that returns the user to the page they
 * were on — including query string and hash (e.g. /video-agent-edit?id=…).
 * Client-only: returns undefined during SSR, when the location fails the
 * open-redirect validation, or on "/" (where the default destination is right).
 */
export function authNextSearch(): { next: string } | undefined {
  if (typeof window === "undefined") return undefined;
  // Route guards fire again while the router finishes a redirect (see
  // isAuthRedirectInFlight). Once the URL already reads /auth, the page
  // itself must never become the return path (/auth?next=/auth?next=…);
  // instead re-use the `next` the first redirect already put in the URL, so
  // a repeat navigate({ to: "/auth", search: authNextSearch() }) from any of
  // the ~40 inline route guards keeps the destination instead of wiping it.
  if (isAuthRedirectInFlight()) {
    const current = new URLSearchParams(window.location.search).get("next");
    const kept = current === null ? undefined : safeAuthReturnPath(current);
    return kept && kept !== "/" ? { next: kept } : undefined;
  }
  const next = safeAuthReturnPath(
    `${window.location.pathname}${window.location.search}${window.location.hash}`,
  );
  return next && next !== "/" ? { next } : undefined;
}

/**
 * True once the router has already been pointed at /auth. The root layout
 * keys its route wrapper on the pathname, so as soon as a guard redirects,
 * the still-pending page remounts and the guard's effect runs a second time
 * while the URL already reads /auth. A guard that navigates again at that
 * point replaces `/auth?next=…` with a bare `/auth` and loses the return
 * path — so guards must skip the navigation entirely when this is true.
 * Client-only: false during SSR.
 */
export function isAuthRedirectInFlight(): boolean {
  return typeof window !== "undefined" && window.location.pathname === "/auth";
}

/**
 * Split a validated internal return path into the pieces TanStack Router's
 * navigate() expects. Router `to` is a pathname only — query and hash must be
 * passed separately or they get glued onto the pathname and fail to match.
 */
export function parseAuthReturnPath(value: string): {
  pathname: string;
  search: Record<string, string | string[]>;
  hash: string;
} {
  const url = new URL(value, "http://internal.invalid");
  const search: Record<string, string | string[]> = {};
  url.searchParams.forEach((v, k) => {
    const existing = search[k];
    if (existing === undefined) search[k] = v;
    else if (Array.isArray(existing)) existing.push(v);
    else search[k] = [existing, v];
  });
  return { pathname: url.pathname, search, hash: url.hash.replace(/^#/, "") };
}

export function safeAuthReturnPath(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.startsWith("/")) {
    return undefined;
  }

  let decoded = value;
  try {
    // Browsers and routers can preserve encoded delimiters in search values.
    // Decode repeatedly so `%5C` and double-encoded variants are rejected too.
    for (let index = 0; index < 4; index += 1) {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    }
  } catch {
    return undefined;
  }

  if (decoded.includes("\\")) return undefined;

  // Resolve against a fixed local origin so protocol-relative or otherwise
  // malformed values cannot be mistaken for an internal router path.
  const parsed = new URL(decoded, "https://aurora.local");
  return parsed.origin === "https://aurora.local"
    ? `${parsed.pathname}${parsed.search}${parsed.hash}`
    : undefined;
}