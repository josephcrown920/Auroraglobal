// Conversion event pushes for Google Tag Manager (see VITE_GTM_CONTAINER_ID
// gating + the GTM loader script in src/routes/__root.tsx). GTM only ever
// loads once analytics consent is granted (src/lib/consent.ts), and even
// then window.dataLayer may not exist yet on the very first tick — every
// push here is a no-op guard, never a hard dependency, so a missing/blocked
// GTM container can never break the app.
//
// These are intentionally separate from src/lib/tracking.ts (our own
// first-party `events` table): tracking.ts feeds in-app/product analytics,
// this feeds the GTM dataLayer so the container can fan events out to
// Meta/TikTok/GA4 pixels without further code changes.

import { hasAnalyticsConsent } from "@/lib/consent";

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

function pushToDataLayer(event: string, payload?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  // Same consent gate as the GTM loader itself — if GTM isn't allowed to
  // load, there's no point queuing events for it either.
  if (!hasAnalyticsConsent()) return;
  if (!Array.isArray(window.dataLayer)) return;
  try {
    window.dataLayer.push({ event, ...payload });
  } catch {
    // dataLayer pushes should never break the app
  }
}

/** Fires once a new account is created (email/password or OAuth signup). */
export function trackSignUp(method: "email" | "google" | "github" | "apple"): void {
  pushToDataLayer("sign_up", { method });
}

/** Fires once a credit-pack (Aura) purchase is confirmed paid. */
export function trackPurchase(params: {
  transactionId: string;
  value: number;
  currency: string;
}): void {
  pushToDataLayer("purchase", {
    transaction_id: params.transactionId,
    value: params.value,
    currency: params.currency,
  });
}

/** Fires once a generation job (image / video / lip-sync) completes successfully. */
export function trackGenerationCompleted(kind: "image" | "video" | "lipsync"): void {
  pushToDataLayer("generation_completed", { generation_kind: kind });
}
