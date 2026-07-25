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

    let resolved = false;
    const resolve = (s: Session | null) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (!resolved) {
        resolved = true;
        setLoading(false);
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      resolve(s);
    });

    supabase.auth.getSession().then(({ data }) => {
      resolve(data.session);
    });

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        setLoading(false);
      }
    }, 8000);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  return { session, user, loading };
}