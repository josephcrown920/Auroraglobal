/**
 * TabloidV2Director — Director's Room detail screen, standalone for preview.
 */

function AnimLoop({ accent }: { accent: string }) {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <style>{`@keyframes goldGlow { 0%,100%{opacity:.5} 50%{opacity:.9} }`}</style>
      <div style={{ position:"absolute", inset:0, background:`radial-gradient(ellipse 120% 80% at 20% 50%, ${accent}22 0%, transparent 65%)`, animation:"goldGlow 4s ease-in-out infinite" }}/>
      <div style={{ position:"absolute", top:"20%", left:0, right:0, height:1, background:`linear-gradient(to right, transparent 0%, ${accent}50 30%, ${accent}50 70%, transparent 100%)` }}/>
      <div style={{ position:"absolute", top:"80%", left:0, right:0, height:1, background:`linear-gradient(to right, transparent 0%, ${accent}50 30%, ${accent}50 70%, transparent 100%)` }}/>
      <div style={{ position:"absolute", inset:0, background:"linear-gradient(to bottom, transparent 40%, #080808 100%)" }}/>
    </div>
  );
}

const subTools = [
  { name: "Storyboard Builder", desc: "AI-generated scene panels from a script or mood board. Drop in a treatment and get 12 illustrated frames ready to direct from.", icon: "◫" },
  { name: "Scene Weaver", desc: "Multi-clip narrative sequencer. String scenes together with AI-matched transitions, music timing, and arc pacing.", icon: "⧉" },
  { name: "Auto Cuts", desc: "Beat-matched AI video editor. Drops cuts on the transient, tightens talking-head pacing, syncs B-roll automatically.", icon: "✂" },
  { name: "Color Grade AI", desc: "One-click cinematic LUTs trained on 10,000 music videos. Match the mood of any reference frame in seconds.", icon: "◑" },
];

export default function TabloidV2Director() {
  return (
    <div style={{ background: "#080808", minHeight: "100vh", fontFamily: "'Inter', sans-serif", color: "#fff" }}>
      <style>{`* { box-sizing: border-box; } ::-webkit-scrollbar { display: none; }`}</style>

      {/* Top bar */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"18px 32px", borderBottom:"1px solid #181818", position:"sticky", top:0, zIndex:100, background:"#080808" }}>
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <span style={{ fontSize:10, fontWeight:700, color:"#444", letterSpacing:"0.15em", cursor:"pointer" }}>← BACK</span>
          <span style={{ color:"#222" }}>|</span>
          <span style={{ fontSize:11, fontWeight:800, letterSpacing:"0.35em", color:"#fff" }}>AURORA</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:28 }}>
          <span style={{ fontSize:10, color:"#555", letterSpacing:"0.15em" }}>GALLERY</span>
          <span style={{ fontSize:10, color:"#555", letterSpacing:"0.15em" }}>ACCOUNT</span>
          <div style={{ background:"#111", border:"1px solid #2a2a2a", borderRadius:20, padding:"7px 16px", fontSize:11, fontWeight:700, display:"flex", gap:7, alignItems:"center" }}>
            <span style={{ color:"#FF3B30" }}>✦</span> 250 CR
          </div>
        </div>
      </div>

      {/* Hero */}
      <div style={{ position:"relative", height:340, overflow:"hidden" }}>
        <AnimLoop accent="#FFB340" />
        <div style={{ position:"absolute", bottom:36, left:32, right:32 }}>
          <div style={{ fontSize:9, fontWeight:700, color:"#FFB340", letterSpacing:"0.3em", marginBottom:12 }}>04 — CINEMATIC VISUAL STUDIO · SUITE</div>
          <div style={{ fontSize:"clamp(48px,6vw,80px)", fontWeight:900, letterSpacing:"-0.04em", textTransform:"uppercase", lineHeight:0.88 }}>DIRECTOR'S<br/>ROOM</div>
        </div>
      </div>

      {/* Description */}
      <div style={{ padding:"32px 32px 0" }}>
        <p style={{ fontSize:16, color:"#777", lineHeight:1.75, maxWidth:620, margin:0 }}>
          Full cinematic production suite for artists who want complete creative control. Build your visual world from concept to final cut — all inside Aurora.
        </p>
        <div style={{ display:"flex", gap:10, marginTop:20, flexWrap:"wrap" }}>
          {["Storyboards","Scene Weaver","Auto Cuts","Color Grade","AI Director"].map(t => (
            <span key={t} style={{ fontSize:9, fontWeight:700, letterSpacing:"0.15em", color:"#FFB340", border:"1px solid #FFB34033", padding:"6px 14px", borderRadius:3, textTransform:"uppercase" }}>{t}</span>
          ))}
        </div>
      </div>

      {/* Suite sub-tools */}
      <div style={{ padding:"40px 32px 0" }}>
        <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.3em", color:"#333", marginBottom:20 }}>INSIDE THE SUITE</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:2 }}>
          {subTools.map(f => (
            <div key={f.name} style={{ background:"#0c0c0c", border:"1px solid #181818", padding:"24px", cursor:"pointer", transition:"background 0.2s" }}
              onMouseEnter={e => (e.currentTarget.style.background="#101010")}
              onMouseLeave={e => (e.currentTarget.style.background="#0c0c0c")}
            >
              <div style={{ fontSize:22, marginBottom:12, opacity:.6 }}>{f.icon}</div>
              <div style={{ fontSize:14, fontWeight:800, marginBottom:8, letterSpacing:"-0.01em" }}>{f.name}</div>
              <div style={{ fontSize:11, color:"#555", lineHeight:1.65 }}>{f.desc}</div>
              <div style={{ marginTop:16, fontSize:9, fontWeight:700, color:"#FFB340", letterSpacing:"0.15em" }}>OPEN →</div>
            </div>
          ))}
        </div>
      </div>

      {/* Session starter */}
      <div style={{ padding:"40px 32px 48px" }}>
        <div style={{ border:"1px solid #1a1a1a", borderRadius:3, padding:"28px", background:"#0a0a0a" }}>
          <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.3em", color:"#444", marginBottom:18 }}>START A DIRECTOR'S SESSION</div>
          <textarea
            placeholder="Describe your cinematic vision — mood, narrative arc, visual references…"
            style={{ width:"100%", background:"transparent", border:"none", outline:"none", color:"#fff", fontSize:15, lineHeight:1.65, resize:"none", height:88, fontFamily:"inherit" }}
            readOnly
          />
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", borderTop:"1px solid #1a1a1a", paddingTop:18, marginTop:8 }}>
            <div style={{ display:"flex", gap:16, alignItems:"center" }}>
              <span style={{ fontSize:11, color:"#444" }}>Cost: <span style={{ color:"#FFB340", fontWeight:700 }}>12 CR</span></span>
              <span style={{ fontSize:9, color:"#333", letterSpacing:"0.12em" }}>238 REMAINING</span>
            </div>
            <button style={{ background:"#FFB340", color:"#000", border:"none", borderRadius:3, padding:"13px 28px", fontSize:11, fontWeight:800, letterSpacing:"0.15em", cursor:"pointer" }}>
              BEGIN ✦
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
