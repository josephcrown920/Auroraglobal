import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { VideoAgentUI } from "@/components/VideoAgentUI";

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Still loading
  if (session === undefined) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted)",
          fontSize: 14,
        }}
      >
        Loading…
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#070612", gap: 20, padding: 24, textAlign: "center" }}>
        <div style={{ fontSize: 40 }}>🎬</div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "white", letterSpacing: "-0.02em" }}>Sign in to Aurora first</h2>
        <p style={{ margin: 0, fontSize: 14, color: "rgba(255,255,255,0.55)", maxWidth: 320, lineHeight: 1.6 }}>
          Video Agent is part of Aurora Studio. Sign in at Aurora, then come back here — no second login needed.
        </p>
        <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 28px", background: "linear-gradient(135deg, #7c3aed, #a855f7)", color: "white", borderRadius: 12, fontWeight: 700, fontSize: 15, textDecoration: "none" }}>
          Go to Aurora →
        </a>
      </div>
    );
  }
  return <VideoAgentUI session={session} />;
}
