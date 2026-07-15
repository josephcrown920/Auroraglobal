import { Upload, Phone, Film, Sparkles, Zap, Crown, ArrowRight, Check, Play } from "lucide-react";

const AURORA_URL = "https://auroraperformancestudio.com";

const MODELS = ["Seedance 5.9", "Kling", "Gemini Omni", "Grok Imagine"];

const STEPS = [
  {
    n: "01",
    icon: Phone,
    title: "Record yourself performing",
    desc: "30 seconds on your phone. Any room. Any angle. Sing, dance, rap — your real movement is the source material.",
    accent: "from-cyan-500/25 to-blue-500/5",
    border: "border-cyan-500/25",
    color: "text-cyan-300",
    badgeBg: "bg-cyan-500/15 border-cyan-500/25",
  },
  {
    n: "02",
    icon: Sparkles,
    title: "Build your AI scene",
    desc: "Open Colors Studio or Scene Builder. Upload your selfie — Aurora generates a cinematic world: neon stages, luxury sets, any vibe.",
    accent: "from-violet-500/25 to-fuchsia-500/5",
    border: "border-violet-500/25",
    color: "text-violet-300",
    badgeBg: "bg-violet-500/15 border-violet-500/25",
  },
  {
    n: "03",
    icon: Film,
    title: "Aurora transfers your motion",
    desc: "Drop your phone clip + your AI image into Perform Anywhere. Motion Control reads your real energy and places you in the scene.",
    accent: "from-primary/25 to-violet-500/5",
    border: "border-primary/25",
    color: "text-primary",
    badgeBg: "bg-primary/15 border-primary/30",
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
  const sceneUrl = `${AURORA_URL}/scene-builder`;

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
      <section style={{ paddingTop: 120, paddingBottom: 80, paddingInline: 24, textAlign: "center", position: "relative", overflow: "hidden" }}>
        {/* ambient glows */}
        <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <div style={{ position: "absolute", top: -100, left: "50%", transform: "translateX(-50%)", width: 700, height: 400, borderRadius: "50%", background: "var(--accent-glow)", filter: "blur(100px)" }} />
          <div style={{ position: "absolute", bottom: 0, right: "10%", width: 300, height: 300, borderRadius: "50%", background: "oklch(0.55 0.18 320 / 0.12)", filter: "blur(80px)" }} />
        </div>

        <div style={{ position: "relative", maxWidth: 720, margin: "0 auto" }}>
          {/* Premium badge */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <div className="amber-badge badge">
              <Crown size={10} />
              Premium Feature · Motion Control AI
            </div>
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

          {/* Model badges */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 36 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.15em", textTransform: "uppercase", alignSelf: "center", marginRight: 4 }}>Powered by</span>
            {MODELS.map((m) => (
              <span key={m} className="badge">
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)", display: "inline-block", animation: "pulse-glow 2s ease-in-out infinite" }} />
                {m}
              </span>
            ))}
          </div>

          {/* CTAs */}
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href={motionUrl} className="btn-primary" style={{ fontSize: 16, padding: "16px 32px" }}>
              <Upload size={18} /> Upload Your Performance Clip
            </a>
            <a href={sceneUrl} className="btn-ghost" style={{ fontSize: 15 }}>
              <Sparkles size={16} /> Build Your Scene First
            </a>
          </div>

          <p style={{ marginTop: 14, fontSize: 12, color: "var(--text-muted)" }}>
            30 sec phone recording · any room · 5 Aura to start
          </p>
        </div>
      </section>

      {/* ── Before → After Visual ── */}
      <section style={{ padding: "0 24px 80px", maxWidth: 780, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 16, alignItems: "center" }}>
          {/* Before */}
          <div style={{ position: "relative", borderRadius: 20, overflow: "hidden", aspectRatio: "3/4", border: "1px solid var(--border)" }}>
            <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, oklch(0.14 0.025 240), oklch(0.10 0.02 260))", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 20 }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", border: "1px solid var(--border)", background: "var(--bg-elevated)", display: "grid", placeItems: "center" }}>
                <Phone size={24} color="var(--text-muted)" />
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>Your phone clip</p>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>30 sec · any room</p>
              </div>
              <div style={{ width: "100%", borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 4 }}>
                {["Real movement", "Your energy", "Any angle"].map((t) => (
                  <div key={t} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <Check size={12} color="var(--accent)" />
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{t}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ position: "absolute", top: 10, left: 10 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", background: "oklch(0 0 0 / 0.7)", border: "1px solid var(--border)", borderRadius: 100, padding: "4px 10px", color: "var(--text-muted)" }}>
                <Phone size={9} style={{ color: "#67e8f9" }} /> Input
              </span>
            </div>
          </div>

          {/* Arrow */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "oklch(0.72 0.2 300 / 0.15)", border: "1px solid var(--accent)", display: "grid", placeItems: "center", boxShadow: "0 0 24px -6px var(--accent)" }}>
              <Zap size={20} style={{ color: "var(--accent)" }} />
            </div>
            <p style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.2em", color: "var(--text-muted)", textAlign: "center", margin: 0 }}>Motion<br/>Control</p>
          </div>

          {/* After — CTA */}
          <a href={motionUrl} style={{ textDecoration: "none", display: "block", position: "relative", borderRadius: 20, overflow: "hidden", aspectRatio: "3/4", border: "1px solid oklch(0.72 0.2 300 / 0.5)", boxShadow: "0 0 60px -15px var(--accent)", cursor: "pointer" }}>
            <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, oklch(0.18 0.05 300), oklch(0.12 0.04 320))", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 20 }}>
              <div className="animate-float" style={{ width: 60, height: 60, borderRadius: "50%", background: "oklch(0.72 0.2 300 / 0.2)", border: "1px solid oklch(0.72 0.2 300 / 0.4)", display: "grid", placeItems: "center", boxShadow: "0 0 30px -6px var(--accent)" }}>
                <Upload size={26} style={{ color: "var(--accent)" }} />
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: "white" }}>Upload your clip here.</p>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>Tap to open Motion Control</p>
              </div>
              <span className="badge" style={{ marginTop: 4 }}>
                <Sparkles size={10} /> Perform Anywhere →
              </span>
            </div>
            <div style={{ position: "absolute", top: 10, left: 10 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", background: "oklch(0.72 0.2 300 / 0.2)", border: "1px solid oklch(0.72 0.2 300 / 0.35)", borderRadius: 100, padding: "4px 10px", color: "var(--accent)" }}>
                <Film size={9} /> AI Scene Output
              </span>
            </div>
          </a>
        </div>
      </section>

      {/* ── 3-Step Cards ── */}
      <section style={{ padding: "0 24px 80px", maxWidth: 960, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <p className="kicker" style={{ marginBottom: 12, justifyContent: "center" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", display: "inline-block" }} />
            How it works
          </p>
          <h2 style={{ fontSize: "clamp(1.6rem, 4vw, 2.4rem)", fontWeight: 800, letterSpacing: "-0.01em", margin: 0 }}>
            Three steps. Full cinematic output.
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} className="card card-hover animate-fade-in" style={{ padding: 24, position: "relative", overflow: "hidden", animationDelay: `${i * 80}ms` }}>
                <div style={{ position: "absolute", inset: -40, background: `linear-gradient(135deg, ${s.accent.replace("from-", "").replace(" to-", ", ")})`, filter: "blur(40px)", opacity: 0.3, pointerEvents: "none" }} />
                <div style={{ position: "relative" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                    <span className={`badge ${s.badgeBg}`} style={{ border: `1px solid ${s.border.replace("border-", "")}`, color: s.color.replace("text-", "") }}>
                      <Icon size={10} /> Step {s.n}
                    </span>
                    <span style={{ fontSize: 36, fontWeight: 900, color: "var(--border)", lineHeight: 1 }}>{s.n}</span>
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 8px" }}>{s.title}</h3>
                  <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6, margin: 0 }}>{s.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ padding: "0 24px 80px", maxWidth: 780, margin: "0 auto" }}>
        <div className="card" style={{ padding: "36px 40px", border: "1px solid oklch(0.72 0.2 300 / 0.3)", background: "linear-gradient(135deg, oklch(0.12 0.035 300 / 0.6), oklch(0.085 0.022 272 / 0.8))", boxShadow: "0 0 80px -30px var(--accent-glow)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
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
              <div className="amber-badge badge">
                <Crown size={10} /> Seedance 5.9 · Kling · Gemini Omni · Grok Imagine
              </div>
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
