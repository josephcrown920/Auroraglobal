/**
 * Search params for a sign-in redirect that returns the user to the page they
 * were on — including query string and hash (e.g. /video-agent-edit?id=…).
 * Client-only: returns undefined during SSR, when the location fails the
 * open-redirect validation, or on "/" (where the default destination is right).
 */
export function authNextSearch(): { next: string } | undefined {
  if (typeof window === "undefined") return undefined;
  // Route guards can briefly remain mounted while the router finishes a
  // redirect. Once the destination is already /auth, using it as the next
  // value would turn /admin → /auth?next=/admin into a nested auth redirect.
  if (window.location.pathname === "/auth") return undefined;
  const next = safeAuthReturnPath(
    `${window.location.pathname}${window.location.search}${window.location.hash}`,
  );
  return next && next !== "/" ? { next } : undefined;
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