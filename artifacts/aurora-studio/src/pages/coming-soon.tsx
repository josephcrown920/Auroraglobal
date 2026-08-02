import { Link, useLocation } from "wouter";

const TOOL_META: Record<string, {
  id: string; label: string; sub: string; desc: string;
  color: string; badge?: string; tags: string[]; img: string;
}> = {
  "/perform-anywhere": {
    id: "00", label: "Perform Anywhere", sub: "AI live performance engine", badge: "FLAGSHIP",
    desc: "Transform any stage into a cinematic production. Real-time AI direction, multi-camera sync, and instant broadcast-ready cuts. Built for artists who perform everywhere.",
    color: "#E8FF47", tags: ["Live", "Multi-cam", "Real-time"],
    img: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1400&q=90&fit=crop",
  },
  "/video-agent": {
    id: "03", label: "Video Agent", sub: "AI video production assistant",
    desc: "Describe your vision in plain language. The Video Agent plans, shoots, and assembles the final cut autonomously — no timeline editing required.",
    color: "#3CF0FF", tags: ["Autonomous", "Full-cut", "AI director"],
    img: "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=1400&q=90&fit=crop",
  },
  "/directors-room": {
    id: "04", label: "Director's Room", sub: "Cinematic visual studio", badge: "SUITE",
    desc: "Full production suite: Storyboard Builder, Scene Weaver, AI Auto-Cuts editor, and one-click color grading. Your complete cinematic production environment.",
    color: "#FFB340", tags: ["Storyboards", "Scene Weaver", "Auto Cuts"],
    img: "https://images.unsplash.com/photo-1598387993441-a364f854cde0?w=1400&q=90&fit=crop",
  },
  "/grwm": {
    id: "05", label: "GRWM", sub: "Get Ready With Me",
    desc: "Beauty, lifestyle, and behind-the-scenes content engine. Mirror-ready lighting scripts, tutorial cuts, vlog formatting, and trend-matched pacing.",
    color: "#FF8FAB", tags: ["Beauty", "Lifestyle", "Vlog"],
    img: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=1400&q=90&fit=crop",
  },
};

export default function ComingSoonPage() {
  const [location] = useLocation();
  const meta = TOOL_META[location] ?? {
    id: "—", label: "Coming Soon", sub: "New tool", badge: undefined,
    desc: "This tool is in development and will be available soon.", color: "#555", tags: [],
  };

  return (
    <div style={{ background: "#080808", minHeight: "100vh", color: "#fff", fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @keyframes csPulse { 0%,100%{opacity:.5} 50%{opacity:.9} }
        @keyframes csFade { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* Hero */}
      <div style={{ position: "relative", minHeight: 360, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "0 40px 40px", overflow: "hidden" }}>
        {/* Background image */}
        <img
          src={meta.img}
          alt=""
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.18 }}
        />
        {/* Glow */}
        <div style={{
          position: "absolute", inset: 0,
          background: `radial-gradient(ellipse 80% 70% at 50% 100%, ${meta.color}22 0%, transparent 70%)`,
          animation: "csPulse 4s ease-in-out infinite",
        }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, #08080888 0%, transparent 35%, #080808 100%)" }} />

        <div style={{ position: "relative", animation: "csFade 0.5s ease" }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: meta.color, letterSpacing: "0.3em", marginBottom: 12 }}>
            {meta.id} — {meta.sub}
          </div>
          <div style={{
            fontSize: "clamp(48px, 7vw, 88px)", fontWeight: 900,
            letterSpacing: "-0.04em", textTransform: "uppercase", lineHeight: 0.88, marginBottom: 24,
          }}>{meta.label}</div>
          {meta.badge && (
            <span style={{
              fontSize: 9, fontWeight: 800, letterSpacing: "0.22em", color: meta.color,
              border: `1px solid ${meta.color}44`, padding: "4px 12px", borderRadius: 2,
            }}>{meta.badge}</span>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "0 40px 40px", animation: "csFade 0.6s ease 0.1s both" }}>
        <p style={{ fontSize: 16, color: "#777", lineHeight: 1.75, maxWidth: 580, marginBottom: 28 }}>{meta.desc}</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 40 }}>
          {meta.tags.map(t => (
            <span key={t} style={{
              fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", color: meta.color,
              border: `1px solid ${meta.color}33`, padding: "7px 14px", borderRadius: 3, textTransform: "uppercase",
            }}>{t}</span>
          ))}
        </div>

        {/* Coming soon card */}
        <div style={{ border: "1px solid #1a1a1a", borderRadius: 4, padding: "32px 28px", background: "#0a0a0a", maxWidth: 480 }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.3em", color: "#333", marginBottom: 12 }}>NOTIFY ME</div>
          <p style={{ fontSize: 12, color: "#555", lineHeight: 1.65, marginBottom: 20 }}>
            This tool is in development. We'll let you know the moment it goes live.
          </p>
          <div style={{ display: "flex", gap: 2, borderRadius: 3, overflow: "hidden" }}>
            <input
              type="email"
              placeholder="your@email.com"
              style={{
                flex: 1, background: "#111", border: "1px solid #222", borderRight: "none",
                borderRadius: "3px 0 0 3px", padding: "12px 14px", color: "#fff",
                fontSize: 12, outline: "none", fontFamily: "inherit",
              }}
            />
            <button style={{
              background: meta.color, color: "#000", border: "none", borderRadius: "0 3px 3px 0",
              padding: "12px 20px", fontSize: 10, fontWeight: 800, letterSpacing: "0.15em", cursor: "pointer",
            }}>NOTIFY</button>
          </div>
        </div>

        <Link href="/dashboard">
          <div style={{ marginTop: 36, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", color: "#444", textTransform: "uppercase" }}>← Back to dashboard</span>
          </div>
        </Link>
      </div>
    </div>
  );
}
