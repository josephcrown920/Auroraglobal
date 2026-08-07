// Pure sync logic extracted so it can be unit-tested without DOM or React.
// The banner (CookieConsentBanner.tsx) calls syncConsentForSession with its
// real dependencies; tests inject stubs.

import type { ConsentStatus } from "./consent";

export type ConsentSyncDeps = {
  getServerConsent: () => Promise<ConsentStatus | null>;
  saveServerConsent: (status: ConsentStatus) => Promise<unknown>;
  getLocalConsent: () => ConsentStatus | null;
  setLocalConsent: (status: ConsentStatus) => void;
  isRegulatedRegion: () => boolean;
};

export type ConsentSyncResult =
  | { action: "hide" }
  | { action: "show" }
  | { action: "seeded"; status: ConsentStatus }
  | { action: "pushed"; status: ConsentStatus };

/**
 * Core consent-sync decision for a given session.
 *
 * Rules (in priority order):
 *  1. No session (userId = null) → localStorage-only: show banner iff
 *     regulated region and no local answer yet.
 *  2. Authenticated + server has a preference → server is authoritative;
 *     seed local, return "seeded".
 *  3. Authenticated + server null + local has an answer → push local to
 *     server (fire-and-forget in caller), return "pushed".
 *  4. Authenticated + neither → show banner iff regulated region.
 *
 * The caller is responsible for:
 *  - Deduplicating calls for the same userId.
 *  - Mapping the returned action to UI state (banner visibility).
 */
export async function syncConsentForSession(
  userId: string | null,
  deps: ConsentSyncDeps,
): Promise<ConsentSyncResult> {
  if (!userId) {
    // Unauthenticated: localStorage-only behaviour, unchanged.
    const local = deps.getLocalConsent();
    if (local !== null) return { action: "hide" };
    return deps.isRegulatedRegion() ? { action: "show" } : { action: "hide" };
  }

  // Authenticated path — server preference is authoritative.
  let serverStatus: ConsentStatus | null = null;
  try {
    serverStatus = await deps.getServerConsent();
  } catch {
    // Server fetch failed — fall through to local state / banner.
  }

  if (serverStatus !== null) {
    deps.setLocalConsent(serverStatus);
    return { action: "seeded", status: serverStatus };
  }

  const localStatus = deps.getLocalConsent();
  if (localStatus !== null) {
    // Push to server fire-and-forget; caller should not await this.
    void deps.saveServerConsent(localStatus);
    return { action: "pushed", status: localStatus };
  }

  return deps.isRegulatedRegion() ? { action: "show" } : { action: "hide" };
}
