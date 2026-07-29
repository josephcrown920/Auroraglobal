import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { hasBackendEnv } from "@/integrations/backend-config";
import type { Session, User } from "@supabase/supabase-js";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
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
    const sessionPromise = supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    // 2. Listen for subsequent auth events (sign-in, sign-out, token refresh).
    //    onAuthStateChange can fire SIGNED_OUT before getSession resolves on
    //    some Supabase versions, so we intentionally do NOT use it to set loading.
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });

    // Safety net: if the DB round-trip stalls, unblock the UI after 8s.
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 8000);

    return () => {
      void sessionPromise;
      sub.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  return { session, user, loading };
}