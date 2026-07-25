/** Client-safe canonical origin — no trailing slash.
 *
 *  Reads VITE_SITE_URL (client-visible) first, then the server-side
 *  SITE_URL env var (available in SSR route head() evaluation), with the
 *  production domain as the hard fallback. Import this from route files
 *  instead of site-url.ts (which is server-only). */
export const CANONICAL_ORIGIN: string =
  (typeof import.meta !== "undefined" &&
    (import.meta.env as Record<string, string | undefined>)?.VITE_SITE_URL?.trim()) ||
  (typeof process !== "undefined" && process.env.SITE_URL?.trim()) ||
  "https://auroraperformancestudio.com";
