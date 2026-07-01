const FIRST_GEN_KEY = "aurora.first_gen.done.v1";
const TOUR_KEY = "aurora.welcome_tour.done.v1";
const PAGE_VISIT_PREFIX = "aurora.page_visit.v1.";

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function hasCompletedFirstGen(): boolean {
  if (typeof window === "undefined") return true;
  return safeGet(FIRST_GEN_KEY) !== null;
}

export function markFirstGenComplete(): void {
  safeSet(FIRST_GEN_KEY, "1");
}

export function hasDismissedTour(): boolean {
  if (typeof window === "undefined") return true;
  return safeGet(TOUR_KEY) !== null;
}

export function markTourDismissed(): void {
  safeSet(TOUR_KEY, "1");
}

export function isFirstPageVisit(page: string): boolean {
  if (typeof window === "undefined") return false;
  return safeGet(PAGE_VISIT_PREFIX + page) === null;
}

export function markPageVisited(page: string): void {
  safeSet(PAGE_VISIT_PREFIX + page, "1");
}
