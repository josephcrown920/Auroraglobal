import React from "react";
import { Link } from "wouter";
import { useGetDashboard } from "@workspace/api-client-react";
import { RefreshCw, Image as ImageIcon } from "lucide-react";

const TOOLS = [
  {
    id: "00", label: "Perform Anywhere", sub: "AI live performance engine",
    cost: "FREE", badge: "FLAGSHIP", href: "/perform-anywhere", color: "#E8FF47",
    img: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200&q=90&fit=crop",
  },
  {
    id: "01", label: "Colors", sub: "Performance photo generation",
    cost: "2 CR", badge: null, href: "/studio", color: "#FF6BCD",
    img: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1200&q=90&fit=crop",
  },
  {
    id: "02", label: "TikTok30", sub: "UGC campaign engine",
    cost: "6 CR", badge: null, href: "/ugc", color: "#A78BFF",
    img: "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=1200&q=90&fit=crop",
  },
  {
    id: "03", label: "Video Agent", sub: "AI video production assistant",
    cost: "10 CR", badge: null, href: "/video-agent", color: "#3CF0FF",
    img: "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=1200&q=90&fit=crop",
  },
  {
    id: "04", label: "Director's Room", sub: "Cinematic visual studio",
    cost: "12 CR", badge: "SUITE", href: "/directors-room", color: "#FFB340",
    img: "https://images.unsplash.com/photo-1598387993441-a364f854cde0?w=1200&q=90&fit=crop",
  },
  {
    id: "05", label: "GRWM", sub: "Get Ready With Me",
    cost: "6 CR", badge: null, href: "/grwm", color: "#FF8FAB",
    img: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=1200&q=90&fit=crop",
  },
  {
    id: "06", label: "Motion Control", sub: "Kinetic visual generation",
    cost: "10 CR", badge: "FLAGSHIP", href: "/motion", color: "#FFFFFF",
    img: "https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=1200&q=90&fit=crop",
  },
];

type Generation = {
  id: string;
  type: string;
  thumbnailUrl?: string | null;
  createdAt: string;
};

function ToolStrip({ tool }: { tool: typeof TOOLS[0] }) {
  const [hovered, setHovered] = React.useState(false);

  return (
    <Link href={tool.href}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: "relative",
          height: hovered ? 108 : 92,
          overflow: "hidden",
          cursor: "pointer",
          borderBottom: "1px solid #161616",
          display: "flex",
          alignItems: "center",
          transition: "height 0.22s ease",
          background: hovered ? "#0d0d0d" : "transparent",
        }}
      >
        {/* Background image */}
        <img
          src={tool.img}
          alt=""
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            objectFit: "cover",
            opacity: hovered ? 0.22 : 0.08,
            transition: "opacity 0.35s ease",
          }}
        />
        {/* Gradient overlay */}
        <div style={{
          position: "absolute", inset: 0,
          background: hovered
            ? `linear-gradient(to right, ${tool.color}18 0%, transparent 50%)`
            : "transparent",
          transition: "all 0.35s ease",
        }} />

        {/* Content */}
        <div style={{
          position: "relative", display: "flex", alignItems: "center",
          width: "100%", padding: "0 40px", gap: 24,
        }}>
          {/* Number */}
          <span style={{
            fontSize: 10, fontWeight: 800,
            color: hovered ? tool.color : "#282828",
            letterSpacing: "0.12em", minWidth: 24,
            transition: "color 0.3s",
          }}>{tool.id}</span>

          {/* Tool name + badge */}
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{
              fontSize: "clamp(22px, 2.4vw, 32px)", fontWeight: 900,
              letterSpacing: "-0.03em", textTransform: "uppercase", color: "#fff",
            }}>{tool.label}</span>
            {tool.badge && (
              <span style={{
                fontSize: 9, fontWeight: 800, letterSpacing: "0.22em",
                color: tool.color, border: `1px solid ${tool.color}44`,
                padding: "2px 9px", borderRadius: 2,
              }}>{tool.badge}</span>
            )}
          </div>

          {/* Sub */}
          <span style={{
            fontSize: 11, color: "#444", letterSpacing: "0.06em",
            display: hovered ? "none" : "block",
          }}>{tool.sub}</span>

          {/* Cost */}
          <span style={{
            fontSize: 10, fontWeight: 800,
            color: tool.cost === "FREE" ? tool.color : "#FF3B30",
            background: tool.cost === "FREE" ? `${tool.color}18` : "rgba(255,59,48,0.1)",
            padding: "5px 12px", borderRadius: 14,
          }}>{tool.cost}</span>

          {/* CTA */}
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.2em",
            color: hovered ? "#fff" : "#2c2c2c",
            transition: "color 0.3s",
          }}>OPEN →</span>
        </div>
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const { data: dashboard, isLoading, error } = useGetDashboard();

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="size-5 animate-spin text-white/20" />
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="p-8 text-center mt-20">
        <p className="text-white/30 text-sm mb-4">Failed to load dashboard.</p>
        <button onClick={() => window.location.reload()}
          className="text-[10px] font-bold uppercase tracking-widest text-white/20 hover:text-white/60 transition-colors">
          Retry
        </button>
      </div>
    );
  }

  const recentActivity = (dashboard.recentActivity as Generation[]) ?? [];

  return (
    <div style={{ background: "#080808", minHeight: "100vh", color: "#fff", fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @keyframes heroGlow { 0%,100%{opacity:.55} 50%{opacity:.9} }
      `}</style>

      {/* ── Hero ── */}
      <div style={{ position: "relative", padding: "56px 40px 44px", overflow: "hidden" }}>
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse 55% 70% at 50% 0%, #E8FF4710 0%, transparent 65%)",
          animation: "heroGlow 5s ease-in-out infinite",
        }} />
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.35em", color: "#383838", marginBottom: 18 }}>
            THE COMPLETE TOOLKIT
          </div>
          <div style={{
            fontSize: "clamp(52px, 8vw, 104px)", fontWeight: 900,
            lineHeight: 0.88, letterSpacing: "-0.04em", textTransform: "uppercase",
          }}>
            PERFORM.<br />
            <span style={{ WebkitTextStroke: "1px #383838", color: "transparent" }}>CREATE.</span><br />
            RELEASE.
          </div>
          <div style={{ marginTop: 28, display: "flex", gap: 14, alignItems: "center" }}>
            <div style={{ width: 36, height: 1, background: "#282828" }} />
            <span style={{ fontSize: 10, color: "#444", letterSpacing: "0.12em" }}>
              {TOOLS.length} TOOLS · BUILT FOR ARTISTS
            </span>
          </div>
        </div>
      </div>

      {/* ── Tool strips ── */}
      <div style={{ borderTop: "1px solid #161616" }}>
        {TOOLS.map(tool => <ToolStrip key={tool.id} tool={tool} />)}
      </div>

      {/* ── Recent Work ── */}
      <div style={{ padding: "48px 40px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.3em", color: "#383838" }}>RECENT WORK</span>
          <Link href="/gallery">
            <span style={{ fontSize: 10, color: "#383838", letterSpacing: "0.15em", cursor: "pointer" }}>VIEW ALL →</span>
          </Link>
        </div>

        {recentActivity.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2 }}>
            {recentActivity.slice(0, 8).map((item) => (
              <Link key={item.id} href="/gallery">
                <div style={{ position: "relative", aspectRatio: "4/3", overflow: "hidden", cursor: "pointer", borderRadius: 2, background: "#111" }}>
                  {item.thumbnailUrl ? (
                    <img src={item.thumbnailUrl} alt={item.type} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <ImageIcon size={20} color="rgba(255,255,255,0.08)" />
                    </div>
                  )}
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, #000c 0%, transparent 50%)" }} />
                  <div style={{ position: "absolute", bottom: 10, left: 10, right: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>{item.type}</div>
                    <div style={{ fontSize: 9, color: "#888", marginTop: 2 }}>
                      {new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div style={{ padding: "40px 0", textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.15)" }}>No projects yet.</p>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.08)", marginTop: 4 }}>Pick a tool above to start creating.</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: "48px 40px", marginTop: 48, borderTop: "1px solid #161616", display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.35em", color: "#222" }}>AURORA</span>
        <span style={{ fontSize: 10, color: "#1e1e1e", letterSpacing: "0.12em" }}>MADE FOR PERFORMERS</span>
      </div>
    </div>
  );
}
