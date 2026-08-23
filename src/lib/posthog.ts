// Task #374 — PostHog product analytics.
//
// Mirrors the existing GTM pattern in __root.tsx: opt-in, env-gated, and
// consent-gated. `capture_pageview: false` is set on init because
// TanStack Router's client-side navigations don't trigger a full page
// load — PostHog's default autocapture would only ever see the first
// page. capturePageView() is called manually instead, from the same
// usePageViewTracking() hook that already drives our own `events` table
// (see src/hooks/use-tracking.ts), so both trackers see every route change.

import posthog from "posthog-js";

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const POSTHOG_HOST =
  (import.meta.env.VITE_POSTHOG_HOST as string | undefined)?.trim() || "https://us.i.posthog.com";

let initialized = false;

function ensureInitialized(): boolean {
  if (typeof window === "undefined") return false;
  if (!POSTHOG_KEY) return false;
  if (!initialized) {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      capture_pageview: false,
      capture_pageleave: true,
      autocapture: true,
      persistence: "localStorage+cookie",
    });
    initialized = true;
  }
  return true;
}

/** Emits a `$pageview` event for the given path. Call on every route change. */
export function capturePageView(path: string): void {
  if (!ensureInitialized()) return;
  posthog.capture("$pageview", {
    $current_url: typeof window !== "undefined" ? window.location.href : path,
  });
}

/** Associates future events with a signed-in user id (no-op if analytics is disabled). */
export function identifyPosthogUser(userId: string): void {
  if (!ensureInitialized()) return;
  posthog.identify(userId);
}

/** Clears the identified user on sign-out (no-op if analytics is disabled). */
export function resetPosthogUser(): void {
  if (!initialized) return;
  posthog.reset();
}
