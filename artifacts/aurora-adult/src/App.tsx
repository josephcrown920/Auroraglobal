import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { AgeGate } from "@/components/AgeGate";
import { AdultStudio } from "@/components/AdultStudio";

export default function App() {
  const [ageConfirmed, setAgeConfirmed] = useState(() => localStorage.getItem("aurora_adult_age_confirmed") === "1");
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

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
  return <AdultStudio session={session} />;
}
