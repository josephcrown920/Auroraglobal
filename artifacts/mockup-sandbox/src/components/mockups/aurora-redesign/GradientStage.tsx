/**
 * Gradient Stage — vibrant per-tool gradient cards, no photography.
 * Bold, expressive, energetic. Mobile-first feel on a wide canvas.
 * Each tool owns a distinct color world.
 */

const tools = [
  {
    label: "Colors",
    sub: "Performance photos",
    cost: 2,
    grad: "linear-gradient(135deg, #FF6B35 0%, #FF3CAC 100%)",
    accent: "#FF6B35",
    icon: "◉",
  },
  {
    label: "Motion",
    sub: "Cinematic clips",
    cost: 10,
    grad: "linear-gradient(135deg, #2D00F7 0%, #6A00FF 50%, #BC00DD 100%)",
    accent: "#7B2FFF",
    icon: "▶",
  },
  {
    label: "Lip Sync",
    sub: "Audio-synced video",
    cost: 8,
    grad: "linear-gradient(135deg, #00C6FB 0%, #005BEA 100%)",
    accent: "#00C6FB",
    icon: "♪",
  },
  {
    label: "Music Video",
    sub: "Full production",
    cost: 12,
    grad: "linear-gradient(135deg, #F7971E 0%, #FFD200 100%)",
    accent: "#FFD200",
    icon: "◈",
  },
  {
    label: "TikTok30 UGC",
    sub: "Campaign batches",
    cost: 6,
    grad: "linear-gradient(135deg, #11998E 0%, #38EF7D 100%)",
    accent: "#38EF7D",
    icon: "⬡",
  },
];

export default function GradientStage() {
  return (
    <div style={{
      background: "#0A0A0A",
      minHeight: "100vh",
      fontFamily: "'Inter', sans-serif",
      color: "#fff",
    }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "linear-gradient(135deg,#FF6B35,#BC00DD)" }} />
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.2em" }}>AURORA</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <span style={{ fontSize: 11, color: "#555" }}>Gallery</span>
          <span style={{ fontSize: 11, color: "#555" }}>Settings</span>
          <div style={{ background: "#181818", border: "1px solid #2A2A2A", borderRadius: 20, padding: "6px 16px", fontSize: 12, fontWeight: 700 }}>
            ✦ 250
          </div>
        </div>
      </div>

      {/* Header */}
      <div style={{ padding: "24px 28px 32px" }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.3em", color: "#444", marginBottom: 8 }}>SELECT A TOOL</div>
        <h1 style={{ fontSize: 40, fontWeight: 800, margin: 0, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
          Create something<br />extraordinary.
        </h1>
      </div>

      {/* Cards — 2-col grid */}
      <div style={{ padding: "0 28px 40px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {tools.map((tool) => (
          <div
            key={tool.label}
            style={{
              borderRadius: 20,
              overflow: "hidden",
              cursor: "pointer",
              position: "relative",
            }}
          >
            {/* Gradient body */}
            <div style={{
              background: tool.grad,
              padding: "28px 24px 24px",
              position: "relative",
              minHeight: 160,
            }}>
              {/* Noise texture overlay */}
              <div style={{
                position: "absolute", inset: 0,
                backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.08'/%3E%3C/svg%3E\")",
                opacity: 0.4,
              }} />

              {/* Icon */}
              <div style={{ fontSize: 28, marginBottom: 32, opacity: 0.9, position: "relative" }}>{tool.icon}</div>

              {/* Cost badge */}
              <div style={{
                position: "absolute", top: 16, right: 16,
                background: "rgba(0,0,0,0.3)",
                backdropFilter: "blur(8px)",
                borderRadius: 20, padding: "4px 12px",
                fontSize: 11, fontWeight: 700, color: "#fff",
              }}>
                {tool.cost} CR
              </div>

              {/* Name */}
              <div style={{ position: "relative", fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: "#fff" }}>{tool.label}</div>
            </div>

            {/* Text row */}
            <div style={{
              background: "#111",
              padding: "12px 16px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderTop: `1px solid ${tool.accent}22`,
            }}>
              <span style={{ fontSize: 11, color: "#666" }}>{tool.sub}</span>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: tool.accent }}>OPEN →</span>
            </div>
          </div>
        ))}
      </div>

      {/* Recent section */}
      <div style={{ padding: "0 28px 40px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.25em", color: "#444" }}>RECENT</span>
          <span style={{ fontSize: 10, color: "#444" }}>VIEW ALL →</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {tools.slice(0, 3).map(tool => (
            <div
              key={tool.label}
              style={{
                aspectRatio: "1",
                borderRadius: 14,
                background: tool.grad,
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                padding: 14,
                position: "relative",
                overflow: "hidden",
                cursor: "pointer",
              }}
            >
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 60%)" }} />
              <div style={{ position: "relative" }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{tool.label} project</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>2 days ago</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
