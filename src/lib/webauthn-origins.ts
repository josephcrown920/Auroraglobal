// Pure WebAuthn origin/RP policy — no server-only imports so it can be
// unit-tested directly (see webauthn-origins.test.ts).

export function getRP() {
  const siteUrl = (process.env.SITE_URL ?? "https://auroraperformancestudio.com").replace(/\/$/, "");
  const url = new URL(siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`);
  return { rpName: "Aurora Performance Studio", rpID: url.hostname, origin: url.origin };
}

/**
 * Only origins this server actually serves may run passkey ceremonies:
 * - the canonical production origin (SITE_URL)
 * - the deployment's own domains (REPLIT_DOMAINS, comma-separated)
 * - the dev preview domain (REPLIT_DEV_DOMAIN)
 * - localhost / 127.0.0.1 outside production
 *
 * Deliberately NOT wildcard *.replit.dev / *.repl.co / *.replit.app —
 * foreign Replit-hosted origins must never be trusted for passkey
 * registration or authentication.
 */
export function isAllowedOrigin(origin: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }

  const isLocalhost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  // WebAuthn only runs in secure contexts: https, or http on localhost.
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && isLocalhost)) {
    return false;
  }

  const { origin: prodOrigin, rpID: prodRPID } = getRP();
  if (parsed.origin === prodOrigin || parsed.hostname === prodRPID) return true;

  const ownDomains = [
    ...(process.env.REPLIT_DOMAINS ?? "").split(","),
    process.env.REPLIT_DEV_DOMAIN ?? "",
  ]
    .map((d) => d.trim())
    .filter(Boolean);
  if (ownDomains.includes(parsed.hostname)) return true;

  if (process.env.NODE_ENV !== "production" && isLocalhost) return true;

  return false;
}
