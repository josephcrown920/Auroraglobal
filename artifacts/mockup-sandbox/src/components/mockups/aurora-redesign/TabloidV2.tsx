/**
 * TabloidV2 — Full Aurora product showcase.
 * Editorial magazine aesthetic. All flagship tools. Animated loop visuals.
 * No hamburgers. Premium-first ordering. Multi-screen navigation.
 */

import { useState, useEffect } from "react";

const TOOLS = [
  {
    id: "00",
    label: "Perform Anywhere",
    sub: "AI live performance engine",
    desc: "Transform any stage into a cinematic production. Real-time AI direction, multi-camera sync, and instant broadcast-ready cuts.",
    cost: "FREE",
    badge: "FLAGSHIP",
    color: "#E8FF47",
    accent: "#E8FF47",
    anim: "perform",
    tags: ["Live", "Multi-cam", "Real-time"],
  },
  {
    id: "01",
    label: "Colors",
    sub: "Performance photo generation",
    desc: "AI-powered high-fidelity performance photography. One prompt. 50 editorial-grade shots.",
    cost: "2 CR",
    badge: null,
    color: "#FF6BCD",
    accent: "#FF6BCD",
    anim: "colors",
    tags: ["Photos", "Editorial", "AI"],
  },
  {
    id: "02",
    label: "TikTok30",
    sub: "UGC campaign engine",
    desc: "Generate a full month of on-brand TikTok content in one session. Hook-first scripts, trending formats, auto-captions.",
    cost: "6 CR",
    badge: null,
    color: "#A78BFF",
    accent: "#A78BFF",
    anim: "tiktok",
    tags: ["UGC", "Campaigns", "Batch"],
  },
  {
    id: "03",
    label: "Video Agent",
    sub: "AI video production assistant",
    desc: "Describe your vision in plain language. The Video Agent plans, shoots, and assembles the final cut autonomously.",
    cost: "10 CR",
    badge: null,
    color: "#3CF0FF",
    accent: "#3CF0FF",
    anim: "agent",
    tags: ["Autonomous", "Full-cut", "AI director"],
  },
  {
    id: "04",
    label: "Director's Room",
    sub: "Cinematic visual studio",
    desc: "Full production suite: Storyboard builder, Scene Weaver, AI Auto-Cuts editor, and one-click color grading.",
    cost: "12 CR",
    badge: "SUITE",
    color: "#FFB340",
    accent: "#FFB340",
    anim: "director",
    tags: ["Storyboards", "Scene Weaver", "Auto Cuts"],
  },
  {
    id: "05",
    label: "GRWM",
    sub: "Get Ready With Me",
    desc: "Beauty, lifestyle, and behind-the-scenes content engine. Mirror-ready lighting scripts, tutorial cuts, vlog formatting.",
    cost: "6 CR",
    badge: null,
    color: "#FF8FAB",
    accent: "#FF8FAB",
    anim: "grwm",
    tags: ["Beauty", "Lifestyle", "Vlog"],
  },
  {
    id: "06",
    label: "Motion Control",
    sub: "Kinetic visual generation",
    desc: "Physics-driven motion graphics, particle systems, and real-time generative visuals synced to your audio track.",
    cost: "10 CR",
    badge: "FLAGSHIP",
    color: "#FFFFFF",
    accent: "#fff",
    anim: "motion",
    tags: ["Particles", "Generative", "Audio-sync"],
  },
];

/* ── Animated loop backgrounds ── */
function AnimLoop({ type, accent }: { type: string; accent: string }) {
  const s: React.CSSProperties = { position: "absolute", inset: 0, overflow: "hidden" };

  if (type === "perform") return (
    <div style={s}>
      <style>{`
        @keyframes stageBeam { 0%,100%{opacity:.18;transform:rotate(-12deg) scaleY(1)} 50%{opacity:.38;transform:rotate(-12deg) scaleY(1.1)} }
        @keyframes stageBeam2 { 0%,100%{opacity:.12;transform:rotate(8deg) scaleY(1)} 50%{opacity:.28;transform:rotate(8deg) scaleY(1.15)} }
        @keyframes auroraPulse { 0%,100%{opacity:.55} 50%{opacity:.85} }
      `}</style>
      <div style={{ position:"absolute", inset:0, background:`radial-gradient(ellipse 80% 60% at 50% 100%, ${accent}22 0%, transparent 70%)`, animation:"auroraPulse 3s ease-in-out infinite" }}/>
      <div style={{ position:"absolute", bottom:0, left:"30%", width:4, height:"120%", background:`linear-gradient(to top, ${accent}88, transparent)`, transformOrigin:"bottom center", animation:"stageBeam 4s ease-in-out infinite" }}/>
      <div style={{ position:"absolute", bottom:0, left:"60%", width:3, height:"100%", background:`linear-gradient(to top, ${accent}55, transparent)`, transformOrigin:"bottom center", animation:"stageBeam2 3.5s ease-in-out infinite" }}/>
      <div style={{ position:"absolute", bottom:0, left:"45%", width:5, height:"140%", background:`linear-gradient(to top, ${accent}44, transparent)`, transformOrigin:"bottom center", animation:"stageBeam 5s ease-in-out infinite reverse" }}/>
    </div>
  );

  if (type === "colors") return (
    <div style={s}>
      <style>{`@keyframes colorSweep { 0%{background-position:0% 50%} 100%{background-position:200% 50%} }`}</style>
      <div style={{ position:"absolute", inset:0, background:`linear-gradient(135deg, ${accent}33 0%, transparent 50%, ${accent}22 100%)`, backgroundSize:"200% 200%", animation:"colorSweep 6s linear infinite" }}/>
    </div>
  );

  if (type === "tiktok") return (
    <div style={s}>
      <style>{`
        @keyframes scanline { 0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)} }
        @keyframes ttPulse { 0%,100%{opacity:.6} 50%{opacity:1} }
      `}</style>
      <div style={{ position:"absolute", inset:0, background:`radial-gradient(circle at 70% 50%, ${accent}25 0%, transparent 60%)`, animation:"ttPulse 2.5s ease-in-out infinite" }}/>
      <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:`linear-gradient(to right, transparent, ${accent}66, transparent)`, animation:"scanline 4s linear infinite" }}/>
    </div>
  );

  if (type === "agent") return (
    <div style={s}>
      <style>{`
        @keyframes gridPulse { 0%,100%{opacity:.08} 50%{opacity:.18} }
        @keyframes dot { 0%,100%{transform:scale(1);opacity:.4} 50%{transform:scale(1.8);opacity:.9} }
      `}</style>
      <div style={{ position:"absolute", inset:0, backgroundImage:`linear-gradient(${accent}15 1px,transparent 1px),linear-gradient(90deg,${accent}15 1px,transparent 1px)`, backgroundSize:"40px 40px", animation:"gridPulse 3s ease-in-out infinite" }}/>
      {[20,40,60,80].map(x => [30,60].map(y => (
        <div key={`${x}${y}`} style={{ position:"absolute", left:`${x}%`, top:`${y}%`, width:4, height:4, borderRadius:"50%", background:accent, animation:`dot ${1.5+x/40}s ease-in-out infinite ${y/100}s` }}/>
      )))}
    </div>
  );

  if (type === "director") return (
    <div style={s}>
      <style>{`
        @keyframes filmGrain { 0%{background-position:0 0} 100%{background-position:100px 100px} }
        @keyframes goldGlow { 0%,100%{opacity:.5} 50%{opacity:.85} }
      `}</style>
      <div style={{ position:"absolute", inset:0, background:`radial-gradient(ellipse 120% 80% at 20% 50%, ${accent}20 0%, transparent 65%)`, animation:"goldGlow 4s ease-in-out infinite" }}/>
      <div style={{ position:"absolute", top:"20%", left:0, right:0, height:1, background:`linear-gradient(to right, transparent 0%, ${accent}40 30%, ${accent}40 70%, transparent 100%)` }}/>
      <div style={{ position:"absolute", top:"80%", left:0, right:0, height:1, background:`linear-gradient(to right, transparent 0%, ${accent}40 30%, ${accent}40 70%, transparent 100%)` }}/>
    </div>
  );

  if (type === "grwm") return (
    <div style={s}>
      <style>{`@keyframes rosePulse { 0%,100%{opacity:.4;transform:scale(1)} 50%{opacity:.7;transform:scale(1.08)} }`}</style>
      <div style={{ position:"absolute", inset:0, background:`radial-gradient(circle at 50% 40%, ${accent}30 0%, transparent 60%)`, animation:"rosePulse 3.5s ease-in-out infinite" }}/>
    </div>
  );

  if (type === "motion") return (
    <div style={s}>
      <style>{`
        @keyframes particle { 0%{transform:translate(0,0) scale(1);opacity:.7} 100%{transform:translate(var(--dx),var(--dy)) scale(0);opacity:0} }
      `}</style>
      {Array.from({length:12}).map((_,i) => (
        <div key={i} style={{
          position:"absolute",
          left:`${10+i*7}%`, top:`${20+((i*31)%60)}%`,
          width: i%3===0?6:3, height: i%3===0?6:3,
          borderRadius:"50%", background:accent,
          "--dx":`${(i%2===0?1:-1)*(20+i*8)}px`,
          "--dy":`${(i%3===0?-1:1)*(15+i*5)}px`,
          animation:`particle ${1.5+(i%4)*0.4}s ease-out infinite ${(i*0.2)%1.2}s`,
        } as React.CSSProperties}/>
      ))}
      <div style={{ position:"absolute", inset:0, background:`radial-gradient(circle at 50% 50%, #ffffff15 0%, transparent 60%)` }}/>
    </div>
  );

  return <div style={s}><div style={{ position:"absolute", inset:0, background:`radial-gradient(circle at 50% 50%, ${accent}20 0%, transparent 70%)` }}/></div>;
}

/* ── Tool strip row ── */
function ToolStrip({ tool, onOpen }: { tool: typeof TOOLS[0]; onOpen: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        height: hovered ? 110 : 96,
        overflow: "hidden",
        cursor: "pointer",
        borderBottom: "1px solid #181818",
        display: "flex",
        alignItems: "center",
        transition: "height 0.25s ease",
        background: hovered ? "#0e0e0e" : "transparent",
      }}
    >
      <AnimLoop type={tool.anim} accent={tool.accent} />
      <div style={{ position: "relative", display: "flex", alignItems: "center", width: "100%", padding: "0 32px", gap: 20 }}>
        {/* Number */}
        <span style={{ fontSize: 10, fontWeight: 700, color: hovered ? tool.color : "#2a2a2a", letterSpacing: "0.12em", minWidth: 24, transition: "color 0.3s" }}>{tool.id}</span>
        {/* Name + tags */}
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <span style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.025em", textTransform: "uppercase", color: "#fff" }}>{tool.label}</span>
            {tool.badge && (
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.2em", color: tool.color, border: `1px solid ${tool.color}44`, padding: "2px 8px", borderRadius: 2 }}>{tool.badge}</span>
            )}
          </div>
          {hovered && (
            <div style={{ display: "flex", gap: 8, marginTop: 4, animation: "fadeIn 0.2s ease" }}>
              {tool.tags.map(t => (
                <span key={t} style={{ fontSize: 9, color: "#555", letterSpacing: "0.12em", textTransform: "uppercase" }}>{t}</span>
              ))}
            </div>
          )}
        </div>
        {/* Sub + cost + CTA */}
        <span style={{ fontSize: 11, color: "#444", letterSpacing: "0.08em", display: hovered ? "none" : "block" }}>{tool.sub}</span>
        <span style={{ fontSize: 10, fontWeight: 800, color: tool.cost === "FREE" ? tool.color : "#FF3B30", background: tool.cost === "FREE" ? `${tool.color}15` : "rgba(255,59,48,0.1)", padding: "5px 12px", borderRadius: 14 }}>{tool.cost}</span>
        <span style={{ fontSize: 10, color: hovered ? "#fff" : "#333", letterSpacing: "0.18em", fontWeight: 600, transition: "color 0.3s" }}>OPEN →</span>
      </div>
    </div>
  );
}

/* ── Tool detail view ── */
function ToolDetail({ tool, onBack }: { tool: typeof TOOLS[0]; onBack: () => void }) {
  return (
    <div style={{ background: "#080808", minHeight: "100vh", color: "#fff", fontFamily: "'Inter', sans-serif" }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 32px", borderBottom: "1px solid #181818" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 11, letterSpacing: "0.15em", fontWeight: 700, display: "flex", alignItems: "center", gap: 8, padding: 0 }}>← BACK</button>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.3em", color: "#333" }}>AURORA STUDIO</span>
        <div style={{ display: "flex", gap: 6, alignItems: "center", background: "#111", border: "1px solid #2a2a2a", borderRadius: 20, padding: "6px 14px" }}>
          <span style={{ color: "#FF3B30", fontSize: 11 }}>✦</span>
          <span style={{ fontSize: 11, fontWeight: 700 }}>250</span>
        </div>
      </div>

      {/* Hero visual */}
      <div style={{ position: "relative", height: 380, overflow: "hidden" }}>
        <AnimLoop type={tool.anim} accent={tool.accent} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 30%, #080808 100%)" }}/>
        <div style={{ position: "absolute", bottom: 40, left: 32, right: 32 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: tool.color, letterSpacing: "0.3em", marginBottom: 10 }}>{tool.id} — {tool.sub}</div>
          <div style={{ fontSize: "clamp(42px, 6vw, 72px)", fontWeight: 900, letterSpacing: "-0.03em", textTransform: "uppercase", lineHeight: 0.9 }}>{tool.label}</div>
        </div>
      </div>

      {/* Description + tags */}
      <div style={{ padding: "32px 32px 24px" }}>
        <p style={{ fontSize: 16, color: "#888", lineHeight: 1.7, maxWidth: 600, margin: 0 }}>{tool.desc}</p>
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          {tool.tags.map(t => (
            <span key={t} style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: tool.color, border: `1px solid ${tool.color}33`, padding: "6px 14px", borderRadius: 3, textTransform: "uppercase" }}>{t}</span>
          ))}
        </div>
      </div>

      {/* Sub-features (Director's Room special) */}
      {tool.id === "04" && (
        <div style={{ padding: "0 32px 32px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.25em", color: "#333", marginBottom: 16 }}>INSIDE THE SUITE</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
            {[
              { name: "Storyboard Builder", desc: "AI-generated scene panels from a script" },
              { name: "Scene Weaver", desc: "Multi-clip narrative sequencer" },
              { name: "Auto Cuts", desc: "Beat-matched AI video editor" },
              { name: "Color Grade AI", desc: "One-click cinematic LUTs" },
            ].map(f => (
              <div key={f.name} style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", padding: "20px", borderRadius: 2 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{f.name}</div>
                <div style={{ fontSize: 11, color: "#555" }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generate CTA */}
      <div style={{ padding: "0 32px 48px" }}>
        <div style={{ border: "1px solid #1e1e1e", borderRadius: 4, padding: 24, background: "#0a0a0a" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.25em", color: "#444", marginBottom: 16 }}>START A SESSION</div>
          <textarea
            placeholder={`Describe your ${tool.label} vision in detail…`}
            style={{ width: "100%", background: "transparent", border: "none", outline: "none", color: "#fff", fontSize: 15, lineHeight: 1.6, resize: "none", height: 80, fontFamily: "inherit" }}
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #1a1a1a", paddingTop: 16, marginTop: 8 }}>
            <span style={{ fontSize: 11, color: "#444" }}>Cost: <span style={{ color: tool.cost === "FREE" ? tool.color : "#FF3B30", fontWeight: 700 }}>{tool.cost}</span></span>
            <button style={{ background: "#fff", color: "#000", border: "none", borderRadius: 3, padding: "12px 28px", fontSize: 11, fontWeight: 800, letterSpacing: "0.15em", cursor: "pointer" }}>
              GENERATE ✦
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main app ── */
export default function TabloidV2() {
  const [active, setActive] = useState<typeof TOOLS[0] | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 80);
    return () => clearInterval(id);
  }, []);

  if (active) return <ToolDetail tool={active} onBack={() => setActive(null)} />;

  return (
    <div style={{ background: "#080808", minHeight: "100vh", fontFamily: "'Inter', sans-serif", color: "#fff" }}>
      <style>{`
        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes heroGlow { 0%,100%{opacity:.6} 50%{opacity:1} }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { display: none; }
      `}</style>

      {/* ── Top bar (no hamburger) ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 32px", borderBottom: "1px solid #181818", position: "sticky", top: 0, zIndex: 100, background: "#080808" }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.35em", color: "#fff" }}>AURORA</span>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <span style={{ fontSize: 10, color: "#555", letterSpacing: "0.15em", cursor: "pointer" }}>GALLERY</span>
          <span style={{ fontSize: 10, color: "#555", letterSpacing: "0.15em", cursor: "pointer" }}>ACCOUNT</span>
          <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 20, padding: "7px 16px", fontSize: 11, fontWeight: 700, display: "flex", gap: 7, alignItems: "center", cursor: "pointer" }}>
            <span style={{ color: "#FF3B30" }}>✦</span> 250 CR
            <span style={{ color: "#333", marginLeft: 4, fontSize: 10 }}>TOP UP</span>
          </div>
        </div>
      </div>

      {/* ── Hero ── */}
      <div style={{ position: "relative", padding: "64px 32px 48px", overflow: "hidden" }}>
        {/* Animated background glow */}
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 60% 80% at 50% 0%, #E8FF4712 0%, transparent 70%)", animation: "heroGlow 4s ease-in-out infinite" }}/>
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.35em", color: "#444", marginBottom: 16 }}>THE COMPLETE TOOLKIT</div>
          <div style={{
            fontSize: "clamp(56px, 9vw, 112px)",
            fontWeight: 900,
            lineHeight: 0.88,
            letterSpacing: "-0.04em",
            textTransform: "uppercase",
          }}>
            PERFORM.<br/>
            <span style={{ WebkitTextStroke: "1px #444", color: "transparent" }}>CREATE.</span><br/>
            RELEASE.
          </div>
          <div style={{ marginTop: 28, display: "flex", gap: 16, alignItems: "center" }}>
            <div style={{ width: 40, height: 1, background: "#333" }}/>
            <span style={{ fontSize: 11, color: "#555", letterSpacing: "0.1em" }}>7 TOOLS · BUILT FOR ARTISTS</span>
          </div>
        </div>
      </div>

      {/* ── Tools list ── */}
      <div style={{ borderTop: "1px solid #181818" }}>
        {TOOLS.map(tool => (
          <ToolStrip key={tool.id} tool={tool} onOpen={() => setActive(tool)} />
        ))}
      </div>

      {/* ── Recent work ── */}
      <div style={{ padding: "48px 32px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.3em", color: "#444" }}>RECENT WORK</span>
          <span style={{ fontSize: 10, color: "#444", letterSpacing: "0.15em", cursor: "pointer" }}>VIEW ALL →</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2 }}>
          {[
            { src: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&q=80", label: "Stage Session", type: "COLORS" },
            { src: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&q=80", label: "Festival Cut", type: "MOTION CONTROL" },
            { src: "https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=400&q=80", label: "Studio GRWM", type: "GRWM" },
            { src: "https://images.unsplash.com/photo-1598387993441-a364f854cde0?w=400&q=80", label: "Campaign Drop", type: "TIKTOK30" },
          ].map((item, i) => (
            <div key={i} style={{ position: "relative", aspectRatio: "4/3", overflow: "hidden", cursor: "pointer", borderRadius: 2 }}>
              <img src={item.src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, #000a 0%, transparent 50%)" }}/>
              <div style={{ position: "absolute", bottom: 10, left: 10, right: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{item.label}</div>
                <div style={{ fontSize: 9, color: "#888", letterSpacing: "0.12em", marginTop: 2 }}>{item.type}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer strip ── */}
      <div style={{ padding: "48px 32px", borderTop: "1px solid #181818", marginTop: 48, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.35em", color: "#333" }}>AURORA</span>
        <span style={{ fontSize: 10, color: "#2a2a2a", letterSpacing: "0.12em" }}>MADE FOR PERFORMERS</span>
      </div>
    </div>
  );
}
