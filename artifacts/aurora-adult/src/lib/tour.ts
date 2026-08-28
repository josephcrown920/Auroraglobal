// Per-user, once-only persistence for the 15-step onboarding tour.
// Keyed by Supabase user id so a shared browser profile can't skip it for a
// different creator, and so a signed-out visitor never gets a stale "seen" flag.
const STORAGE_PREFIX = "aurora_adult_tour_done_";

export function hasTourCompleted(userId: string): boolean {
  try {
    return localStorage.getItem(STORAGE_PREFIX + userId) === "1";
  } catch {
    return true; // fail closed toward NOT re-showing on storage errors
  }
}

export function markTourCompleted(userId: string): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + userId, "1");
  } catch {
    // best-effort — ignore quota/private-mode errors
  }
}

export function resetTour(userId: string): void {
  try {
    localStorage.removeItem(STORAGE_PREFIX + userId);
  } catch {
    // ignore
  }
}
