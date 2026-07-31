import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { AgeGate } from "@/components/AgeGate";
import { AdultStudio } from "@/components/AdultStudio";

export default function App() {
  const [ageConfirmed, setAgeConfirmed] = useState(() => localStorage.getItem("aurora_adult_age_confirmed") === "1");
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  // undefined = still checking, false = signed in but not the owner
  const [isAdmin, setIsAdmin] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Owner-only. `user_roles` is RLS-protected so a signed-in user can read only
  // their OWN role rows — a non-admin simply gets no row back and is refused.
  useEffect(() => {
    if (!session) {
      setIsAdmin(session === null ? false : undefined);
      return;
    }
    let cancelled = false;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setIsAdmin(!!data);
      });
    return () => { cancelled = true; };
  }, [session]);

  if (!ageConfirmed) return <AgeGate onConfirm={() => setAgeConfirmed(true)} />;

  if (session === undefined) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 14 }}>
        Loading…
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "var(--bg)", gap: 20, padding: 24, textAlign: "center" }}>
        <div style={{ fontSize: 40 }}>🔒</div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em" }}>Sign in to Aurora first</h2>
        <p style={{ margin: 0, fontSize: 14, color: "var(--text-muted)", maxWidth: 320, lineHeight: 1.6 }}>
          Adult School is part of Aurora Studio. Sign in at Aurora, then come straight back here.
        </p>
        <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 28px", background: "linear-gradient(135deg, #e11d6a, #9b1239)", color: "white", borderRadius: 12, fontWeight: 700, fontSize: 15, textDecoration: "none", boxShadow: "0 0 28px rgba(225,29,106,0.35)" }}>
          Go to Aurora →
        </a>
      </div>
    );
  }
  if (isAdmin === undefined) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 14 }}>
        Checking access…
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "var(--bg)", gap: 20, padding: 24, textAlign: "center" }}>
        <div style={{ fontSize: 40 }}>🔒</div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em" }}>Not available</h2>
        <p style={{ margin: 0, fontSize: 14, color: "var(--text-muted)", maxWidth: 320, lineHeight: 1.6 }}>
          Adult School is a private owner-only studio and isn’t part of your Aurora plan.
        </p>
        <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 28px", background: "linear-gradient(135deg, #e11d6a, #9b1239)", color: "white", borderRadius: 12, fontWeight: 700, fontSize: 15, textDecoration: "none", boxShadow: "0 0 28px rgba(225,29,106,0.35)" }}>
          Go to Aurora →
        </a>
      </div>
    );
  }

  return <AdultStudio session={session} />;
}
