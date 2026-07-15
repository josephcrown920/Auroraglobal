import { Upload, Sparkles, Zap, Crown, Check, Play, ArrowRight } from "lucide-react";

const AURORA_URL = "https://auroraperformancestudio.com";
const MODELS = ["Seedance 5.9", "Kling", "Gemini Omni", "Grok Imagine"];
const BASE = import.meta.env.BASE_URL;

const STEPS = [
  {
    n: "01",
    emoji: "📱",
    title: "Record yourself performing",
    desc: "30 seconds on your phone. Any room. Sing, dance, rap — your real movement is the source material.",
  },
  {
    n: "02",
    emoji: "✨",
    title: "Build your AI scene",
    desc: "Upload a selfie in Colors Studio or Scene Builder. Aurora generates the world: neon stages, luxury sets, any vibe.",
  },
  {
    n: "03",
    emoji: "🎬",
    title: "Aurora transfers your motion",
    desc: "Drop your phone clip + your AI image into Perform Anywhere. Motion Control places you inside the scene.",
  },
];

const FEATURES = [
  "Real motion transfer — no green screen",
  "Identity locked across every frame",
  "Cinematic 9:16 portrait output",
  "Seedance 5.9, Kling, Gemini Omni & Grok Imagine",
  "No studio. No crew. No budget.",
  "30-second clip is all you need",
];

export default function App() {
  const motionUrl = `${AURORA_URL}/motion`;
  const colorsUrl = `${AURORA_URL}/colors`;
  const sceneUrl  = `${AURORA_URL}/scene-builder`;

  return (
    <div style={{ background: "var(--bg)", minHeight: "100dvh", color: "var(--text)" }}>

      {/* ── Nav ── */}
      <nav style={{ position: "fixed", top: 0, inset: "0 0 auto", zIndex: 50, borderBottom: "1px solid var(--border)", backdropFilter: "blur(16px)", background: "oklch(0.085 0.022 272 / 0.85)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 24px" }}>
        <a href={AURORA_URL} style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "var(--text)", fontWeight: 700, fontSize: 15 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--gradient-hero)", display: "grid", placeItems: "center" }}>
            <Sparkles size={14} color="white" />
          </div>
          Aurora
        </a>
        <div style={{ display: "flex", gap: 10 }}>
          <a href={colorsUrl} className="btn-ghost" style={{ padding: "8px 16px", fontSize: 13 }}>Colors Studio</a>
          <a href={motionUrl} className="btn-primary" style={{ padding: "10px 20px", fontSize: 13 }}>
            <Upload size={14} /> Upload Your Clip
          </a>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ paddingTop: 120, paddingBottom: 60, paddingInline: 24, textAlign: "center", position: "relative", overflow: "hidden" }}>
        {/* NBA Josh cover photo — full bleed behind hero text */}
        <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <img
            src={`${BASE}cover-artist.png`}
            alt=""
            style={{ position: "absolute", right: -40, top: 0, height: "100%", width: "auto", objectFit: "cover", opacity: 0.18, filter: "saturate(1.4)" }}
          />
          <div style={{ position: "absolute", top: -100, left: "50%", transform: "translateX(-50%)", width: 700, height: 400, borderRadius: "50%", background: "var(--accent-glow)", filter: "blur(100px)" }} />
        </div>

        <div style={{ position: "relative", maxWidth: 720, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <div className="amber-badge badge"><Crown size={10} /> Premium Feature · Motion Control AI</div>
          </div>

          <p className="kicker" style={{ marginBottom: 16, justifyContent: "center" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", display: "inline-block", animation: "pulse-glow 2s ease-in-out infinite" }} />
            Perform Anywhere
          </p>

          <h1 style={{ fontSize: "clamp(2.4rem, 7vw, 4.5rem)", fontWeight: 900, lineHeight: 1.05, letterSpacing: "-0.02em", margin: "0 0 20px" }}>
            Film yourself anywhere.<br />
            <span className="gradient-text">Aurora builds the world.</span>
          </h1>

          <p style={{ fontSize: "clamp(15px, 2.5vw, 18px)", color: "var(--text-muted)", lineHeight: 1.7, maxWidth: 560, margin: "0 auto 32px" }}>
            Aurora's <strong style={{ color: "var(--text)" }}>Motion Control</strong> reads your real movement from a 30-second phone clip and transfers it into your AI-generated cinematic scene — style, energy, identity. No studio. No crew. No budget.
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 36 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.15em", textTransform: "uppercase", alignSelf: "center", marginRight: 4 }}>Powered by</span>
            {MODELS.map((m) => (
              <span key={m} className="badge">
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)", display: "inline-block", animation: "pulse-glow 2s ease-in-out infinite" }} />
                {m}
              </span>
            ))}
          </div>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href={motionUrl} className="btn-primary" style={{ fontSize: 16, padding: "16px 32px" }}>
              <Upload size={18} /> Upload Your Performance Clip
            </a>
            <a href={sceneUrl} className="btn-ghost" style={{ fontSize: 15 }}>
              <Sparkles size={16} /> Build Your Scene First
            </a>
          </div>
          <p style={{ marginTop: 14, fontSize: 12, color: "var(--text-muted)" }}>30 sec phone recording · any room · 5 Aura to start</p>
        </div>
      </section>

      {/* ── REAL EXAMPLE — Before → After ── */}
      <section style={{ padding: "0 24px 72px", maxWidth: 900, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <p className="kicker" style={{ marginBottom: 10, justifyContent: "center" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", display: "inline-block" }} />
            See the inputs → see the result
          </p>
          <h2 style={{ fontSize: "clamp(1.4rem, 3.5vw, 2rem)", fontWeight: 800, letterSpacing: "-0.01em", margin: 0 }}>
            Real references. Real render.
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 8 }}>
            This is what your shoot can look like. Identity photo · outfit · scene · motion clip → cinematic output.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 20, alignItems: "center" }}>
          {/* LEFT — What you provide (real screenshot of the tool) */}
          <div style={{ position: "relative", borderRadius: 20, overflow: "hidden", border: "1px solid var(--border)" }}>
            <img
              src={`${BASE}examples/inputs.jpg`}
              alt="Perform Anywhere input panel — identity photo, outfit reference, scene reference"
              style={{ width: "100%", display: "block", borderRadius: 20 }}
            />
            <div style={{ position: "absolute", top: 10, left: 10 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", background: "oklch(0 0 0 / 0.75)", border: "1px solid var(--border)", borderRadius: 100, padding: "4px 10px", color: "white", backdropFilter: "blur(8px)" }}>
                📱 What you provide
              </span>
            </div>
          </div>

          {/* Arrow */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "oklch(0.72 0.2 300 / 0.15)", border: "1px solid var(--accent)", display: "grid", placeItems: "center", boxShadow: "0 0 30px -8px var(--accent)" }}>
              <Zap size={22} style={{ color: "var(--accent)" }} />
            </div>
            <p style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.2em", color: "var(--text-muted)", textAlign: "center", margin: 0, lineHeight: 1.5 }}>Motion<br/>Control</p>
          </div>

          {/* RIGHT — The result (real screenshot of rendered output) */}
          <a href={motionUrl} style={{ display: "block", position: "relative", borderRadius: 20, overflow: "hidden", border: "1px solid oklch(0.72 0.2 300 / 0.5)", boxShadow: "0 0 60px -15px var(--accent)", textDecoration: "none" }}>
            <img
              src={`${BASE}examples/result.jpg`}
              alt="Scene Builder rendered result — artist composited into cinematic AI scene"
              style={{ width: "100%", display: "block", borderRadius: 20 }}
            />
            <div style={{ position: "absolute", top: 10, left: 10 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", background: "oklch(0.72 0.2 300 / 0.85)", border: "1px solid oklch(0.72 0.2 300 / 0.4)", borderRadius: 100, padding: "4px 10px", color: "white", backdropFilter: "blur(8px)" }}>
                ✅ Rendered output
              </span>
            </div>
            {/* Hover CTA overlay */}
            <div style={{ position: "absolute", inset: 0, background: "oklch(0 0 0 / 0)", display: "flex", alignItems: "flex-end", padding: 16, transition: "background 0.2s" }}>
              <span className="badge" style={{ opacity: 0.92 }}>
                <Upload size={10} /> Tap to try it →
              </span>
            </div>
          </a>
        </div>

        {/* Caption row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 20, marginTop: 12 }}>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
            <strong style={{ color: "var(--text)" }}>INPUTS</strong> Identity photo · Outfit (hoodie + chain) · Scene (LA street, golden hour) · Motion clip
          </p>
          <div />
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
            <strong style={{ color: "var(--text)" }}>FINAL</strong> Hyper-real composite · identity preserved · golden-hour grade
          </p>
        </div>
      </section>

      {/* ── Hero design preview ── */}
      <section style={{ padding: "0 24px 72px", maxWidth: 700, margin: "0 auto" }}>
        <div style={{ borderRadius: 24, overflow: "hidden", border: "1px solid oklch(0.72 0.2 300 / 0.3)", boxShadow: "0 0 60px -20px var(--accent-glow)" }}>
          <img
            src={`${BASE}examples/hero.jpg`}
            alt="Film yourself anywhere — Aurora builds the world. Motion Control feature overview."
            style={{ width: "100%", display: "block" }}
          />
        </div>
      </section>

      {/* ── 3-Step Cards ── */}
      <section style={{ padding: "0 24px 72px", maxWidth: 960, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <p className="kicker" style={{ marginBottom: 10, justifyContent: "center" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", display: "inline-block" }} />
            How it works
          </p>
          <h2 style={{ fontSize: "clamp(1.6rem, 4vw, 2.2rem)", fontWeight: 800, letterSpacing: "-0.01em", margin: 0 }}>
            Three steps. Full cinematic output.
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
          {STEPS.map((s, i) => (
            <div key={i} className="card card-hover" style={{ padding: 22, position: "relative", animationDelay: `${i * 80}ms` }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                <span style={{ fontSize: 26 }}>{s.emoji}</span>
                <span style={{ fontSize: 36, fontWeight: 900, color: "var(--border)", lineHeight: 1 }}>{s.n}</span>
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 8px" }}>{s.title}</h3>
              <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6, margin: 0 }}>{s.desc}</p>
              {i < STEPS.length - 1 && (
                <div style={{ position: "absolute", right: -18, top: "50%", transform: "translateY(-50%)", display: "none" }}>
                  <ArrowRight size={14} color="var(--border)" />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Feature checklist ── */}
      <section style={{ padding: "0 24px 72px", maxWidth: 780, margin: "0 auto" }}>
        <div className="card" style={{ padding: "32px 36px", border: "1px solid oklch(0.72 0.2 300 / 0.3)", background: "linear-gradient(135deg, oklch(0.12 0.035 300 / 0.6), oklch(0.085 0.022 272 / 0.8))", boxShadow: "0 0 80px -30px var(--accent-glow)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 }}>
            {FEATURES.map((f) => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: "oklch(0.72 0.2 300 / 0.15)", border: "1px solid oklch(0.72 0.2 300 / 0.3)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <Check size={11} style={{ color: "var(--accent)" }} />
                </div>
                <span style={{ fontSize: 13, color: "oklch(0.85 0.01 272)" }}>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section style={{ padding: "0 24px 100px", maxWidth: 680, margin: "0 auto", textAlign: "center" }}>
        <div style={{ position: "relative" }}>
          <div aria-hidden style={{ position: "absolute", inset: -60, background: "var(--accent-glow)", filter: "blur(80px)", pointerEvents: "none" }} />
          <div style={{ position: "relative" }}>
            <div style={{ marginBottom: 16, display: "flex", justifyContent: "center" }}>
              <div className="amber-badge badge"><Crown size={10} /> Seedance 5.9 · Kling · Gemini Omni · Grok Imagine</div>
            </div>
            <h2 style={{ fontSize: "clamp(1.8rem, 5vw, 3rem)", fontWeight: 900, letterSpacing: "-0.02em", margin: "0 0 16px" }}>
              Ready to perform anywhere?
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: 16, margin: "0 0 32px", lineHeight: 1.6 }}>
              Upload your 30-second performance clip and let Aurora build the cinematic world around you.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <a href={motionUrl} className="btn-primary" style={{ fontSize: 16, padding: "16px 36px" }}>
                <Upload size={18} /> Upload Your Clip →
              </a>
              <a href={colorsUrl} className="btn-ghost">
                <Play size={15} /> Build Your Scene First
              </a>
            </div>
            <p style={{ marginTop: 16, fontSize: 12, color: "var(--text-muted)" }}>
              Starts at 5 Aura · Secure payment via Paystack · Cancel anytime
            </p>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: "1px solid var(--border)", padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <a href={AURORA_URL} style={{ textDecoration: "none", color: "var(--text-muted)", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
          <Sparkles size={13} style={{ color: "var(--accent)" }} /> Aurora Performance Studio
        </a>
        <div style={{ display: "flex", gap: 20 }}>
          {[["Motion Control", motionUrl], ["Colors Studio", colorsUrl], ["Scene Builder", sceneUrl]].map(([label, href]) => (
            <a key={label} href={href} style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>{label}</a>
          ))}
        </div>
      </footer>
    </div>
  );
}
