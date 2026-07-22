/** Canonical production root URL — no trailing slash.
 *
 *  Set the SITE_URL environment variable (already used by billing and MCP) to
 *  override this for custom domains or staging environments.
 *
 *  This module is server-side only; never import it from a client bundle. */
export const SITE_URL: string =
  (typeof process !== "undefined" && process.env.SITE_URL?.trim()) ||
  "https://auroraperformancestudio.com";
