import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { Auth } from "@/components/Auth";
import { ColorsStudio } from "@/components/ColorsStudio";
import { LiveSessionStudio } from "@/components/LiveSessionStudio";
import { ArtistShootStudio } from "@/components/ArtistShootStudio";

type Tab = "colors" | "live" | "artist";

const TABS: { id: Tab; label: string; emoji: string; desc: string }[] = [
  { id: "colors", label: "Color Photoshoot", emoji: "🎨", desc: "Seamless cyclorama in any color" },
  { id: "live", label: "Live Session", emoji: "🎙", desc: "KEXP-style performance spaces" },
  { id: "artist", label: "Artist Shoot", emoji: "📸", desc: "Music video sets & backdrops" },
];

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("colors");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 14 }}>
        Loading…
      </div>
    );
  }

  if (!session) return <Auth />;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "'Inter', sans-serif" }}>
      {/* Top tab bar */}
      <div style={{
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-card)",
        backdropFilter: "blur(12px)",
        position: "sticky",
        top: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        padding: "0 24px",
        gap: 4,
        overflowX: "auto",
      }}>
        {/* Brand mark */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 20, flexShrink: 0 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, var(--accent), oklch(0.6 0.22 280))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>✦</div>
          <span style={{ fontWeight: 800, fontSize: 14, color: "var(--text)", letterSpacing: "-0.02em" }}>Aurora Colors</span>
        </div>

        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "14px 16px",
              borderRadius: 0,
              border: "none",
              borderBottom: `2px solid ${tab === t.id ? "var(--accent)" : "transparent"}`,
              background: "transparent",
              color: tab === t.id ? "var(--text)" : "var(--text-muted)",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: tab === t.id ? 600 : 400,
              transition: "all 0.15s",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ fontSize: 16 }}>{t.emoji}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === "colors" && <ColorsStudio session={session} />}
      {tab === "live" && <LiveSessionStudio session={session} />}
      {tab === "artist" && <ArtistShootStudio session={session} />}
    </div>
  );
}
