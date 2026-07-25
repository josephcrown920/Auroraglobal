import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
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

  if (!session) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "var(--bg)", gap: 20, padding: 24, textAlign: "center" }}>
        <div style={{ fontSize: 40 }}>✦</div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em" }}>Sign in to Aurora first</h2>
        <p style={{ margin: 0, fontSize: 14, color: "var(--text-muted)", maxWidth: 320, lineHeight: 1.6 }}>
          Colors Studio is part of Aurora. Sign in at Aurora, then come back here — no second login needed.
        </p>
        <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 28px", background: "linear-gradient(135deg, var(--accent, #7c3aed), oklch(0.6 0.22 280))", color: "white", borderRadius: 12, fontWeight: 700, fontSize: 15, textDecoration: "none" }}>
          Go to Aurora →
        </a>
      </div>
    );
  }

  const BASE = import.meta.env.BASE_URL;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "'Inter', sans-serif" }}>

      {/* ── Cover hero ── */}
      <div style={{ position: "relative", width: "100%", height: 220, overflow: "hidden" }}>
        <img
          src={`${BASE}cover-artist.png`}
          alt="NBA Josh in the Aurora pink studio"
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 20%" }}
        />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, var(--bg) 100%)" }} />
        {/* Studios grid strip */}
        <div style={{ position: "absolute", bottom: 12, right: 12, width: 120, height: 80, borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.15)", boxShadow: "0 4px 20px rgba(0,0,0,0.6)" }}>
          <img src={`${BASE}cover-studios.png`} alt="12 color studios" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
        {/* Brand overlay */}
        <div style={{ position: "absolute", bottom: 16, left: 16 }}>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)" }}>Aurora Colors</p>
          <p style={{ margin: "2px 0 0", fontSize: 18, fontWeight: 900, color: "white", letterSpacing: "-0.02em" }}>12 colors. Every mood.</p>
        </div>
      </div>

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
