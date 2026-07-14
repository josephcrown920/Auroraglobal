import { useState, useEffect, useRef, useCallback } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Lock, EyeOff, ShieldCheck, Star, ImagePlus, X, Download, Loader2, Sparkles, LogOut, RefreshCw, Camera } from "lucide-react";

interface Props { session: Session; }

type JobStatus = "pending" | "processing" | "completed" | "failed";
interface Generation { id: string; prompt: string; status: JobStatus; result_image_url: string | null; created_at: string; error: string | null; }

const AURORA_URL = import.meta.env.VITE_AURORA_URL || "";

const LOOKS = [
  { id: "boudoir", label: "Boudoir Editorial", prompt: "Magazine-grade boudoir editorial portrait — luxurious silk sheets, soft morning window light, warm amber glow, intimate but tasteful composition. Preserve facial likeness exactly. ARRI cinema look, 85mm f/1.4, 8K ultra-HD." },
  { id: "velvet", label: "Velvet Fantasy", prompt: "Cinematic editorial portrait in deep velvet surroundings — velvet chaise, rich jewel-tone colors, atmospheric side lighting, dramatic shadows, editorial fashion look. Preserve facial likeness. 50mm anamorphic, 8K ultra-HD." },
  { id: "golden", label: "Golden Hour", prompt: "Golden hour outdoor editorial — warm backlit rim light, soft bokeh background, glowing skin, sun-kissed look. Preserve facial likeness exactly. 85mm shallow DOF, 8K ultra-HD cinematic." },
  { id: "neon", label: "Neon Temptation", prompt: "Moody neon-lit editorial portrait — Blade Runner color palette with magenta and cyan gels, atmospheric haze, wet reflections. Preserve facial likeness. 35mm anamorphic, 8K ultra-HD." },
  { id: "luxury", label: "Luxury Suite", prompt: "Five-star hotel suite editorial — marble surfaces, designer furnishings, warm chandelier light, aspirational editorial look. Preserve facial likeness exactly. 50mm, 8K ultra-HD." },
  { id: "noir", label: "Private Noir", prompt: "Classic film noir editorial portrait — high contrast black and white, single hard spotlight, venetian blind shadow patterns, old Hollywood glamour. Preserve facial likeness. 50mm, 8K ultra-HD." },
  { id: "ethereal", label: "Ethereal Light", prompt: "Ethereal high-key editorial portrait — soft diffused light, dreamy atmosphere, white and cream tones, delicate shadows, angelic editorial look. Preserve facial likeness exactly. 85mm f/1.2, 8K ultra-HD." },
  { id: "power", label: "Power Shot", prompt: "Bold power editorial portrait — strong directional dramatic lighting, high contrast, confident pose framing, fashion magazine cover quality. Preserve facial likeness. 50mm, 8K ultra-HD." },
];

const TRUST_FEATURES = [
  { icon: <EyeOff size={18} />, label: "Identity Masking", desc: "AI face-swap and blur on demand" },
  { icon: <Lock size={18} />, label: "Private Vault", desc: "Zero public indexing, ever" },
  { icon: <ShieldCheck size={18} />, label: "Watermark Built-in", desc: "Brand every frame automatically" },
  { icon: <Star size={18} />, label: "Subscriber Magnets", desc: "Magazine-grade editorial looks" },
];

function download(url: string, name: string) {
  fetch(url).then(r => r.blob()).then(blob => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
  }).catch(() => window.open(url, "_blank"));
}

function StatusDot({ status }: { status: JobStatus }) {
  const map: Record<JobStatus, { color: string; label: string }> = {
    pending: { color: "#f59e0b", label: "Queued" },
    processing: { color: "#e11d6a", label: "Rendering" },
    completed: { color: "#22c55e", label: "Done" },
    failed: { color: "#ef4444", label: "Failed" },
  };
  const { color, label } = map[status];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, display: "inline-block" }} />
      {label}
    </span>
  );
}

export function AdultStudio({ session }: Props) {
  const [lookId, setLookId] = useState(LOOKS[0].id);
  const [customPrompt, setCustomPrompt] = useState("");
  const [refFiles, setRefFiles] = useState<File[]>([]);
  const [refPreviews, setRefPreviews] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(true);
  const [view, setView] = useState<"studio" | "gallery">("studio");
  const fileRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selectedLook = LOOKS.find(l => l.id === lookId) ?? LOOKS[0];

  const fetchGallery = useCallback(async () => {
    const { data, error } = await supabase.from("generations").select("id,prompt,status,result_image_url,created_at,error").eq("kind", "image").order("created_at", { ascending: false }).limit(40);
    if (!error && data) setGenerations(data as Generation[]);
    setLoadingGallery(false);
  }, []);

  useEffect(() => { void fetchGallery(); }, [fetchGallery]);

  useEffect(() => {
    const hasActive = generations.some(g => g.status === "pending" || g.status === "processing");
    if (hasActive) {
      if (!pollRef.current) pollRef.current = setInterval(() => void fetchGallery(), 3500);
    } else {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    }
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [generations, fetchGallery]);

  function addFiles(files: FileList | null) {
    if (!files) return;
    const newFiles = [...refFiles, ...Array.from(files)].slice(0, 2);
    setRefFiles(newFiles);
    setRefPreviews(newFiles.map(f => URL.createObjectURL(f)));
  }

  function removeFile(i: number) {
    const nf = refFiles.filter((_, idx) => idx !== i);
    setRefFiles(nf);
    setRefPreviews(nf.map(f => URL.createObjectURL(f)));
  }

  async function uploadRef(file: File): Promise<string> {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${session.user.id}/adult-refs/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("studio").upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    const { data: signed, error: se } = await supabase.storage.from("studio").createSignedUrl(path, 3600);
    if (se || !signed) throw new Error("Could not sign reference image");
    return signed.signedUrl;
  }

  async function generate() {
    if (refFiles.length === 0) { toast.error("Upload at least one reference photo"); return; }
    setGenerating(true);
    try {
      const imageUrls = await Promise.all(refFiles.map(uploadRef));
      const base = selectedLook.prompt;
      const extra = customPrompt.trim() ? ` Additional details: ${customPrompt.trim()}` : "";
      const identityPrefix = "You are an AI compositor. Use the uploaded face photo as identity reference — keep facial likeness, skin tone, hairstyle EXACTLY the same. ";
      const prompt = identityPrefix + base + extra + " Hyper-realistic photography, ultra-HD 8K, lifelike skin texture, physically accurate lighting, no CGI or illustration look.";
      const token = session.access_token;
      const base_url = AURORA_URL || "";
      const res = await fetch(`${base_url}/api/public/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ kind: "image", prompt, imageUrls, model: "google/nano-banana" }),
      });
      const data: unknown = await res.json();
      if (!res.ok) throw new Error((data as { error?: string })?.error ?? "Generation failed");
      toast.success("Shot queued — rendering now…");
      setView("gallery");
      await fetchGallery();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to start generation");
    } finally {
      setGenerating(false);
    }
  }

  const activeCount = generations.filter(g => g.status === "pending" || g.status === "processing").length;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      {/* Ambient glow */}
      <div style={{ position: "fixed", top: 0, right: 0, width: 500, height: 500, background: "radial-gradient(ellipse, rgba(225,29,106,0.08) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      {/* Header */}
      <header style={{ borderBottom: "1px solid var(--border)", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(7,4,10,0.85)", position: "sticky", top: 0, zIndex: 50, backdropFilter: "blur(12px)", position: "relative" as "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: "linear-gradient(135deg, #e11d6a, #7c0a3a)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 20px rgba(225,29,106,0.4)" }}>
            <Camera size={18} color="white" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.02em", color: "var(--text)" }}>Aurora for Creators</div>
            <div style={{ fontSize: 11, color: "#e11d6a", fontWeight: 600 }}>🔞 18+ · Private · Secured</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {activeCount > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#e11d6a", fontWeight: 600 }}>
              <Loader2 size={14} className="animate-spin" /> {activeCount} rendering
            </div>
          )}
          {/* Nav tabs */}
          {(["studio", "gallery"] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${view === v ? "#e11d6a" : "var(--border)"}`, background: view === v ? "rgba(225,29,106,0.12)" : "transparent", color: view === v ? "#e11d6a" : "var(--text-muted)", fontWeight: 600, fontSize: 14, cursor: "pointer", textTransform: "capitalize" }}>
              {v}
            </button>
          ))}
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{session.user.email}</span>
          <button onClick={() => supabase.auth.signOut()} style={{ padding: "7px 12px", background: "transparent", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <LogOut size={14} /> Out
          </button>
        </div>
      </header>

      {view === "studio" ? (
        <div style={{ flex: 1, maxWidth: 900, margin: "0 auto", width: "100%", padding: "32px 24px" }}>
          {/* Hero */}
          <div style={{ marginBottom: 36 }}>
            <h1 style={{ margin: "0 0 10px", fontSize: 38, fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1.1, color: "var(--text)" }}>
              Your content.{" "}
              <span style={{ color: "#e11d6a" }}>Your control.</span>
            </h1>
            <p style={{ margin: 0, fontSize: 16, color: "var(--text-muted)", lineHeight: 1.6 }}>
              AI photoshoots that protect your identity, amplify your brand, and keep subscribers wanting more.<br />
              No set. No photographer. Complete discretion.
            </p>
          </div>

          {/* Trust features */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 36 }}>
            {TRUST_FEATURES.map(f => (
              <div key={f.label} style={{ padding: "14px 16px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ color: "#e11d6a" }}>{f.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>{f.label}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}>{f.desc}</div>
              </div>
            ))}
          </div>

          {/* Studio card */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 20, padding: 28 }}>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text)", marginBottom: 20 }}>Create your shoot</div>

            {/* Look picker */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Choose a look</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                {LOOKS.map(look => (
                  <button key={look.id} onClick={() => setLookId(look.id)} style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${lookId === look.id ? "#e11d6a" : "var(--border)"}`, background: lookId === look.id ? "rgba(225,29,106,0.1)" : "var(--bg)", color: lookId === look.id ? "#f43f5e" : "var(--text-muted)", fontWeight: 600, fontSize: 12, cursor: "pointer", textAlign: "center", transition: "all 0.15s" }}>
                    {look.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom prompt */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Additional details <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span></div>
              <textarea value={customPrompt} onChange={e => setCustomPrompt(e.target.value)} placeholder="Describe any specific outfit, setting, or styling details…" rows={3} style={{ width: "100%", padding: "12px 14px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)", fontSize: 14, resize: "none", outline: "none", boxSizing: "border-box", lineHeight: 1.5 }} />
            </div>

            {/* Reference upload */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Reference photos <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(up to 2)</span></div>
              <input ref={fileRef} type="file" accept="image/*" multiple onChange={e => addFiles(e.target.files)} style={{ display: "none" }} />
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                {refPreviews.map((p, i) => (
                  <div key={i} style={{ position: "relative", width: 90, height: 90, borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)" }}>
                    <img src={p} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <button onClick={() => removeFile(i)} style={{ position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: 6, background: "rgba(0,0,0,0.7)", border: "none", cursor: "pointer", color: "white", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                      <X size={11} />
                    </button>
                    <div style={{ position: "absolute", bottom: 3, left: 3, fontSize: 9, fontWeight: 700, background: "rgba(0,0,0,0.75)", color: "white", padding: "2px 5px", borderRadius: 4 }}>
                      {i === 0 ? "FACE" : "OUTFIT"}
                    </div>
                  </div>
                ))}
                {refFiles.length < 2 && (
                  <button onClick={() => fileRef.current?.click()} style={{ width: 90, height: 90, borderRadius: 12, border: "2px dashed var(--border)", background: "var(--bg)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, color: "var(--text-muted)", transition: "border-color 0.15s" }}>
                    <ImagePlus size={22} />
                    <span style={{ fontSize: 11, fontWeight: 600 }}>Add photo</span>
                  </button>
                )}
                {refFiles.length === 0 && (
                  <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5, alignSelf: "center" }}>
                    Photo 1 = face reference for identity lock.<br />
                    Photo 2 (optional) = outfit reference.
                  </p>
                )}
              </div>
            </div>

            <button onClick={generate} disabled={generating || refFiles.length === 0} style={{ width: "100%", padding: "15px", background: generating || refFiles.length === 0 ? "var(--bg-elevated)" : "linear-gradient(135deg, #e11d6a, #9b1239)", border: `1px solid ${generating || refFiles.length === 0 ? "var(--border)" : "transparent"}`, borderRadius: 12, color: generating || refFiles.length === 0 ? "var(--text-muted)" : "white", fontWeight: 800, fontSize: 16, cursor: generating || refFiles.length === 0 ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: generating || refFiles.length === 0 ? "none" : "0 0 32px rgba(225,29,106,0.4)", transition: "all 0.2s", letterSpacing: "-0.01em" }}>
              {generating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
              {generating ? "Queuing your shot…" : "Generate · 1 Aura"}
            </button>

            {/* Privacy note */}
            <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "center" }}>
              {["🔒 Private vault", "🛡 Watermarked", "👁 Identity masking available", "⚡ Results in ~60s"].map(t => (
                <span key={t} style={{ fontSize: 12, color: "var(--text-muted)" }}>{t}</span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Gallery view */
        <div style={{ flex: 1, maxWidth: 1000, margin: "0 auto", width: "100%", padding: "28px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text)" }}>Your private gallery</div>
            <button onClick={() => { setLoadingGallery(true); void fetchGallery(); }} style={{ padding: "7px 14px", background: "transparent", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              <RefreshCw size={13} /> Refresh
            </button>
          </div>

          {loadingGallery ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "var(--text-muted)", gap: 8 }}>
              <Loader2 size={18} className="animate-spin" /> Loading…
            </div>
          ) : generations.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 300, gap: 12, color: "var(--text-muted)" }}>
              <Camera size={48} style={{ opacity: 0.3 }} />
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>No shots yet</div>
              <button onClick={() => setView("studio")} style={{ padding: "10px 22px", background: "linear-gradient(135deg, #e11d6a, #9b1239)", border: "none", borderRadius: 10, color: "white", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
                Start your first shoot
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
              {generations.map(g => (
                <div key={g.id} style={{ borderRadius: 14, overflow: "hidden", border: "1px solid var(--border)", background: "var(--bg-card)" }} className="animate-fade-in">
                  {g.result_image_url ? (
                    <div style={{ position: "relative", aspectRatio: "9/16" }}>
                      <img src={g.result_image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      <button onClick={() => download(g.result_image_url!, `aurora-creator-${g.id}.jpg`)} style={{ position: "absolute", bottom: 10, right: 10, padding: "7px 10px", background: "rgba(0,0,0,0.7)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, color: "white", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, backdropFilter: "blur(4px)" }}>
                        <Download size={12} /> Save
                      </button>
                    </div>
                  ) : (
                    <div style={{ aspectRatio: "9/16", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, background: "var(--bg)" }}>
                      {g.status === "failed" ? (
                        <><X size={28} style={{ color: "#ef4444" }} /><div style={{ fontSize: 13, color: "#ef4444", textAlign: "center", padding: "0 10px" }}>{g.error ?? "Render failed"}</div></>
                      ) : (
                        <><Loader2 size={28} style={{ color: "#e11d6a" }} className="animate-spin" /><div style={{ fontSize: 13, color: "var(--text-muted)" }}>Rendering…</div></>
                      )}
                    </div>
                  )}
                  <div style={{ padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{new Date(g.created_at).toLocaleDateString()}</div>
                    <StatusDot status={g.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
