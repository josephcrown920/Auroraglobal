/**
 * Tabloid — editorial magazine layout.
 * Giant bold type, full-bleed image strips, no sidebar chrome.
 * Feels like NME / Dazed meets a dark creative tool.
 */

const tools = [
  { id: "01", label: "Colors", sub: "Performance photos", cost: "2 CR", img: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200&q=90&fit=crop", color: "#E8FF47" },
  { id: "02", label: "Motion", sub: "Cinematic clips", cost: "10 CR", img: "https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=1200&q=90&fit=crop", color: "#FF6BCD" },
  { id: "03", label: "Lip Sync", sub: "Audio-synced video", cost: "8 CR", img: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1200&q=90&fit=crop", color: "#6BFFF0" },
  { id: "04", label: "Music Video", sub: "Full production", cost: "12 CR", img: "https://images.unsplash.com/photo-1598387993441-a364f854cde0?w=1200&q=90&fit=crop", color: "#FF9A3C" },
  { id: "05", label: "TikTok30", sub: "UGC campaign batch", cost: "6 CR", img: "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=1200&q=90&fit=crop", color: "#A78BFF" },
];

export default function Tabloid() {
  return (
    <div style={{ background: "#080808", minHeight: "100vh", fontFamily: "'Inter', sans-serif", color: "#fff", overflow: "hidden" }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 32px", borderBottom: "1px solid #222" }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.3em", color: "#555" }}>AURORA STUDIO</span>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <span style={{ fontSize: 11, color: "#555", letterSpacing: "0.15em" }}>GALLERY</span>
          <span style={{ fontSize: 11, color: "#555", letterSpacing: "0.15em" }}>SETTINGS</span>
          <div style={{ background: "#1A1A1A", border: "1px solid #333", borderRadius: 20, padding: "6px 14px", fontSize: 11, fontWeight: 700, color: "#fff", display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ color: "#FF3B30" }}>✦</span> 250
          </div>
        </div>
      </div>

      {/* Hero headline */}
      <div style={{ padding: "48px 32px 24px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.3em", color: "#444", marginBottom: 12 }}>EVERY TOOL</div>
        <div style={{ fontSize: "clamp(52px, 8vw, 96px)", fontWeight: 900, lineHeight: 0.92, letterSpacing: "-0.03em", textTransform: "uppercase" }}>
          Create<br />
          <span style={{ WebkitTextStroke: "1px #fff", color: "transparent" }}>something</span><br />
          new.
        </div>
      </div>

      {/* Tool strips */}
      <div style={{ padding: "0 32px 40px", display: "flex", flexDirection: "column", gap: 2 }}>
        {tools.map((tool) => (
          <div
            key={tool.id}
            style={{
              position: "relative",
              height: 88,
              overflow: "hidden",
              cursor: "pointer",
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
            }}
            onMouseEnter={e => {
              (e.currentTarget.querySelector(".strip-img") as HTMLElement).style.opacity = "0.35";
              (e.currentTarget.querySelector(".strip-num") as HTMLElement).style.color = tool.color;
            }}
            onMouseLeave={e => {
              (e.currentTarget.querySelector(".strip-img") as HTMLElement).style.opacity = "0.15";
              (e.currentTarget.querySelector(".strip-num") as HTMLElement).style.color = "#333";
            }}
          >
            {/* BG image */}
            <img
              className="strip-img"
              src={tool.img}
              alt=""
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.15, transition: "opacity 0.4s" }}
            />
            {/* Content */}
            <div style={{ position: "relative", display: "flex", alignItems: "center", width: "100%", padding: "0 20px", borderTop: "1px solid #1A1A1A", gap: 24 }}>
              <span className="strip-num" style={{ fontSize: 11, fontWeight: 700, color: "#333", letterSpacing: "0.1em", minWidth: 28, transition: "color 0.3s" }}>{tool.id}</span>
              <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", flex: 1, textTransform: "uppercase" }}>{tool.label}</span>
              <span style={{ fontSize: 11, color: "#555", letterSpacing: "0.1em" }}>{tool.sub}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#FF3B30", background: "rgba(255,59,48,0.1)", padding: "4px 10px", borderRadius: 12 }}>{tool.cost}</span>
              <span style={{ fontSize: 11, color: "#444", letterSpacing: "0.15em" }}>OPEN →</span>
            </div>
          </div>
        ))}
      </div>

      {/* Recent work heading */}
      <div style={{ padding: "0 32px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.25em", color: "#444" }}>RECENT WORK</span>
        <span style={{ fontSize: 11, color: "#444", letterSpacing: "0.15em" }}>VIEW ALL →</span>
      </div>

      {/* Recent grid */}
      <div style={{ padding: "0 32px 40px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2 }}>
        {[
          "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&q=80",
          "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&q=80",
          "https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=400&q=80",
          "https://images.unsplash.com/photo-1598387993441-a364f854cde0?w=400&q=80",
        ].map((src, i) => (
          <div key={i} style={{ aspectRatio: "4/3", overflow: "hidden", borderRadius: 2 }}>
            <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", filter: "grayscale(20%)" }} />
          </div>
        ))}
      </div>
    </div>
  );
}
