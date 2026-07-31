/**
 * Nocturne — deep navy/midnight palette.
 * Sophisticated, cinematic, Apple Music dark mode energy.
 * Soft luminous borders, subtle grain, warm accent gold.
 */

const tools = [
  { label: "Colors", sub: "Performance photos", cost: 2, img: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&q=85&fit=crop", glow: "rgba(255,214,90,0.25)" },
  { label: "Motion", sub: "Cinematic clips", cost: 10, img: "https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=800&q=85&fit=crop", glow: "rgba(120,160,255,0.25)" },
  { label: "Lip Sync", sub: "Audio-synced video", cost: 8, img: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=85&fit=crop&crop=top", glow: "rgba(255,120,200,0.25)" },
  { label: "Music Video", sub: "Full production", cost: 12, img: "https://images.unsplash.com/photo-1598387993441-a364f854cde0?w=800&q=85&fit=crop", glow: "rgba(255,140,80,0.25)" },
  { label: "TikTok30 UGC", sub: "Campaign batches", cost: 6, img: "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=800&q=85&fit=crop&crop=top", glow: "rgba(130,255,180,0.2)" },
];

const recent = [
  { label: "Neon Stage Session", type: "Colors", img: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&q=80", time: "2h ago" },
  { label: "Warehouse Live", type: "Motion", img: "https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=400&q=80", time: "5h ago" },
  { label: "Cyberpunk Single", type: "Music Video", img: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&q=80", time: "1d ago" },
];

export default function Nocturne() {
  return (
    <div style={{
      background: "#07090F",
      minHeight: "100vh",
      fontFamily: "'Inter', sans-serif",
      color: "#E8EAF0",
      display: "flex",
    }}>
      {/* Sidebar */}
      <aside style={{
        width: 220,
        borderRight: "1px solid rgba(255,255,255,0.05)",
        display: "flex",
        flexDirection: "column",
        padding: "28px 0",
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ padding: "0 24px 32px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "radial-gradient(circle at 40% 40%, #7EB8FF, #1A3A6E)" }} />
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.12em", color: "#C8D4F0" }}>AURORA</span>
        </div>

        {/* Credits */}
        <div style={{ margin: "0 16px 28px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "14px 16px" }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.2em", color: "rgba(200,212,240,0.4)", marginBottom: 6 }}>CREDITS</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#FFD85A" }}>250</div>
          <div style={{ fontSize: 10, color: "rgba(200,212,240,0.4)", marginTop: 4 }}>Top up →</div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "0 12px", display: "flex", flexDirection: "column", gap: 2 }}>
          {[{ label: "Studio", active: true }, { label: "Gallery" }, { label: "Settings" }].map(item => (
            <div key={item.label} style={{
              padding: "10px 12px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              color: item.active ? "#E8EAF0" : "rgba(200,212,240,0.35)",
              background: item.active ? "rgba(255,255,255,0.06)" : "transparent",
              cursor: "pointer",
            }}>{item.label}</div>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, padding: "36px 40px", overflowY: "auto" }}>
        <header style={{ marginBottom: 36 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.3em", color: "rgba(200,212,240,0.3)", marginBottom: 10 }}>AURORA STUDIO</div>
          <h1 style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.02em", margin: 0, lineHeight: 1.1 }}>
            What are we<br />creating tonight?
          </h1>
          <p style={{ fontSize: 14, color: "rgba(200,212,240,0.35)", marginTop: 10, fontStyle: "italic" }}>Select a tool to begin.</p>
        </header>

        {/* Tool grid — 2-col */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 40 }}>
          {tools.map((tool) => (
            <div
              key={tool.label}
              style={{
                borderRadius: 16,
                overflow: "hidden",
                background: "#0D1020",
                border: "1px solid rgba(255,255,255,0.06)",
                cursor: "pointer",
                transition: "border-color 0.3s",
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.14)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)"}
            >
              {/* Image */}
              <div style={{ position: "relative", aspectRatio: "16/9", overflow: "hidden" }}>
                <img src={tool.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.75 }} />
                <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to top, #0D1020 0%, transparent 60%)` }} />
                {/* Glow */}
                <div style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "70%", height: 1, background: tool.glow, boxShadow: `0 0 30px 10px ${tool.glow}` }} />
                {/* Badge */}
                <div style={{ position: "absolute", top: 12, right: 12, background: "rgba(255,59,48,0.85)", borderRadius: 20, padding: "4px 10px", fontSize: 10, fontWeight: 700, color: "#fff" }}>
                  {tool.cost} CR
                </div>
              </div>
              {/* Text */}
              <div style={{ padding: "14px 16px 16px" }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 3 }}>{tool.label}</div>
                <div style={{ fontSize: 11, color: "rgba(200,212,240,0.35)", marginBottom: 10 }}>{tool.sub}</div>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "rgba(200,212,240,0.25)" }}>OPEN →</div>
              </div>
            </div>
          ))}
        </div>

        {/* Recent */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.25em", color: "rgba(200,212,240,0.3)" }}>RECENT PROJECTS</span>
            <span style={{ fontSize: 10, color: "rgba(200,212,240,0.25)", letterSpacing: "0.15em" }}>VIEW ALL →</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {recent.map(item => (
              <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.025)", cursor: "pointer" }}>
                <img src={item.img} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{item.label}</div>
                  <div style={{ fontSize: 10, color: "rgba(200,212,240,0.35)", marginTop: 2 }}>{item.type} · {item.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
