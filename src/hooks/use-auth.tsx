import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { hasBackendEnv } from "@/integrations/backend-config";
import type { Session, User } from "@supabase/supabase-js";
import { hasAnalyticsConsent } from "@/lib/consent";
import { identifyPosthogUser, resetPosthogUser } from "@/lib/posthog";

// Supabase stores the session under this key in localStorage.
// Project ref is derived from VITE_SUPABASE_URL: tpzmvbczwahxajujvnrq
const SUPABASE_STORAGE_KEY = "sb-tpzmvbczwahxajujvnrq-auth-token";

/** Synchronously checks whether a Supabase session token is already stored in
 *  localStorage.  When true, getSession() is performing a background network
 *  token-refresh — we must wait for it, not time out after 8 s.
 *  Exported so layout chrome can optimistically render for returning users
 *  while the session is still being verified. */
export function hasStoredSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(SUPABASE_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Boolean(parsed?.access_token || parsed?.refresh_token);
  } catch {
    return false;
  }
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser, ] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasBackendEnv()) {
      setSession(null);
      setUser(null);
      setLoading(false);
      return;
    }

    // 1. Authoritative initial load: read the persisted session from localStorage.
    //    We only set loading=false once this resolves so we never flash a redirect
    //    to /auth while a valid stored session is still being retrieved.
    const sessionPromise = supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        setUser(data.session?.user ?? null);
        // Associate this session's future analytics events with the user id.
        // Never awaited/blocking; identify() itself no-ops without consent.
        if (data.session?.user) {
          if (hasAnalyticsConsent()) identifyPosthogUser(data.session.user.id);
        } else {
          // No signed-in user on this load — clear any identity PostHog may
          // have persisted from a previous session on a shared browser, so
          // a signed-out visitor is never attributed to the last logged-in
          // user's id.
          resetPosthogUser();
        }
      })
      .finally(() => {
        // getSession settled (session or not) — the UI can stop waiting.
        // Without this, only the safety-net timeout below ever cleared
        // `loading`, which left every loading-gated page (admin, kids,
        // video-agent, …) on a spinner for up to 30 s after a full page load.
        setLoading(false);
      });

    // 2. Listen for subsequent auth events (sign-in, sign-out, token refresh).
    //    onAuthStateChange can fire SIGNED_OUT before getSession resolves on
    //    some Supabase versions, so we intentionally do NOT use it to set loading.
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (event === "SIGNED_IN" && s?.user && hasAnalyticsConsent()) {
        identifyPosthogUser(s.user.id);
      } else if (event === "SIGNED_OUT") {
        resetPosthogUser();
      }
    });

    // Safety net: only unblock the UI if getSession truly stalls.
    //
    // • No stored session → nothing to wait for; 5 s is ample.
    // • Stored session found → getSession is doing a background token-refresh
    //   network call.  Give it 30 s before giving up so a slow connection never
    //   incorrectly evicts a perfectly valid signed-in user.
    const safetyMs = hasStoredSession() ? 30_000 : 5_000;
    const timeout = setTimeout(() => setLoading(false), safetyMs);

    return () => {
      void sessionPromise;
      sub.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  return { session, user, loading };
}
