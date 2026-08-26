/**
 * Route manifest for the all-routes smoke suite.
 *
 * Routes are DERIVED from src/routes/*.tsx at test time — never hard-coded —
 * so a newly added page is automatically covered by e2e without anyone
 * remembering to list it. The only manual step is for NEW dynamic routes
 * ($param): they need a sample URL below, and the manifest build fails loudly
 * until one is added. That failure is intentional regression protection.
 */
import fs from "node:fs";
import path from "node:path";

const ROUTES_DIR = path.resolve(process.cwd(), "src", "routes");

/** Routes whose beforeLoad immediately redirects — assert the landing spot instead. */
export const REDIRECTS: Record<string, string> = {
  "/home": "/studio",
  "/dashboard": "/account",
  "/perform": "/motion",
  "/directors-board": "/director-room",
  "/affiliate": "/partners",
  "/orchestrate": "/studio",
  "/privacy": "/legal/privacy",
  "/terms": "/legal/terms",
};

/**
 * Sample URLs for dynamic ($param) routes. `expectText` additionally asserts
 * the page's own graceful state rendered (e.g. a bogus share token must show
 * the share route's friendly not-found card — not a crash, not a blank page).
 */
export const PARAM_SAMPLES: Record<string, { url: string; expectText?: RegExp }[]> = {
  "/guides/$slug": [{ url: "/guides/phone-lipsync-performance" }],
  "/legal/$slug": [{ url: "/legal/privacy" }, { url: "/legal/ai-policy" }],
  "/r/$token": [
    { url: "/r/e2e-nonexistent-token", expectText: /isn't public|couldn't load that render/i },
  ],
};

export type RouteVisit = {
  /** Route pattern the visit belongs to (e.g. "/legal/$slug"). */
  pattern: string;
  /** Concrete URL to visit. */
  url: string;
  /** Expected landing pathname when the route is a pure redirect. */
  redirectTo?: string;
  /** Page-specific graceful-state assertion (see PARAM_SAMPLES). */
  expectText?: RegExp;
};

function filenameToPattern(file: string): string | null {
  if (!file.endsWith(".tsx")) return null; // .ts files here are server responses (sitemap)
  let base = file.slice(0, -".tsx".length);
  if (base.endsWith(".lazy")) base = base.slice(0, -".lazy".length);
  if (base.startsWith("__root")) return null;
  if (base.includes("[")) return null; // escaped-literal server routes (sitemap[.]xml)
  const segments = base.split(".");
  if (segments[segments.length - 1] === "index") segments.pop();
  const url = `/${segments.join("/")}`;
  return url === "" ? "/" : url;
}

export function discoverRoutePatterns(): string[] {
  const entries = fs.readdirSync(ROUTES_DIR, { withFileTypes: true });
  const patterns = new Set<string>();
  for (const entry of entries) {
    if (!entry.isFile()) continue; // api/ dir = server endpoints, not UI routes
    const pattern = filenameToPattern(entry.name);
    if (pattern) patterns.add(pattern);
  }
  return [...patterns].sort();
}

/**
 * Build the full visit list. Throws (failing the suite at collection time)
 * when a dynamic route has no PARAM_SAMPLES entry — add a sample instead of
 * shipping an untested page.
 */
export function buildRouteVisits(): RouteVisit[] {
  const visits: RouteVisit[] = [];
  const missingSamples: string[] = [];

  for (const pattern of discoverRoutePatterns()) {
    if (pattern.includes("$")) {
      const samples = PARAM_SAMPLES[pattern];
      if (!samples || samples.length === 0) {
        missingSamples.push(pattern);
        continue;
      }
      for (const sample of samples) {
        visits.push({ pattern, url: sample.url, expectText: sample.expectText });
      }
      continue;
    }
    visits.push({ pattern, url: pattern, redirectTo: REDIRECTS[pattern] });
  }

  if (missingSamples.length > 0) {
    throw new Error(
      `New dynamic route(s) without e2e coverage: ${missingSamples.join(", ")}. ` +
        `Add a sample URL for each in e2e/helpers/route-manifest.ts (PARAM_SAMPLES) ` +
        `so the all-routes smoke suite can visit them.`,
    );
  }

  return visits;
}
