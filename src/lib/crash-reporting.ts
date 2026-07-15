/**
 * Lightweight client-side crash reporter.
 *
 * Captures unhandled JS errors and promise rejections then writes them to the
 * `events` table (same store used by tracking.ts) so they appear alongside
 * product analytics in the admin dashboard — no external service required.
 *
 * Call initCrashReporting() once, early in the app lifecycle (e.g. inside
 * RootComponent in __root.tsx). Safe to call in SSR — it no-ops server-side.
 */

import { supabase } from "@/integrations/supabase/client";

let installed = false;

function truncate(s: string, max: number) {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

async function report(name: string, payload: Record<string, unknown>) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from("events").insert({
      name,
      path: typeof window !== "undefined" ? window.location.pathname : "/",
      user_id: session?.user?.id ?? null,
      session_id: null,
      properties: payload,
    });
  } catch {
    // Never let crash reporting itself crash the app.
  }
}

export function initCrashReporting() {
  if (typeof window === "undefined") return;
  if (installed) return;
  installed = true;

  window.addEventListener("error", (e: ErrorEvent) => {
    void report("js_error", {
      message: truncate(e.message ?? "Unknown error", 500),
      source: truncate(e.filename ?? "", 200),
      line: e.lineno,
      col: e.colno,
      stack: truncate(e.error?.stack ?? "", 1000),
      ua: navigator.userAgent,
    });
  });

  window.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => {
    const reason = e.reason;
    const message =
      reason instanceof Error
        ? reason.message
        : typeof reason === "string"
        ? reason
        : JSON.stringify(reason);
    void report("unhandled_rejection", {
      message: truncate(message ?? "Unknown rejection", 500),
      stack: truncate(reason instanceof Error ? (reason.stack ?? "") : "", 1000),
      ua: navigator.userAgent,
    });
  });
}
