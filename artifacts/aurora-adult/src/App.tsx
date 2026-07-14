import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { Auth } from "@/components/Auth";
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

  if (!session) return <Auth />;
  return <AdultStudio session={session} />;
}
