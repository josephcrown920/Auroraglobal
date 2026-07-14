import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import type { Session } from "@supabase/supabase-js";
import { generateScripts, generateVariations, generateImages, type UgcBrief, type ImageResult } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { ClaudeLogo, AuroraLogo } from "./Icons";

// ─── Icons (inline to avoid extra deps) ──────────────────────────────────────
const Icon = {
  Spinner: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: "spin 0.8s linear infinite" }}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
    </svg>
  ),
  Copy: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>,
  Check: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6 9 17l-5-5" /></svg>,
  Download: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 15V3m0 12-4-4m4 4 4-4M2 17l.621 2.485A2 2 0 0 0 4.561 21h14.878a2 2 0 0 0 1.94-1.515L22 17" /></svg>,
  Upload: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>,
  Close: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>,
  Logout: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>,
  Layers: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m12 2 10 6.5v7L12 22 2 15.5v-7L12 2ZM12 22v-6.5M22 8.5l-10 7-10-7" /></svg>,
  Image: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></svg>,
  Wand: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 4-7 7 5.5 5.5 7-7L15 4ZM2 22l5.5-5.5" /></svg>,
};

// ─── Constants ────────────────────────────────────────────────────────────────
const ALL_ANGLES = ["testimonial","before/after","myth-bust","unboxing","day-in-life","pov","comparison","tutorial","reaction"];
const NICHES     = ["Wellness / health","Beauty / skincare","Fitness","Home / lifestyle","Tech / gadget","Fashion","Food / beverage","Finance / app","Pet care","Supplements"];
const LENGTHS    = [{ v:"15s",l:"15 sec" },{ v:"30s",l:"30 sec" },{ v:"45s",l:"45 sec" }] as const;

const ARC_BADGE: Record<string, { bg: string; color: string }> = {
  "pain-point":    { bg: "rgba(239,68,68,0.12)",  color: "#f87171" },
  discovery:       { bg: "rgba(251,191,36,0.12)",  color: "#fbbf24" },
  transformation:  { bg: "rgba(34,197,94,0.12)",   color: "#4ade80" },
  "social-proof":  { bg: "rgba(56,189,248,0.12)",  color: "#38bdf8" },
  fomo:            { bg: "rgba(217,70,239,0.12)",  color: "#e879f9" },
  cta:             { bg: "rgba(147,104,245,0.12)", color: "var(--accent)" },
};
function arcBadge(pos: string) {
  for (const [k, v] of Object.entries(ARC_BADGE)) if (pos.toLowerCase().startsWith(k)) return v;
  return { bg: "rgba(255,255,255,0.06)", color: "var(--text-muted)" };
}

// ─── Demo creative cards (static; shown as "output preview") ─────────────────
const DEMO_CREATIVES = [
  { headline: "NUTRITION THAT HITS DIFFERENT", sub: "Gut Health · Energy · Clean Ingredients", cta: "SHOP NOW →", accent: "#2d5a27", bg: "#1a3d14" },
  { headline: "CHEW. NOURISH. FEEL ALIVE.", sub: "Replenish Fast · Feel Your Best · Every Day Energy", cta: "TRY IT →", accent: "#4a7c3f", bg: "#1e4018" },
  { headline: "CLEAN NUTRITION. ELEVATED.", sub: "Non-GMO · Gluten Free · Vegan · No Artificial Anything", cta: "SHOP NOW →", accent: "#3a6b30", bg: "#162e12" },
];

const DEMO_UGC = [
  { angle: "testimonial",    setting: "kitchen", text: "Holding product, morning light" },
  { angle: "before/after",   setting: "studio",  text: "Speaking to camera, neutral bg" },
  { angle: "unboxing",       setting: "desk",    text: "Close-up hands + product reveal" },
  { angle: "day-in-life",    setting: "outdoors",text: "Walking, product in hand" },
];

// ─── Component ────────────────────────────────────────────────────────────────
export function UgcLineUI({ session }: { session: Session }) {
  const token = session.access_token;
  const email = session.user.email ?? "";
  const [tab, setTab] = useState<"scripts" | "variations">("scripts");

  // Scripts
  const [product,       setProduct]       = useState("e.g. Aura — magnesium + L-theanine sleep gummies, $28/mo subscription");
  const [audience,      setAudience]      = useState("Women 25-40, tired of poor sleep, into wellness / self-care");
  const [niche,         setNiche]         = useState("Wellness / health");
  const [angles,        setAngles]        = useState(new Set(["testimonial","before/after","myth-bust"]));
  const [length,        setLength]        = useState<"15s"|"30s"|"45s">("30s");
  const [count,         setCount]         = useState(6);
  const [briefs,        setBriefs]        = useState<(UgcBrief & { id:number })[]>([]);
  const [scriptsLoading,setScriptsLoading]= useState(false);
  const counter = useRef(0);

  // Variations
  const [inputType,  setInputType]  = useState<"person"|"product">("person");
  const [refFile,    setRefFile]    = useState<File|null>(null);
  const [refPreview, setRefPreview] = useState<string|null>(null);
  const [direction,  setDirection]  = useState("casual streetwear, neutral tones, everyday looks");
  const [productName,setProductName]= useState("");
  const [varCount,   setVarCount]   = useState(6);
  const [aspectRatio,setAspectRatio]= useState("4:5");
  const [consent,    setConsent]    = useState(false);
  const [varResults, setVarResults] = useState<ImageResult[]>([]);
  const [varLoading, setVarLoading] = useState(false);

  // ── Actions ─────────────────────────────────────────────────────────────────
  async function doScripts() {
    if (!product.trim()) { toast.error("Enter a product"); return; }
    if (!angles.size)    { toast.error("Pick at least one hook angle"); return; }
    setScriptsLoading(true);
    try {
      const { briefs: nb } = await generateScripts({ product, audience, niche, angles:[...angles], length, count }, token);
      setBriefs(p => [...p, ...nb.map(b => ({ ...b, id: ++counter.current }))]);
      toast.success(`${nb.length} briefs added`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setScriptsLoading(false); }
  }

  async function doVariations() {
    if (!refFile) { toast.error("Upload a reference photo first"); return; }
    if (inputType==="person" && !consent) { toast.error("Confirm consent to use this photo"); return; }
    setVarLoading(true);
    try {
      const base64 = await fileToBase64(refFile);
      const { prompts } = await generateVariations({ direction: direction.trim()||"lifestyle photo", count:varCount, inputType, productName: productName.trim()||undefined }, token);
      const { results } = await generateImages({ referenceBase64:base64, referenceMimeType:refFile.type, prompts, aspectRatio }, token);
      setVarResults(results);
      const ok = results.filter(r=>r.imageBase64).length;
      toast.success(`${ok} of ${results.length} images ready`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setVarLoading(false); }
  }

  function exportBriefs() {
    if (!briefs.length) { toast.error("Queue is empty"); return; }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(briefs,null,2)],{type:"application/json"}));
    a.download = "content-line-batch.json";
    a.click();
    toast.success("Batch exported");
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f?.type.startsWith("image/")) { setRefFile(f); setRefPreview(URL.createObjectURL(f)); }
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", position:"relative" }}>
      {/* Ambient glow */}
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0 }}>
        <div style={{ position:"absolute", top:"-15%", left:"50%", transform:"translateX(-50%)", width:900, height:500, borderRadius:"50%", background:"radial-gradient(ellipse, oklch(0.72 0.2 300 / 0.08) 0%, transparent 65%)" }} />
      </div>

      {/* ── Header ── */}
      <header style={{ position:"sticky", top:0, zIndex:20, borderBottom:"1px solid var(--border)", background:"rgba(9,9,15,0.85)", backdropFilter:"blur(14px)", padding:"0 24px", height:58, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:7 }}>
            <ClaudeLogo size={26} />
            <span style={{ fontSize:13, color:"var(--text-muted)", fontWeight:500 }}>+</span>
            <AuroraLogo size={26} />
          </div>
          <div style={{ width:1, height:18, background:"var(--border)" }} />
          <span style={{ fontWeight:700, fontSize:15, letterSpacing:"-0.02em", color:"var(--text)" }}>
            Content Line
          </span>
          <span style={{ fontSize:11, fontWeight:600, padding:"2px 8px", borderRadius:20, background:"oklch(0.72 0.2 300 / 0.12)", border:"1px solid oklch(0.72 0.2 300 / 0.25)", color:"var(--accent)", letterSpacing:"0.03em" }}>
            MCP+
          </span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ fontSize:12, color:"var(--text-muted)" }}>{email}</span>
          <button onClick={() => supabase.auth.signOut()} style={{ display:"flex", alignItems:"center", gap:5, padding:"6px 11px", borderRadius:8, background:"transparent", border:"1px solid var(--border)", color:"var(--text-muted)", cursor:"pointer", fontSize:12, fontWeight:500 }}>
            <Icon.Logout /> Sign out
          </button>
        </div>
      </header>

      {/* ── Hero / demo showcase ── */}
      <section style={{ position:"relative", zIndex:1, borderBottom:"1px solid var(--border)", padding:"36px 24px 32px", background:"linear-gradient(180deg, rgba(147,104,245,0.04) 0%, transparent 100%)" }}>
        <div style={{ maxWidth:860, margin:"0 auto" }}>
          {/* Title */}
          <div className="fade-up" style={{ textAlign:"center", marginBottom:28 }}>
            <h1 style={{ fontSize:32, fontWeight:900, letterSpacing:"-0.04em", color:"var(--text)", lineHeight:1.15, marginBottom:10 }}>
              Claude MCP <span style={{ color:"var(--accent)" }}>× UGC</span> × Variations
            </h1>
            <p style={{ fontSize:15, color:"var(--text-muted)", maxWidth:520, margin:"0 auto" }}>
              Paste a product brief → Claude generates a full arc of UGC scripts and Gemini renders visual variations of your creator or product.
            </p>
          </div>

          {/* Pipeline diagram */}
          <div className="fade-up-2" style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:12, marginBottom:28, flexWrap:"wrap" }}>
            <PipelineStep icon={<ClaudeLogo size={28}/>} label="Claude MCP" sub="Script Arc" />
            <Arrow />
            <PipelineStep icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>} label="6 UGC Briefs" sub="Pain · Discovery · CTA…" />
            <Arrow />
            <PipelineStep icon={<AuroraLogo size={28}/>} label="Gemini Vision" sub="Visual Variations" />
            <Arrow />
            <PipelineStep icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>} label="Output Grid" sub="Ready to export" />
          </div>

          {/* Demo output — ad creatives + UGC thumbnails */}
          <div className="fade-up-3">
            {/* Row 1: 3 ad creative cards */}
            <p style={{ fontSize:11, fontWeight:700, letterSpacing:"0.08em", color:"var(--text-muted)", textTransform:"uppercase", marginBottom:10 }}>Sample ad creatives (Claude-generated copy)</p>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:10 }}>
              {DEMO_CREATIVES.map((c, i) => (
                <div key={i} style={{ borderRadius:12, overflow:"hidden", border:"1px solid var(--border)", background:c.bg, padding:"16px 14px", minHeight:96, display:"flex", flexDirection:"column", justifyContent:"space-between", position:"relative" }}>
                  <div style={{ position:"absolute", inset:0, backgroundImage:"radial-gradient(circle at 70% 30%, rgba(255,255,255,0.04), transparent)", borderRadius:12 }} />
                  <div>
                    <p style={{ fontSize:11, fontWeight:900, color:"#fff", letterSpacing:"-0.01em", lineHeight:1.3, marginBottom:5 }}>{c.headline}</p>
                    <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                      {c.sub.split(" · ").map(s => (
                        <span key={s} style={{ fontSize:9, color:"rgba(255,255,255,0.6)", display:"flex", alignItems:"center", gap:4 }}>
                          <span style={{ fontSize:8 }}>✓</span>{s}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span style={{ fontSize:9, fontWeight:800, color:"#fff", background:c.accent, padding:"4px 8px", borderRadius:4, alignSelf:"flex-start", letterSpacing:"0.04em" }}>{c.cta}</span>
                </div>
              ))}
            </div>

            {/* Row 2: 4 UGC thumbnail stubs */}
            <p style={{ fontSize:11, fontWeight:700, letterSpacing:"0.08em", color:"var(--text-muted)", textTransform:"uppercase", marginBottom:10 }}>UGC creator variations (Gemini visual)</p>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
              {DEMO_UGC.map((u, i) => (
                <div key={i} style={{ borderRadius:12, border:"1px solid var(--border)", background:"var(--bg-card)", overflow:"hidden", aspectRatio:"9/14", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"flex-end", padding:10, position:"relative", backgroundImage:`linear-gradient(180deg, #${["1a2a1a","1e2818","182218","1c2a18"][i]} 0%, #0d150d 100%)` }}>
                  {/* Silhouette placeholder */}
                  <div style={{ position:"absolute", top:"18%", left:"50%", transform:"translateX(-50%)", opacity:0.18 }}>
                    <svg width="52" height="80" viewBox="0 0 52 80" fill="white">
                      <circle cx="26" cy="18" r="14" />
                      <path d="M6 80c0-22 8-36 20-36s20 14 20 36H6Z" />
                    </svg>
                  </div>
                  <div style={{ position:"relative", zIndex:1, width:"100%", textAlign:"center" }}>
                    <span style={{ fontSize:9, fontWeight:700, padding:"3px 8px", borderRadius:20, background:"oklch(0.72 0.2 300 / 0.18)", border:"1px solid oklch(0.72 0.2 300 / 0.3)", color:"var(--accent)", display:"inline-block", marginBottom:5 }}>{u.angle}</span>
                    <p style={{ fontSize:9, color:"rgba(255,255,255,0.45)", lineHeight:1.4 }}>{u.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Tool area ── */}
      <main style={{ flex:1, position:"relative", zIndex:1, padding:"28px 24px 60px", maxWidth:900, margin:"0 auto", width:"100%" }}>
        {/* Tabs */}
        <div style={{ display:"flex", gap:4, marginBottom:24, background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:14, padding:4 }}>
          {([["scripts","UGC Scripts","Layers"],["variations","Visual Variations","Image"]] as const).map(([id,label,icon]) => {
            const I = icon==="Layers" ? Icon.Layers : Icon.Image;
            const active = tab===id;
            return (
              <button key={id} onClick={() => setTab(id)} style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:7, padding:"10px 18px", borderRadius:10, fontSize:13, fontWeight:600, border:"none", cursor:"pointer", background: active ? "oklch(0.72 0.2 300 / 0.14)" : "transparent", color: active ? "var(--accent)" : "var(--text-muted)", transition:"all 0.15s" }}>
                <I />{label}
              </button>
            );
          })}
        </div>

        {/* ── SCRIPTS TAB ─────────────────────────────────────────────────────── */}
        {tab==="scripts" && (
          <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
            <ToolCard title="Campaign Brief">
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                <div style={{ gridColumn:"1/-1" }}>
                  <FLabel>Product / offer</FLabel>
                  <textarea value={product} onChange={e=>setProduct(e.target.value)} rows={2} style={ta} />
                </div>
                <div>
                  <FLabel>Target audience</FLabel>
                  <textarea value={audience} onChange={e=>setAudience(e.target.value)} rows={2} style={ta} />
                </div>
                <div>
                  <FLabel>Niche</FLabel>
                  <select value={niche} onChange={e=>setNiche(e.target.value)} style={sel}>
                    {NICHES.map(n=><option key={n}>{n}</option>)}
                  </select>
                </div>
              </div>
              {/* Angles */}
              <div style={{ marginTop:14 }}>
                <FLabel>Hook angles</FLabel>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:6 }}>
                  {ALL_ANGLES.map(a => {
                    const on = angles.has(a);
                    return <Chip key={a} label={a} active={on} onClick={() => setAngles(p=>{ const n=new Set(p); on?n.delete(a):n.add(a); return n; })} />;
                  })}
                </div>
              </div>
              {/* Length + count */}
              <div style={{ display:"flex", gap:14, marginTop:14, flexWrap:"wrap" }}>
                <div>
                  <FLabel>Script length</FLabel>
                  <div style={{ display:"flex", gap:6, marginTop:6 }}>
                    {LENGTHS.map(l=><Chip key={l.v} label={l.l} active={length===l.v} onClick={() => setLength(l.v)} />)}
                  </div>
                </div>
                <div style={{ flex:1, minWidth:140 }}>
                  <FLabel>Count — {count} briefs</FLabel>
                  <input type="range" min={1} max={15} value={count} onChange={e=>setCount(Number(e.target.value))} style={{ width:"100%", accentColor:"var(--accent)", marginTop:10 }} />
                </div>
              </div>
              {/* Generate */}
              <button onClick={doScripts} disabled={scriptsLoading} className="glow-btn" style={{ ...genBtn, marginTop:20, opacity:scriptsLoading?0.65:1 }}>
                {scriptsLoading ? <><Icon.Spinner /> Generating with Claude…</> : <><Icon.Wand /> Generate Script Arc</>}
              </button>
            </ToolCard>

            {/* Output */}
            {briefs.length>0 && (
              <ToolCard title={`${briefs.length} brief${briefs.length!==1?"s":""} in queue`}
                actions={
                  <div style={{ display:"flex", gap:8 }}>
                    <SBtn onClick={exportBriefs}><Icon.Download /> Export JSON</SBtn>
                    <SBtn onClick={()=>setBriefs([])} danger>Clear all</SBtn>
                  </div>
                }>
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {briefs.map((b,i) => <BriefCard key={b.id} brief={b} index={i} />)}
                </div>
              </ToolCard>
            )}
          </div>
        )}

        {/* ── VARIATIONS TAB ──────────────────────────────────────────────────── */}
        {tab==="variations" && (
          <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
            <ToolCard title="Visual Variations">
              {/* Type select */}
              <FLabel>Reference type</FLabel>
              <div style={{ display:"flex", gap:6, margin:"6px 0 16px" }}>
                {(["person","product"] as const).map(t=><Chip key={t} label={t} active={inputType===t} onClick={() => setInputType(t)} />)}
              </div>

              {/* Upload */}
              <FLabel>Reference photo</FLabel>
              <div
                onDrop={onDrop} onDragOver={e=>e.preventDefault()}
                onClick={() => { const i=document.createElement("input"); i.type="file"; i.accept="image/*"; i.onchange=()=>{ const f=i.files?.[0]; if(f){setRefFile(f);setRefPreview(URL.createObjectURL(f));}}; i.click(); }}
                style={{ margin:"6px 0 14px", border:"2px dashed var(--border)", borderRadius:14, minHeight:refPreview?0:110, cursor:"pointer", overflow:"hidden", display:"flex", alignItems:"center", justifyContent:"center", position:"relative", transition:"border-color 0.15s" }}
                onMouseEnter={e=>(e.currentTarget.style.borderColor="var(--accent)")}
                onMouseLeave={e=>(e.currentTarget.style.borderColor="var(--border)")}
              >
                {refPreview
                  ? <>
                      <img src={refPreview} alt="ref" style={{ maxHeight:220, display:"block" }} />
                      <button onClick={e=>{e.stopPropagation();setRefFile(null);setRefPreview(null);}} style={{ position:"absolute", top:8, right:8, background:"rgba(0,0,0,0.7)", border:"none", borderRadius:"50%", width:26, height:26, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#fff" }}>
                        <Icon.Close />
                      </button>
                    </>
                  : <div style={{ textAlign:"center", color:"var(--text-muted)", padding:20 }}>
                      <Icon.Upload />
                      <p style={{ fontSize:13, marginTop:8 }}>Drop or click to upload</p>
                      <p style={{ fontSize:11, marginTop:4, opacity:0.6 }}>PNG, JPG, WebP</p>
                    </div>
                }
              </div>

              {inputType==="person" && (
                <label style={{ display:"flex", gap:9, marginBottom:14, cursor:"pointer", fontSize:12, color:"var(--text-muted)", alignItems:"flex-start" }}>
                  <input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} style={{ marginTop:1, accentColor:"var(--accent)", flexShrink:0 }} />
                  I have rights / consent to use this person's likeness for AI-generated images.
                </label>
              )}

              {inputType==="product" && (
                <div style={{ marginBottom:14 }}>
                  <FLabel>Product name (optional)</FLabel>
                  <input type="text" value={productName} onChange={e=>setProductName(e.target.value)} placeholder="e.g. Aura Sleep Gummies" style={{ ...inp, marginTop:6 }} />
                </div>
              )}

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                <div>
                  <FLabel>Style direction</FLabel>
                  <textarea value={direction} onChange={e=>setDirection(e.target.value)} rows={2} style={ta} />
                </div>
                <div>
                  <FLabel>Aspect ratio</FLabel>
                  <select value={aspectRatio} onChange={e=>setAspectRatio(e.target.value)} style={sel}>
                    {["1:1","4:5","9:16","16:9","3:4"].map(r=><option key={r}>{r}</option>)}
                  </select>
                  <FLabel style={{ marginTop:12 }}>Count — {varCount}</FLabel>
                  <input type="range" min={2} max={24} step={2} value={varCount} onChange={e=>setVarCount(Number(e.target.value))} style={{ width:"100%", accentColor:"var(--accent)", marginTop:6 }} />
                </div>
              </div>

              <button onClick={doVariations} disabled={varLoading} className="glow-btn" style={{ ...genBtn, marginTop:20, opacity:varLoading?0.65:1 }}>
                {varLoading ? <><Icon.Spinner /> Generating — this may take a minute…</> : <><Icon.Image /> Generate Visual Variations</>}
              </button>
            </ToolCard>

            {/* Grid output */}
            {varResults.length>0 && (
              <ToolCard title={`${varResults.filter(r=>r.imageBase64).length} of ${varResults.length} images ready`}>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(180px,1fr))", gap:10 }}>
                  {varResults.map((r,i) => (
                    <div key={i} style={{ borderRadius:12, border:"1px solid var(--border)", background:"var(--bg-card)", overflow:"hidden" }}>
                      {r.imageBase64
                        ? <>
                            <img src={`data:image/jpeg;base64,${r.imageBase64}`} alt="" style={{ width:"100%", display:"block", aspectRatio:aspectRatio.replace(":","/")} } />
                            <div style={{ padding:"7px 10px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                              <span style={{ fontSize:10, color:"var(--text-muted)", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginRight:8 }}>{r.prompt.slice(0,42)}…</span>
                              <a href={`data:image/jpeg;base64,${r.imageBase64}`} download={`variation-${i+1}.jpg`} style={{ color:"var(--accent)", flexShrink:0 }}><Icon.Download /></a>
                            </div>
                          </>
                        : <div style={{ padding:"14px 12px", color:"#f87171", fontSize:11 }}>Error: {r.error}</div>
                      }
                    </div>
                  ))}
                </div>
              </ToolCard>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PipelineStep({ icon, label, sub }: { icon: React.ReactNode; label: string; sub: string }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:5, padding:"12px 16px", borderRadius:14, background:"var(--bg-card)", border:"1px solid var(--border)", minWidth:96 }}>
      {icon}
      <span style={{ fontSize:12, fontWeight:700, color:"var(--text)", textAlign:"center" }}>{label}</span>
      <span style={{ fontSize:10, color:"var(--text-muted)", textAlign:"center", lineHeight:1.4 }}>{sub}</span>
    </div>
  );
}

function Arrow() {
  return <svg width="20" height="16" viewBox="0 0 20 16" fill="none"><path d="M1 8h15M12 2l6 6-6 6" stroke="var(--border-strong)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

function ToolCard({ title, children, actions }: { title: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:18, overflow:"hidden" }}>
      <div style={{ padding:"14px 18px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <h3 style={{ fontSize:14, fontWeight:700, letterSpacing:"-0.01em", color:"var(--text)" }}>{title}</h3>
        {actions}
      </div>
      <div style={{ padding:18 }}>{children}</div>
    </div>
  );
}

function FLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <p style={{ fontSize:11, fontWeight:700, color:"var(--text-muted)", letterSpacing:"0.05em", textTransform:"uppercase", marginBottom:4, ...style }}>{children}</p>;
}

function Chip({ label, active, onClick }: { label:string; active:boolean; onClick:()=>void }) {
  return (
    <button onClick={onClick} style={{ padding:"5px 12px", borderRadius:8, fontSize:12, fontWeight:500, border:`1px solid ${active?"oklch(0.72 0.2 300 / 0.4)":"var(--border)"}`, background: active ? "oklch(0.72 0.2 300 / 0.13)" : "transparent", color: active ? "var(--accent)" : "var(--text-muted)", cursor:"pointer", transition:"all 0.12s" }}>
      {label}
    </button>
  );
}

function SBtn({ children, onClick, danger }: { children: React.ReactNode; onClick: ()=>void; danger?: boolean }) {
  return (
    <button onClick={onClick} style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 11px", borderRadius:8, fontSize:12, fontWeight:500, background:"transparent", border:"1px solid var(--border)", color: danger ? "#f87171" : "var(--text-muted)", cursor:"pointer" }}>
      {children}
    </button>
  );
}

function BriefCard({ brief, index }: { brief: UgcBrief & { id:number }; index: number }) {
  const [copied, setCopied] = useState<"script"|"json"|null>(null);
  const badge = arcBadge(brief.arc_position);
  function copy(type:"script"|"json") {
    navigator.clipboard.writeText(type==="script" ? brief.script : JSON.stringify(brief,null,2));
    setCopied(type); setTimeout(()=>setCopied(null), 1600);
  }
  return (
    <div style={{ border:"1px solid var(--border)", borderRadius:14, overflow:"hidden", background:"rgba(255,255,255,0.02)" }}>
      <div style={{ padding:"11px 14px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:6 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:11, fontWeight:700, color:"var(--text-muted)", minWidth:20 }}>#{index+1}</span>
          <span style={{ fontSize:11, fontWeight:700, padding:"3px 9px", borderRadius:6, background:badge.bg, color:badge.color }}>{brief.arc_position.split(" ")[0]}</span>
          <span style={{ fontSize:11, color:"var(--text-muted)" }}>{brief.angle}</span>
        </div>
        <div style={{ display:"flex", gap:6 }}>
          {(["script","json"] as const).map(t=>(
            <button key={t} onClick={()=>copy(t)} style={{ display:"flex", alignItems:"center", gap:4, padding:"4px 9px", borderRadius:6, fontSize:11, fontWeight:500, background:"rgba(255,255,255,0.05)", border:"1px solid var(--border)", color: copied===t ? "var(--accent)" : "var(--text-muted)", cursor:"pointer" }}>
              {copied===t ? <Icon.Check /> : <Icon.Copy />}{t === "script" ? "Script" : "JSON"}
            </button>
          ))}
        </div>
      </div>
      <div style={{ padding:"13px 14px" }}>
        <p style={{ fontSize:13, fontWeight:600, color:"var(--accent)", marginBottom:8 }}>"{brief.hook}"</p>
        <p style={{ fontSize:13, color:"var(--text)", lineHeight:1.7, marginBottom:12, whiteSpace:"pre-wrap" }}>{brief.script}</p>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          {[["Scene", brief.scene_direction],["On-screen", brief.on_screen_text],["CTA", brief.cta],["Caption", brief.caption]].map(([k,v])=>(
            <div key={k} style={{ background:"rgba(255,255,255,0.025)", borderRadius:8, padding:"8px 10px" }}>
              <p style={{ fontSize:9, fontWeight:700, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:3 }}>{k}</p>
              <p style={{ fontSize:12, color:"var(--text)", lineHeight:1.5 }}>{v}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const base: React.CSSProperties = { width:"100%", background:"var(--bg-input)", border:"1px solid var(--border)", borderRadius:10, color:"var(--text)", fontSize:13, outline:"none", transition:"border-color 0.15s" };
const ta: React.CSSProperties  = { ...base, padding:"10px 12px", resize:"vertical", lineHeight:1.6 };
const inp: React.CSSProperties = { ...base, padding:"10px 12px" };
const sel: React.CSSProperties = { ...base, padding:"10px 12px", cursor:"pointer" };
const genBtn: React.CSSProperties = { display:"flex", alignItems:"center", justifyContent:"center", gap:8, width:"100%", padding:"13px 20px", borderRadius:12, fontWeight:800, fontSize:14, background:"var(--accent)", border:"none", color:"#fff", cursor:"pointer", letterSpacing:"-0.01em" };

async function fileToBase64(file: File): Promise<string> {
  return new Promise((res,rej) => { const r=new FileReader(); r.onload=()=>res((r.result as string).split(",")[1]); r.onerror=rej; r.readAsDataURL(file); });
}
