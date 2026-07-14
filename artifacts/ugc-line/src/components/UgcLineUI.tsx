import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";
import type { Session } from "@supabase/supabase-js";
import { generateScripts, generateVariations, generateImages, type UgcBrief, type ImageResult } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { ClaudeLogo, AuroraLogo } from "./Icons";

// ─── Icons ────────────────────────────────────────────────────────────────────
const Icon = {
  Spinner: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation:"spin 0.8s linear infinite",flexShrink:0 }}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
    </svg>
  ),
  Copy:     ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  Check:    ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg>,
  Download: ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 15V3m0 12-4-4m4 4 4-4M2 17l.621 2.485A2 2 0 0 0 4.561 21h14.878a2 2 0 0 0 1.94-1.515L22 17"/></svg>,
  Upload:   ()=><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>,
  Plus:     ()=><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>,
  Close:    ()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>,
  Logout:   ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>,
  Layers:   ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m12 2 10 6.5v7L12 22 2 15.5v-7L12 2ZM12 22v-6.5M22 8.5l-10 7-10-7"/></svg>,
  Image:    ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>,
  Video:    ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="7" width="15" height="11" rx="2"/><path d="m17 9 5-3v12l-5-3V9Z"/></svg>,
  User:     ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>,
  Wand:     ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 4-7 7 5.5 5.5 7-7L15 4ZM2 22l5.5-5.5"/></svg>,
  Play:     ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 9-14 9V3Z"/></svg>,
  Star:     ()=><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z"/></svg>,
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface Avatar { id: string; name: string; base64: string; mimeType: string; }

// ─── Constants ────────────────────────────────────────────────────────────────
const ALL_ANGLES = ["testimonial","before/after","myth-bust","unboxing","day-in-life","pov","comparison","tutorial","reaction"];
const NICHES     = ["Wellness / health","Beauty / skincare","Fitness","Home / lifestyle","Tech / gadget","Fashion","Food / beverage","Finance / app","Pet care","Supplements"];
const LENGTHS    = [{ v:"15s",l:"15 sec" },{ v:"30s",l:"30 sec" },{ v:"45s",l:"45 sec" }] as const;
const AVATAR_SLOTS = 12; // visible empty slots when no avatars uploaded

const ARC_BADGE: Record<string, { bg:string; color:string }> = {
  "pain-point":   { bg:"rgba(239,68,68,0.12)",   color:"#f87171" },
  discovery:      { bg:"rgba(251,191,36,0.12)",   color:"#fbbf24" },
  transformation: { bg:"rgba(34,197,94,0.12)",    color:"#4ade80" },
  "social-proof": { bg:"rgba(56,189,248,0.12)",   color:"#38bdf8" },
  fomo:           { bg:"rgba(217,70,239,0.12)",   color:"#e879f9" },
  cta:            { bg:"rgba(147,104,245,0.12)",  color:"var(--accent)" },
};
function arcBadge(pos:string) {
  for (const [k,v] of Object.entries(ARC_BADGE)) if (pos.toLowerCase().startsWith(k)) return v;
  return { bg:"rgba(255,255,255,0.06)", color:"var(--text-muted)" };
}

// ─── Demo data ────────────────────────────────────────────────────────────────
const DEMO_CREATIVES = [
  { headline:"NUTRITION THAT HITS DIFFERENT", sub:"Gut Health · Energy · Clean Ingredients", cta:"SHOP NOW →", accent:"#2d5a27", bg:"#1a3d14" },
  { headline:"CHEW. NOURISH. FEEL ALIVE.",    sub:"Replenish Fast · Feel Your Best · Every Day Energy", cta:"TRY IT →", accent:"#4a7c3f", bg:"#1e4018" },
  { headline:"CLEAN NUTRITION. ELEVATED.",    sub:"Non-GMO · Gluten Free · Vegan · No Artificial Anything", cta:"SHOP NOW →", accent:"#3a6b30", bg:"#162e12" },
];
const DEMO_UGC = [
  { angle:"testimonial",  text:"Holding product, morning light" },
  { angle:"before/after", text:"Speaking to camera, neutral bg" },
  { angle:"unboxing",     text:"Close-up hands + product reveal" },
  { angle:"day-in-life",  text:"Walking, product in hand" },
];

// ─── Video brief generator (client-side, no extra API cost) ──────────────────
function makeVideoPrompts(direction:string, count:number, inputType:"person"|"product", productName?:string): string[] {
  const settings = ["cozy café window","city sidewalk at golden hour","minimalist bedroom","rooftop terrace","clean white studio","car interior, daytime","park bench, dappled shade","kitchen counter, mid-action","gym entrance","airport lounge","outdoor market","modern office desk","living room couch","bathroom vanity","coffee shop corner"];
  const framings = ["close-up portrait","waist-up shot","full-body shot","over-shoulder POV","eye-level talking head"];
  const subject  = inputType==="product" ? (productName||"the product") : "the creator";
  return Array.from({ length:count }, (_,i) => {
    const setting = settings[i % settings.length];
    const frame   = framings[i % framings.length];
    return `${subject} — ${direction}. Setting: ${setting}. Framing: ${frame}. Photorealistic, candid, natural phone-camera quality. Variation ${i+1} of ${count}.`;
  });
}

// ─── Main component ───────────────────────────────────────────────────────────
export function UgcLineUI({ session }:{ session:Session }) {
  const token = session.access_token;
  const email = session.user.email ?? "";
  const [tab, setTab] = useState<"scripts"|"avatars"|"variations">("scripts");

  // ── Avatars state (persisted to localStorage) ──────────────────────────────
  const [avatars, setAvatars] = useState<Avatar[]>(() => {
    try { return JSON.parse(localStorage.getItem("ugc_avatars") ?? "[]") as Avatar[]; }
    catch { return []; }
  });
  const [selectedAvatarId, setSelectedAvatarId] = useState<string|null>(null);

  useEffect(() => {
    localStorage.setItem("ugc_avatars", JSON.stringify(avatars));
  }, [avatars]);

  function addAvatar(file:File) {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      const newAv:Avatar = { id:crypto.randomUUID(), name:file.name.replace(/\.[^.]+$/,""), base64, mimeType:file.type };
      setAvatars(p => [...p, newAv]);
      toast.success(`Avatar "${newAv.name}" saved`);
    };
    reader.readAsDataURL(file);
  }
  function removeAvatar(id:string) {
    setAvatars(p => p.filter(a => a.id!==id));
    if (selectedAvatarId===id) setSelectedAvatarId(null);
  }
  function selectAvatarForVariations(av:Avatar) {
    setSelectedAvatarId(av.id);
    setRefBase64(av.base64);
    setRefMime(av.mimeType);
    setRefPreviewUrl(`data:${av.mimeType};base64,${av.base64}`);
    setTab("variations");
    toast.success(`"${av.name}" set as reference — switch to Variations to generate`);
  }

  // ── Scripts state ──────────────────────────────────────────────────────────
  const [product,        setProduct]        = useState("e.g. Aura — magnesium + L-theanine sleep gummies, $28/mo");
  const [audience,       setAudience]       = useState("Women 25-40, tired of poor sleep, into wellness / self-care");
  const [niche,          setNiche]          = useState("Wellness / health");
  const [angles,         setAngles]         = useState(new Set(["testimonial","before/after","myth-bust"]));
  const [length,         setLength]         = useState<"15s"|"30s"|"45s">("30s");
  const [count,          setCount]          = useState(6);
  const [briefs,         setBriefs]         = useState<(UgcBrief & {id:number})[]>([]);
  const [scriptsLoading, setScriptsLoading] = useState(false);
  const counter = useRef(0);

  // ── Variations state ───────────────────────────────────────────────────────
  const [outputType,   setOutputType]   = useState<"photos"|"videos">("photos");
  const [inputType,    setInputType]    = useState<"person"|"product">("person");
  // reference image shared between avatar-select path and manual upload path
  const [refBase64,    setRefBase64]    = useState<string|null>(null);
  const [refMime,      setRefMime]      = useState<string>("image/jpeg");
  const [refPreviewUrl,setRefPreviewUrl]= useState<string|null>(null);
  const [direction,    setDirection]    = useState("casual streetwear, neutral tones, everyday looks");
  const [productName,  setProductName]  = useState("");
  const [varCount,     setVarCount]     = useState(12);
  const [aspectRatio,  setAspectRatio]  = useState("4:5");
  const [consent,      setConsent]      = useState(false);
  const [photoResults, setPhotoResults] = useState<ImageResult[]>([]);
  const [videoPrompts, setVideoPrompts] = useState<string[]>([]);
  const [varLoading,   setVarLoading]   = useState(false);

  // ── Actions ────────────────────────────────────────────────────────────────
  async function doScripts() {
    if (!product.trim()) { toast.error("Enter a product"); return; }
    if (!angles.size)    { toast.error("Pick at least one hook angle"); return; }
    setScriptsLoading(true);
    try {
      const { briefs:nb } = await generateScripts({ product, audience, niche, angles:[...angles], length, count }, token);
      setBriefs(p => [...p, ...nb.map(b => ({ ...b, id:++counter.current }))]);
      toast.success(`${nb.length} briefs added`);
    } catch(e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setScriptsLoading(false); }
  }

  async function doVariations() {
    if (!refBase64)                        { toast.error("Upload a reference photo or select an avatar first"); return; }
    if (inputType==="person" && !consent)  { toast.error("Confirm consent to use this photo"); return; }

    if (outputType==="videos") {
      // Video briefs are generated client-side from the direction + count
      const prompts = makeVideoPrompts(direction||"lifestyle UGC", varCount, inputType, productName.trim()||undefined);
      setVideoPrompts(prompts);
      toast.success(`${prompts.length} video briefs generated`);
      return;
    }

    // Photos — call Gemini
    setVarLoading(true);
    try {
      const { prompts } = await generateVariations({ direction:direction.trim()||"lifestyle photo", count:varCount, inputType, productName:productName.trim()||undefined }, token);
      // Gemini image gen: batch in 30s if > 30 requested
      if (varCount > 30) {
        toast.info("Generating in two batches for 30+ variations…");
        const batch1 = prompts.slice(0, 30);
        const batch2 = prompts.slice(30);
        const [r1, r2] = await Promise.all([
          generateImages({ referenceBase64:refBase64, referenceMimeType:refMime, prompts:batch1, aspectRatio }, token),
          generateImages({ referenceBase64:refBase64, referenceMimeType:refMime, prompts:batch2, aspectRatio }, token),
        ]);
        const all = [...r1.results, ...r2.results];
        setPhotoResults(all);
        toast.success(`${all.filter(r=>r.imageBase64).length} of ${all.length} photos ready`);
      } else {
        const { results } = await generateImages({ referenceBase64:refBase64, referenceMimeType:refMime, prompts, aspectRatio }, token);
        setPhotoResults(results);
        toast.success(`${results.filter(r=>r.imageBase64).length} of ${results.length} photos ready`);
      }
    } catch(e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setVarLoading(false); }
  }

  function exportBriefs() {
    if (!briefs.length) { toast.error("Queue is empty"); return; }
    dl(new Blob([JSON.stringify(briefs,null,2)],{type:"application/json"}), "content-line-batch.json");
  }

  const pickFile = useCallback((accept:string, cb:(f:File)=>void) => {
    const i = document.createElement("input");
    i.type="file"; i.accept=accept;
    i.onchange = () => { if(i.files?.[0]) cb(i.files[0]); };
    i.click();
  }, []);

  const onDropRef = useCallback((e:React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f?.type.startsWith("image/")) { loadRefFile(f); }
  }, []);

  function loadRefFile(f:File) {
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = (reader.result as string).split(",")[1];
      setRefBase64(b64);
      setRefMime(f.type);
      setRefPreviewUrl(URL.createObjectURL(f));
      setSelectedAvatarId(null);
    };
    reader.readAsDataURL(f);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", position:"relative" }}>
      {/* Ambient */}
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0 }}>
        <div style={{ position:"absolute", top:"-15%", left:"50%", transform:"translateX(-50%)", width:900, height:500, borderRadius:"50%", background:"radial-gradient(ellipse, oklch(0.72 0.2 300 / 0.07) 0%, transparent 65%)" }} />
      </div>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header style={{ position:"sticky", top:0, zIndex:20, borderBottom:"1px solid var(--border)", background:"rgba(9,9,15,0.88)", backdropFilter:"blur(14px)", padding:"0 24px", height:58, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:7 }}>
            <ClaudeLogo size={26} /><span style={{ fontSize:13, color:"var(--text-muted)", fontWeight:500 }}>+</span><AuroraLogo size={26} />
          </div>
          <div style={{ width:1, height:18, background:"var(--border)" }} />
          <span style={{ fontWeight:700, fontSize:15, letterSpacing:"-0.02em" }}>Content Line</span>
          <span style={{ fontSize:11, fontWeight:600, padding:"2px 8px", borderRadius:20, background:"oklch(0.72 0.2 300 / 0.12)", border:"1px solid oklch(0.72 0.2 300 / 0.25)", color:"var(--accent)", letterSpacing:"0.03em" }}>MCP+</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ fontSize:12, color:"var(--text-muted)" }}>{email}</span>
          <button onClick={() => supabase.auth.signOut()} style={{ display:"flex", alignItems:"center", gap:5, padding:"6px 11px", borderRadius:8, background:"transparent", border:"1px solid var(--border)", color:"var(--text-muted)", cursor:"pointer", fontSize:12, fontWeight:500 }}>
            <Icon.Logout /> Sign out
          </button>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section style={{ position:"relative", zIndex:1, borderBottom:"1px solid var(--border)", background:"linear-gradient(180deg, rgba(147,104,245,0.06) 0%, transparent 100%)" }}>
        <div style={{ maxWidth:920, margin:"0 auto", padding:"36px 24px 0" }}>
          {/* Title */}
          <div className="fade-up" style={{ textAlign:"center", marginBottom:28 }}>
            <div style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"5px 14px", borderRadius:20, background:"oklch(0.72 0.2 300 / 0.1)", border:"1px solid oklch(0.72 0.2 300 / 0.25)", marginBottom:14 }}>
              <ClaudeLogo size={18}/><span style={{ fontSize:12, color:"var(--text-muted)" }}>+</span><AuroraLogo size={18}/>
              <span style={{ fontSize:12, fontWeight:700, color:"var(--accent)", letterSpacing:"0.03em" }}>MCP+ · Seedance · Gemini</span>
            </div>
            <h1 style={{ fontSize:32, fontWeight:900, letterSpacing:"-0.04em", lineHeight:1.1, marginBottom:10 }}>
              Claude MCP <span style={{ color:"var(--accent)" }}>× UGC</span><br/>× Seedance Variations
            </h1>
            <p style={{ fontSize:14, color:"var(--text-muted)", maxWidth:500, margin:"0 auto" }}>
              Paste a brief → Claude writes a full content arc → upload creator avatars → render 50 photo or Seedance video variations.
            </p>
          </div>

          {/* ── Two-panel image showcase ── */}
          <div className="fade-up-2" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:28 }}>
            {/* Left: UGC campaign */}
            <div style={{ position:"relative", borderRadius:16, overflow:"hidden", border:"1px solid var(--border)", background:"#0d0d14" }}>
              <img src="/ugc-line/demo-ugc.jpg" alt="Claude + makeugc campaign output" style={{ width:"100%", display:"block", objectFit:"cover", maxHeight:280 }} />
              <div style={{ position:"absolute", inset:0, background:"linear-gradient(to top, rgba(9,9,15,0.85) 0%, transparent 50%)" }} />
              <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"14px 16px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
                  <ClaudeLogo size={20}/>
                  <span style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.5)", textTransform:"uppercase", letterSpacing:"0.06em" }}>Claude MCP</span>
                </div>
                <p style={{ fontSize:14, fontWeight:800, color:"#fff", letterSpacing:"-0.02em", marginBottom:3 }}>Scripts + Ad Creatives</p>
                <p style={{ fontSize:11, color:"rgba(255,255,255,0.55)", lineHeight:1.5 }}>Full arc: pain-point → discovery → transformation → CTA. Real creator briefs with scene direction.</p>
              </div>
            </div>
            {/* Right: Seedance variations */}
            <div style={{ position:"relative", borderRadius:16, overflow:"hidden", border:"1px solid var(--border)", background:"#0d0d14" }}>
              <img src="/ugc-line/demo-seedance.jpg" alt="Seedance video variation grid" style={{ width:"100%", display:"block", objectFit:"cover", maxHeight:280 }} />
              <div style={{ position:"absolute", inset:0, background:"linear-gradient(to top, rgba(9,9,15,0.85) 0%, transparent 50%)" }} />
              <div style={{ position:"absolute", top:12, right:12 }}>
                <span style={{ fontSize:10, fontWeight:800, padding:"4px 10px", borderRadius:20, background:"rgba(147,104,245,0.9)", color:"#fff", letterSpacing:"0.04em" }}>SEEDANCE</span>
              </div>
              <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"14px 16px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
                  <AuroraLogo size={20}/>
                  <span style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.5)", textTransform:"uppercase", letterSpacing:"0.06em" }}>Seedance Engine</span>
                </div>
                <p style={{ fontSize:14, fontWeight:800, color:"#fff", letterSpacing:"-0.02em", marginBottom:3 }}>50 Video Variations</p>
                <p style={{ fontSize:11, color:"rgba(255,255,255,0.55)", lineHeight:1.5 }}>Sports, fashion, music, beauty — identity-consistent creator videos across every niche.</p>
              </div>
            </div>
          </div>

          {/* ── Visual 3-step onboarding strip ── */}
          <div className="fade-up-3" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:0, marginBottom:0, borderTop:"1px solid var(--border)" }}>
            {[
              {
                step: "01",
                title: "Upload avatars",
                desc: "Add creator or product reference photos. They persist across sessions and can be swapped in one click.",
                visual: (
                  <div style={{ position:"relative", height:110, overflow:"hidden", borderRadius:10 }}>
                    <img src="/ugc-line/demo-ugc.jpg" alt="" style={{ width:"100%", objectFit:"cover", objectPosition:"0% 65%", height:"100%", transform:"scale(1.1)" }} />
                    <div style={{ position:"absolute", inset:0, background:"linear-gradient(180deg, transparent 30%, rgba(9,9,15,0.7) 100%)" }} />
                    <div style={{ position:"absolute", bottom:6, left:8, display:"flex", gap:4 }}>
                      {["testimonial","before/after","pov"].map(a=>(
                        <span key={a} style={{ fontSize:8, fontWeight:700, padding:"2px 6px", borderRadius:10, background:"oklch(0.72 0.2 300 / 0.85)", color:"#fff" }}>{a}</span>
                      ))}
                    </div>
                  </div>
                ),
                action: () => setTab("avatars"),
                cta: "Open Avatars →",
                color: "#a78bfa",
              },
              {
                step: "02",
                title: "Generate scripts",
                desc: "Claude writes 6–15 UGC briefs across the full conversion arc — pain-point, discovery, CTA and more.",
                visual: (
                  <div style={{ height:110, borderRadius:10, background:"var(--bg-input)", border:"1px solid var(--border)", padding:"10px 12px", overflow:"hidden" }}>
                    <p style={{ fontSize:9, fontWeight:700, color:"var(--accent)", marginBottom:5 }}>"I never slept through the night until…"</p>
                    {[["Arc","pain-point"],["Angle","testimonial"],["Script","25–35 words"]].map(([k,v])=>(
                      <div key={k} style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                        <span style={{ fontSize:8, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.05em" }}>{k}</span>
                        <span style={{ fontSize:8, fontWeight:600, color:"var(--text)" }}>{v}</span>
                      </div>
                    ))}
                    <div style={{ marginTop:6, height:1, background:"var(--border)" }} />
                    <p style={{ fontSize:8, color:"var(--text-muted)", marginTop:5, lineHeight:1.5 }}>Scene direction · On-screen text · CTA · Caption</p>
                  </div>
                ),
                action: () => setTab("scripts"),
                cta: "Open Scripts →",
                color: "#34d399",
              },
              {
                step: "03",
                title: "Render 50 variations",
                desc: "Choose Photos (Gemini) or Videos (Seedance). Up to 50 variations with different settings, framings, and styles.",
                visual: (
                  <div style={{ position:"relative", height:110, overflow:"hidden", borderRadius:10 }}>
                    <img src="/ugc-line/demo-seedance.jpg" alt="" style={{ width:"100%", objectFit:"cover", objectPosition:"center top", height:"100%", transform:"scale(1.05)" }} />
                    <div style={{ position:"absolute", inset:0, background:"linear-gradient(180deg, transparent 20%, rgba(9,9,15,0.65) 100%)" }} />
                    <div style={{ position:"absolute", top:6, right:6 }}>
                      <span style={{ fontSize:8, fontWeight:800, padding:"2px 7px", borderRadius:10, background:"rgba(147,104,245,0.9)", color:"#fff", letterSpacing:"0.05em" }}>SEEDANCE</span>
                    </div>
                    <div style={{ position:"absolute", bottom:6, left:8 }}>
                      <span style={{ fontSize:9, fontWeight:600, color:"rgba(255,255,255,0.8)" }}>50 unique outputs →</span>
                    </div>
                  </div>
                ),
                action: () => setTab("variations"),
                cta: "Open Variations →",
                color: "var(--accent)",
              },
            ].map((s, i) => (
              <div key={i} style={{ padding:"20px 20px 22px", borderRight: i < 2 ? "1px solid var(--border)" : "none" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
                  <span style={{ fontSize:11, fontWeight:900, color:s.color, fontVariantNumeric:"tabular-nums", letterSpacing:"0.04em" }}>{s.step}</span>
                  <span style={{ fontSize:14, fontWeight:800, letterSpacing:"-0.02em", color:"var(--text)" }}>{s.title}</span>
                </div>
                {s.visual}
                <p style={{ fontSize:12, color:"var(--text-muted)", lineHeight:1.6, marginTop:10, marginBottom:12 }}>{s.desc}</p>
                <button onClick={s.action} style={{ fontSize:12, fontWeight:700, color:s.color, background:"transparent", border:"none", cursor:"pointer", padding:0, display:"flex", alignItems:"center", gap:4 }}>
                  {s.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tool ────────────────────────────────────────────────────────────── */}
      <main style={{ flex:1, position:"relative", zIndex:1, padding:"24px 24px 60px", maxWidth:920, margin:"0 auto", width:"100%" }}>
        {/* Tab bar */}
        <div style={{ display:"flex", gap:4, marginBottom:22, background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:14, padding:4 }}>
          {([
            ["scripts",    "UGC Scripts",    "Layers"],
            ["avatars",    "Avatars",         "User"],
            ["variations", "Variations",      "Image"],
          ] as const).map(([id,label,icon])=>{
            const I = { Layers:Icon.Layers, User:Icon.User, Image:Icon.Image }[icon];
            const on = tab===id;
            const badge = id==="avatars" && avatars.length>0 ? avatars.length : null;
            return (
              <button key={id} onClick={()=>setTab(id)} style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:7, padding:"10px 16px", borderRadius:10, fontSize:13, fontWeight:600, border:"none", cursor:"pointer", background:on?"oklch(0.72 0.2 300 / 0.13)":"transparent", color:on?"var(--accent)":"var(--text-muted)", transition:"all 0.13s", position:"relative" }}>
                <I />{label}
                {badge && <span style={{ fontSize:10, fontWeight:800, padding:"1px 6px", borderRadius:20, background:"var(--accent)", color:"#fff", marginLeft:2 }}>{badge}</span>}
              </button>
            );
          })}
        </div>

        {/* ════════════ SCRIPTS ════════════ */}
        {tab==="scripts" && (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <ToolCard title="Campaign Brief">
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <div style={{ gridColumn:"1/-1" }}>
                  <FL>Product / offer</FL>
                  <textarea value={product} onChange={e=>setProduct(e.target.value)} rows={2} style={TA} />
                </div>
                <div>
                  <FL>Target audience</FL>
                  <textarea value={audience} onChange={e=>setAudience(e.target.value)} rows={2} style={TA} />
                </div>
                <div>
                  <FL>Niche</FL>
                  <select value={niche} onChange={e=>setNiche(e.target.value)} style={SEL}>
                    {NICHES.map(n=><option key={n}>{n}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginTop:12 }}>
                <FL>Hook angles</FL>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:5 }}>
                  {ALL_ANGLES.map(a=><Chip key={a} label={a} active={angles.has(a)} onClick={()=>setAngles(p=>{ const n=new Set(p); angles.has(a)?n.delete(a):n.add(a); return n; })} />)}
                </div>
              </div>
              <div style={{ display:"flex", gap:14, marginTop:12, flexWrap:"wrap" }}>
                <div>
                  <FL>Script length</FL>
                  <div style={{ display:"flex", gap:6, marginTop:5 }}>
                    {LENGTHS.map(l=><Chip key={l.v} label={l.l} active={length===l.v} onClick={()=>setLength(l.v)} />)}
                  </div>
                </div>
                <div style={{ flex:1, minWidth:140 }}>
                  <FL>Count — {count} briefs</FL>
                  <input type="range" min={1} max={15} value={count} onChange={e=>setCount(+e.target.value)} style={{ width:"100%", accentColor:"var(--accent)", marginTop:10 }} />
                </div>
              </div>
              <GenBtn onClick={doScripts} loading={scriptsLoading} icon={<Icon.Wand/>} label="Generate Script Arc" loadingLabel="Generating with Claude…" />
            </ToolCard>

            {briefs.length>0 && (
              <ToolCard
                title={`${briefs.length} brief${briefs.length!==1?"s":""} in queue`}
                actions={<div style={{ display:"flex", gap:6 }}>
                  <SBtn onClick={exportBriefs}><Icon.Download /> Export</SBtn>
                  <SBtn onClick={()=>setBriefs([])} danger>Clear</SBtn>
                </div>}
              >
                <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
                  {briefs.map((b,i)=><BriefCard key={b.id} brief={b} index={i} />)}
                </div>
              </ToolCard>
            )}
          </div>
        )}

        {/* ════════════ AVATARS ════════════ */}
        {tab==="avatars" && (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <ToolCard
              title="Avatar References"
              actions={
                <button onClick={()=>pickFile("image/*", addAvatar)} style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px", borderRadius:9, fontSize:12, fontWeight:700, background:"oklch(0.72 0.2 300 / 0.14)", border:"1px solid oklch(0.72 0.2 300 / 0.3)", color:"var(--accent)", cursor:"pointer" }}>
                  <Icon.Plus /> Add avatar
                </button>
              }
            >
              <p style={{ fontSize:12, color:"var(--text-muted)", marginBottom:16, lineHeight:1.6 }}>
                Upload reference photos of creators or products. Select one to instantly send it to the Variations tab as the reference image.
              </p>

              {/* Avatar grid */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(110px,1fr))", gap:10 }}>
                {avatars.map(av=>(
                  <div key={av.id} style={{ position:"relative", borderRadius:14, overflow:"hidden", border:`2px solid ${selectedAvatarId===av.id?"var(--accent)":"var(--border)"}`, aspectRatio:"1", cursor:"pointer", transition:"border-color 0.15s" }}
                    onClick={()=>selectAvatarForVariations(av)}>
                    <img src={`data:${av.mimeType};base64,${av.base64}`} alt={av.name} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                    {/* Hover overlay */}
                    <div className="av-overlay" style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"flex-end", padding:8, transition:"background 0.15s" }}
                      onMouseEnter={e=>{ (e.currentTarget as HTMLElement).style.background="rgba(0,0,0,0.55)"; }}
                      onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.background="rgba(0,0,0,0)"; }}>
                      <span style={{ fontSize:10, fontWeight:600, color:"#fff", textAlign:"center", textShadow:"0 1px 4px rgba(0,0,0,0.9)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", width:"100%" }}>{av.name}</span>
                    </div>
                    {selectedAvatarId===av.id && (
                      <div style={{ position:"absolute", top:6, left:6, background:"var(--accent)", borderRadius:"50%", width:18, height:18, display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <Icon.Star />
                      </div>
                    )}
                    {/* Remove btn */}
                    <button onClick={e=>{ e.stopPropagation(); removeAvatar(av.id); }} style={{ position:"absolute", top:5, right:5, background:"rgba(0,0,0,0.7)", border:"none", borderRadius:"50%", width:22, height:22, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#fff", opacity:0, transition:"opacity 0.15s" }}
                      onMouseEnter={e=>(e.currentTarget.style.opacity="1")} onMouseLeave={e=>(e.currentTarget.style.opacity="0")}>
                      <Icon.Close />
                    </button>
                  </div>
                ))}

                {/* Empty slots */}
                {Array.from({ length:Math.max(0, AVATAR_SLOTS - avatars.length) }, (_,i)=>(
                  <div key={`slot-${i}`} onClick={()=>pickFile("image/*", addAvatar)} style={{ borderRadius:14, border:"2px dashed var(--border)", aspectRatio:"1", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:6, cursor:"pointer", color:"var(--text-muted)", transition:"border-color 0.15s, color 0.15s" }}
                    onMouseEnter={e=>{ (e.currentTarget as HTMLElement).style.borderColor="var(--accent)"; (e.currentTarget as HTMLElement).style.color="var(--accent)"; }}
                    onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.borderColor="var(--border)"; (e.currentTarget as HTMLElement).style.color="var(--text-muted)"; }}>
                    <Icon.Plus />
                    <span style={{ fontSize:10, fontWeight:500 }}>Add photo</span>
                  </div>
                ))}
              </div>

              {avatars.length===0 && (
                <p style={{ textAlign:"center", fontSize:12, color:"var(--text-muted)", marginTop:8, opacity:0.7 }}>
                  Upload your first avatar to get started — it will appear as the reference in Variations.
                </p>
              )}
            </ToolCard>

            {/* Drag-to-drop zone for bulk upload */}
            <div
              onDrop={e=>{ e.preventDefault(); Array.from(e.dataTransfer.files).filter(f=>f.type.startsWith("image/")).forEach(addAvatar); }}
              onDragOver={e=>e.preventDefault()}
              style={{ border:"2px dashed var(--border)", borderRadius:14, padding:"20px 24px", textAlign:"center", color:"var(--text-muted)", fontSize:13, transition:"border-color 0.15s" }}
              onMouseEnter={e=>(e.currentTarget.style.borderColor="var(--accent)")}
              onMouseLeave={e=>(e.currentTarget.style.borderColor="var(--border)")}
            >
              <p style={{ marginBottom:4, fontWeight:500 }}>Drop multiple photos here to add them all at once</p>
              <p style={{ fontSize:11, opacity:0.6 }}>PNG, JPG, WebP — any number</p>
            </div>
          </div>
        )}

        {/* ════════════ VARIATIONS ════════════ */}
        {tab==="variations" && (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <ToolCard title="Variation Settings">
              {/* Output type */}
              <FL>Output type</FL>
              <div style={{ display:"flex", gap:6, margin:"6px 0 16px" }}>
                <OutputTypeBtn active={outputType==="photos"} onClick={()=>setOutputType("photos")} icon={<Icon.Image/>} label="Photos" sub="Gemini image gen" />
                <OutputTypeBtn active={outputType==="videos"} onClick={()=>setOutputType("videos")} icon={<Icon.Video/>} label="Videos" sub="Video briefs + render" />
              </div>

              {/* Reference type */}
              <FL>Reference type</FL>
              <div style={{ display:"flex", gap:6, margin:"6px 0 14px" }}>
                {(["person","product"] as const).map(t=><Chip key={t} label={t} active={inputType===t} onClick={()=>setInputType(t)} />)}
              </div>

              {/* Avatar shortcut */}
              {avatars.length>0 && (
                <div style={{ marginBottom:14 }}>
                  <FL>Or pick from saved avatars</FL>
                  <div style={{ display:"flex", gap:8, marginTop:7, flexWrap:"wrap" }}>
                    {avatars.map(av=>(
                      <button key={av.id} onClick={()=>{ setRefBase64(av.base64); setRefMime(av.mimeType); setRefPreviewUrl(`data:${av.mimeType};base64,${av.base64}`); setSelectedAvatarId(av.id); }} style={{ display:"flex", alignItems:"center", gap:7, padding:"5px 10px", borderRadius:10, fontSize:12, fontWeight:500, border:`1px solid ${selectedAvatarId===av.id?"var(--accent)":"var(--border)"}`, background:selectedAvatarId===av.id?"oklch(0.72 0.2 300 / 0.12)":"transparent", color:selectedAvatarId===av.id?"var(--accent)":"var(--text-muted)", cursor:"pointer" }}>
                        <img src={`data:${av.mimeType};base64,${av.base64}`} alt="" style={{ width:22, height:22, borderRadius:6, objectFit:"cover" }} />
                        {av.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Manual upload */}
              <FL>Reference photo{selectedAvatarId?" (avatar selected)":""}</FL>
              <div
                onDrop={e=>{ e.preventDefault(); const f=e.dataTransfer.files[0]; if(f?.type.startsWith("image/")) loadRefFile(f); }}
                onDragOver={e=>e.preventDefault()}
                onClick={()=>pickFile("image/*", loadRefFile)}
                style={{ margin:"6px 0 14px", border:`2px dashed ${refPreviewUrl?"var(--accent)":"var(--border)"}`, borderRadius:14, minHeight:refPreviewUrl?0:100, cursor:"pointer", overflow:"hidden", display:"flex", alignItems:"center", justifyContent:"center", position:"relative", transition:"border-color 0.15s" }}
              >
                {refPreviewUrl
                  ? <>
                      <img src={refPreviewUrl} alt="ref" style={{ maxHeight:180, display:"block" }} />
                      <button onClick={e=>{ e.stopPropagation(); setRefBase64(null); setRefPreviewUrl(null); setSelectedAvatarId(null); }} style={{ position:"absolute", top:7, right:7, background:"rgba(0,0,0,0.7)", border:"none", borderRadius:"50%", width:24, height:24, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#fff" }}>
                        <Icon.Close />
                      </button>
                    </>
                  : <div style={{ textAlign:"center", color:"var(--text-muted)", padding:20 }}>
                      <Icon.Upload />
                      <p style={{ fontSize:13, marginTop:8 }}>Drop or click to upload</p>
                      <p style={{ fontSize:11, marginTop:3, opacity:0.6 }}>or select a saved avatar above</p>
                    </div>
                }
              </div>

              {inputType==="person" && (
                <label style={{ display:"flex", gap:9, marginBottom:14, cursor:"pointer", fontSize:12, color:"var(--text-muted)", alignItems:"flex-start" }}>
                  <input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} style={{ marginTop:1, accentColor:"var(--accent)", flexShrink:0 }} />
                  I confirm I have rights / consent to use this person's likeness for AI-generated content.
                </label>
              )}

              {inputType==="product" && (
                <div style={{ marginBottom:14 }}>
                  <FL>Product name (optional)</FL>
                  <input type="text" value={productName} onChange={e=>setProductName(e.target.value)} placeholder="e.g. Aura Sleep Gummies" style={{ ...INP, marginTop:6 }} />
                </div>
              )}

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
                <div>
                  <FL>Style direction</FL>
                  <textarea value={direction} onChange={e=>setDirection(e.target.value)} rows={2} style={TA} />
                </div>
                <div>
                  {outputType==="photos" && (
                    <>
                      <FL>Aspect ratio</FL>
                      <select value={aspectRatio} onChange={e=>setAspectRatio(e.target.value)} style={SEL}>
                        {["1:1","4:5","9:16","16:9","3:4"].map(r=><option key={r}>{r}</option>)}
                      </select>
                    </>
                  )}
                  <FL style={{ marginTop:outputType==="photos"?12:0 }}>Variations — <strong style={{ color:"var(--text)" }}>{varCount}</strong></FL>
                  <input type="range" min={2} max={50} step={2} value={varCount} onChange={e=>setVarCount(+e.target.value)} style={{ width:"100%", accentColor:"var(--accent)", marginTop:6 }} />
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"var(--text-muted)", marginTop:2 }}>
                    <span>2</span><span>50</span>
                  </div>
                </div>
              </div>

              <GenBtn
                onClick={doVariations}
                loading={varLoading}
                icon={outputType==="videos" ? <Icon.Video/> : <Icon.Image/>}
                label={outputType==="videos" ? `Generate ${varCount} Video Briefs` : `Generate ${varCount} Photo Variations`}
                loadingLabel={outputType==="videos" ? "Building video briefs…" : varCount>30 ? `Generating in two batches (${varCount} photos)…` : "Generating with Gemini…"}
              />
            </ToolCard>

            {/* ── Photo grid output ── */}
            {outputType==="photos" && photoResults.length>0 && (
              <ToolCard title={`${photoResults.filter(r=>r.imageBase64).length} of ${photoResults.length} photos ready`}
                actions={<SBtn onClick={()=>setPhotoResults([])}>Clear</SBtn>}>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(150px,1fr))", gap:9 }}>
                  {photoResults.map((r,i)=>(
                    <div key={i} style={{ borderRadius:12, border:"1px solid var(--border)", background:"var(--bg-card)", overflow:"hidden" }}>
                      {r.imageBase64
                        ? <>
                            <img src={`data:image/jpeg;base64,${r.imageBase64}`} alt="" style={{ width:"100%", display:"block", aspectRatio:aspectRatio.replace(":","/")} } />
                            <div style={{ padding:"6px 9px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                              <span style={{ fontSize:10, color:"var(--text-muted)", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginRight:6 }}>#{i+1} {r.prompt.slice(0,30)}…</span>
                              <a href={`data:image/jpeg;base64,${r.imageBase64}`} download={`variation-${i+1}.jpg`} style={{ color:"var(--accent)", flexShrink:0 }}><Icon.Download /></a>
                            </div>
                          </>
                        : <div style={{ padding:"12px 10px", color:"#f87171", fontSize:11 }}>Error: {r.error}</div>
                      }
                    </div>
                  ))}
                </div>
              </ToolCard>
            )}

            {/* ── Video briefs output ── */}
            {outputType==="videos" && videoPrompts.length>0 && (
              <ToolCard title={`${videoPrompts.length} video briefs — ready to render`}
                actions={<SBtn onClick={()=>setVideoPrompts([])}>Clear</SBtn>}>
                <p style={{ fontSize:12, color:"var(--text-muted)", marginBottom:14, lineHeight:1.6 }}>
                  Each brief is a prompt for a UGC video variation. Click <strong style={{ color:"var(--text)" }}>Render in Video Agent</strong> to send it for generation.
                </p>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(260px,1fr))", gap:9 }}>
                  {videoPrompts.map((prompt,i)=>(
                    <VideoBriefCard key={i} index={i} prompt={prompt} />
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

function PipeStep({ icon, label, sub }:{ icon:React.ReactNode; label:string; sub:string }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, padding:"10px 14px", borderRadius:12, background:"var(--bg-card)", border:"1px solid var(--border)", minWidth:88 }}>
      {icon}<span style={{ fontSize:11, fontWeight:700, textAlign:"center" }}>{label}</span>
      <span style={{ fontSize:9, color:"var(--text-muted)", textAlign:"center", lineHeight:1.4 }}>{sub}</span>
    </div>
  );
}
function Arrow() {
  return <svg width="18" height="14" viewBox="0 0 20 16" fill="none"><path d="M1 8h15M12 2l6 6-6 6" stroke="var(--border-strong)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

function ToolCard({ title, children, actions }:{ title:string; children:React.ReactNode; actions?:React.ReactNode }) {
  return (
    <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:18, overflow:"hidden" }}>
      <div style={{ padding:"13px 18px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <h3 style={{ fontSize:14, fontWeight:700, letterSpacing:"-0.01em" }}>{title}</h3>
        {actions}
      </div>
      <div style={{ padding:18 }}>{children}</div>
    </div>
  );
}

function FL({ children, style }:{ children:React.ReactNode; style?:React.CSSProperties }) {
  return <p style={{ fontSize:11, fontWeight:700, color:"var(--text-muted)", letterSpacing:"0.05em", textTransform:"uppercase", marginBottom:4, ...style }}>{children}</p>;
}

function Chip({ label, active, onClick }:{ label:string; active:boolean; onClick:()=>void }) {
  return (
    <button onClick={onClick} style={{ padding:"5px 11px", borderRadius:8, fontSize:12, fontWeight:500, border:`1px solid ${active?"oklch(0.72 0.2 300 / 0.4)":"var(--border)"}`, background:active?"oklch(0.72 0.2 300 / 0.12)":"transparent", color:active?"var(--accent)":"var(--text-muted)", cursor:"pointer", transition:"all 0.12s" }}>
      {label}
    </button>
  );
}

function OutputTypeBtn({ active, onClick, icon, label, sub }:{ active:boolean; onClick:()=>void; icon:React.ReactNode; label:string; sub:string }) {
  return (
    <button onClick={onClick} style={{ flex:1, display:"flex", alignItems:"center", gap:10, padding:"11px 14px", borderRadius:12, border:`1px solid ${active?"oklch(0.72 0.2 300 / 0.5)":"var(--border)"}`, background:active?"oklch(0.72 0.2 300 / 0.1)":"var(--bg-input)", cursor:"pointer", transition:"all 0.13s" }}>
      <span style={{ color:active?"var(--accent)":"var(--text-muted)" }}>{icon}</span>
      <div style={{ textAlign:"left" }}>
        <p style={{ fontSize:13, fontWeight:700, color:active?"var(--accent)":"var(--text)", marginBottom:2 }}>{label}</p>
        <p style={{ fontSize:11, color:"var(--text-muted)" }}>{sub}</p>
      </div>
    </button>
  );
}

function GenBtn({ onClick, loading, icon, label, loadingLabel }:{ onClick:()=>void; loading:boolean; icon:React.ReactNode; label:string; loadingLabel:string }) {
  return (
    <button onClick={onClick} disabled={loading} className="glow-btn" style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, width:"100%", padding:"13px 20px", borderRadius:12, fontWeight:800, fontSize:14, background:"var(--accent)", border:"none", color:"#fff", cursor:loading?"not-allowed":"pointer", opacity:loading?0.65:1, marginTop:18, letterSpacing:"-0.01em" }}>
      {loading ? <><Icon.Spinner />{loadingLabel}</> : <>{icon}{label}</>}
    </button>
  );
}

function SBtn({ children, onClick, danger }:{ children:React.ReactNode; onClick:()=>void; danger?:boolean }) {
  return <button onClick={onClick} style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 11px", borderRadius:8, fontSize:12, fontWeight:500, background:"transparent", border:"1px solid var(--border)", color:danger?"#f87171":"var(--text-muted)", cursor:"pointer" }}>{children}</button>;
}

function BriefCard({ brief, index }:{ brief:UgcBrief & {id:number}; index:number }) {
  const [copied, setCopied] = useState<"script"|"json"|null>(null);
  const badge = arcBadge(brief.arc_position);
  function copy(type:"script"|"json") {
    navigator.clipboard.writeText(type==="script"?brief.script:JSON.stringify(brief,null,2));
    setCopied(type); setTimeout(()=>setCopied(null),1600);
  }
  return (
    <div style={{ border:"1px solid var(--border)", borderRadius:14, overflow:"hidden", background:"rgba(255,255,255,0.02)" }}>
      <div style={{ padding:"10px 13px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:6 }}>
        <div style={{ display:"flex", alignItems:"center", gap:7 }}>
          <span style={{ fontSize:10, fontWeight:700, color:"var(--text-muted)", minWidth:18 }}>#{index+1}</span>
          <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:5, background:badge.bg, color:badge.color }}>{brief.arc_position.split(" ")[0]}</span>
          <span style={{ fontSize:11, color:"var(--text-muted)" }}>{brief.angle}</span>
        </div>
        <div style={{ display:"flex", gap:5 }}>
          {(["script","json"] as const).map(t=>(
            <button key={t} onClick={()=>copy(t)} style={{ display:"flex", alignItems:"center", gap:3, padding:"3px 8px", borderRadius:6, fontSize:11, fontWeight:500, background:"rgba(255,255,255,0.04)", border:"1px solid var(--border)", color:copied===t?"var(--accent)":"var(--text-muted)", cursor:"pointer" }}>
              {copied===t?<Icon.Check/>:<Icon.Copy/>}{t==="script"?"Script":"JSON"}
            </button>
          ))}
        </div>
      </div>
      <div style={{ padding:"12px 13px" }}>
        <p style={{ fontSize:13, fontWeight:600, color:"var(--accent)", marginBottom:7 }}>"{brief.hook}"</p>
        <p style={{ fontSize:12, color:"var(--text)", lineHeight:1.7, marginBottom:11, whiteSpace:"pre-wrap" }}>{brief.script}</p>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:7 }}>
          {[["Scene",brief.scene_direction],["On-screen",brief.on_screen_text],["CTA",brief.cta],["Caption",brief.caption]].map(([k,v])=>(
            <div key={k} style={{ background:"rgba(255,255,255,0.025)", borderRadius:8, padding:"7px 9px" }}>
              <p style={{ fontSize:9, fontWeight:700, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:2 }}>{k}</p>
              <p style={{ fontSize:12, color:"var(--text)", lineHeight:1.5 }}>{v}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function VideoBriefCard({ index, prompt }:{ index:number; prompt:string }) {
  const [copied, setCopied] = useState(false);
  function copy() { navigator.clipboard.writeText(prompt); setCopied(true); setTimeout(()=>setCopied(false),1600); }
  const angle = ALL_ANGLES[index % ALL_ANGLES.length];
  const duration = ["0:15","0:30","0:45"][index % 3];
  return (
    <div style={{ border:"1px solid var(--border)", borderRadius:14, overflow:"hidden", background:"rgba(255,255,255,0.02)" }}>
      <div style={{ padding:"10px 13px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:7 }}>
          <div style={{ width:28, height:28, borderRadius:8, background:"oklch(0.72 0.2 300 / 0.12)", border:"1px solid oklch(0.72 0.2 300 / 0.25)", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--accent)" }}>
            <Icon.Play />
          </div>
          <div>
            <p style={{ fontSize:12, fontWeight:700, color:"var(--text)" }}>Video #{index+1}</p>
            <p style={{ fontSize:10, color:"var(--text-muted)" }}>{angle} · {duration}</p>
          </div>
        </div>
        <button onClick={copy} style={{ display:"flex", alignItems:"center", gap:4, padding:"4px 8px", borderRadius:6, fontSize:11, fontWeight:500, background:"transparent", border:"1px solid var(--border)", color:copied?"var(--accent)":"var(--text-muted)", cursor:"pointer" }}>
          {copied?<Icon.Check/>:<Icon.Copy/>}Copy
        </button>
      </div>
      <div style={{ padding:"11px 13px" }}>
        <p style={{ fontSize:12, color:"var(--text)", lineHeight:1.65 }}>{prompt}</p>
        <a href="/video-agent/" target="_blank" rel="noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:5, marginTop:10, fontSize:11, fontWeight:600, color:"var(--accent)", textDecoration:"none" }}>
          <Icon.Video /> Render in Video Agent →
        </a>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function dl(blob:Blob, name:string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
}

const BASE:React.CSSProperties = { width:"100%", background:"var(--bg-input)", border:"1px solid var(--border)", borderRadius:10, color:"var(--text)", fontSize:13, outline:"none", transition:"border-color 0.15s" };
const TA:React.CSSProperties   = { ...BASE, padding:"9px 11px", resize:"vertical", lineHeight:1.6 };
const INP:React.CSSProperties  = { ...BASE, padding:"9px 11px" };
const SEL:React.CSSProperties  = { ...BASE, padding:"9px 11px", cursor:"pointer" };
