import { useState, useEffect, useRef, useCallback } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { LIVE_SCENES, type LiveScene } from "@/lib/live-studio-data";
import { ImagePlus, X, Download, Loader2, Sparkles, LogOut, RefreshCw, Check } from "lucide-react";

interface Props { session: Session; }

type JobStatus = "pending" | "processing" | "completed" | "failed";
interface Generation {
  id: string;
  prompt: string;
  status: JobStatus;
  result_image_url: string | null;
  created_at: string;
  error: string | null;
}

const AURORA_URL = import.meta.env.VITE_AURORA_URL || "";
const MODEL = "google/gemini-3.1-flash-image-preview";

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
    processing: { color: "var(--accent)", label: "Rendering" },
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

export function LiveSessionStudio({ session }: Props) {
  const [sceneId, setSceneId] = useState(LIVE_SCENES[0].id);
  const [refFile, setRefFile] = useState<File | null>(null);
  const [refPreview, setRefPreview] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scene: LiveScene = LIVE_SCENES.find(s => s.id === sceneId) ?? LIVE_SCENES[0];

  const fetchGallery = useCallback(async () => {
    const { data, error } = await supabase
      .from("generations")
      .select("id,prompt,status,result_image_url,created_at,error")
      .eq("kind", "image")
      .order("created_at", { ascending: false })
      .limit(24);
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

  function setFile(file: File) {
    setRefFile(file);
    setRefPreview(URL.createObjectURL(file));
  }

  async function uploadRef(file: File): Promise<string> {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${session.user.id}/live-refs/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("studio").upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    const { data: signed, error: se } = await supabase.storage.from("studio").createSignedUrl(path, 3600);
    if (se || !signed) throw new Error("Could not sign reference image");
    return signed.signedUrl;
  }

  async function generate() {
    if (!refFile) { toast.error("Upload your reference photo first"); return; }
    setGenerating(true);
    try {
      const imageUrl = await uploadRef(refFile);
      const res = await fetch(`${AURORA_URL}/api/public/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ kind: "image", prompt: scene.prompt, imageUrls: [imageUrl], model: MODEL }),
      });
      const data: unknown = await res.json();
      if (!res.ok) throw new Error((data as { error?: string })?.error ?? "Generation failed");
      toast.success("Live shot queued! Rendering now…");
      await fetchGallery();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start generation");
    } finally {
      setGenerating(false);
    }
  }

  const s = { fontFamily: "'Inter', sans-serif", color: "var(--text)" };

  return (
    <div style={{ ...s, minHeight: "100vh", background: "var(--bg)" }}>
      {/* Header */}
      <header style={{ borderBottom: "1px solid var(--border)", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-card)", position: "sticky", top: 0, zIndex: 50, backdropFilter: "blur(12px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #8b5cf6, #6366f1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 18 }}>🎙</span>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Live Session Studio</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Place yourself in a KEXP-style performance space</div>
          </div>
        </div>
        <button
          onClick={() => supabase.auth.signOut()}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontSize: 13 }}
        >
          <LogOut size={14} /> Sign out
        </button>
      </header>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 20px", display: "grid", gridTemplateColumns: "1fr 340px", gap: 28 }}>
        {/* Left: Scene picker */}
        <div>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 14, color: "var(--text)" }}>Pick a session scene</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
            {LIVE_SCENES.map(sc => (
              <button
                key={sc.id}
                onClick={() => setSceneId(sc.id)}
                style={{
                  position: "relative",
                  aspectRatio: "16/9",
                  borderRadius: 12,
                  border: `2px solid ${sceneId === sc.id ? "var(--accent)" : "var(--border)"}`,
                  overflow: "hidden",
                  cursor: "pointer",
                  background: "var(--bg-card)",
                  padding: 0,
                  boxShadow: sceneId === sc.id ? "0 0 0 3px rgba(139,92,246,0.2)" : undefined,
                  transition: "all 0.15s",
                }}
              >
                <img src={sc.thumb} alt={sc.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 60%)" }} />
                {sceneId === sc.id && (
                  <div style={{ position: "absolute", top: 8, right: 8, width: 22, height: 22, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Check size={12} color="#fff" />
                  </div>
                )}
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "8px 10px" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{sc.name}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 2 }}>{sc.tagline}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Gallery */}
          {generations.length > 0 && (
            <div style={{ marginTop: 32 }}>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 14 }}>Your shots</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
                {generations.map(g => (
                  <div key={g.id} style={{ borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-card)", overflow: "hidden" }}>
                    {g.status === "completed" && g.result_image_url ? (
                      <>
                        <img src={g.result_image_url} alt="Generated" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }} />
                        <div style={{ padding: "8px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <StatusDot status={g.status} />
                          <button onClick={() => download(g.result_image_url!, `live-session-${g.id}.jpg`)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--text-muted)" }}><Download size={14} /></button>
                        </div>
                      </>
                    ) : (
                      <div style={{ aspectRatio: "1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
                        {(g.status === "pending" || g.status === "processing") && <Loader2 size={20} style={{ animation: "spin 1s linear infinite", color: "var(--accent)" }} />}
                        <StatusDot status={g.status} />
                        {g.error && <span style={{ fontSize: 11, color: "#ef4444", padding: "0 8px", textAlign: "center" }}>{g.error}</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Upload + Generate */}
        <div style={{ position: "sticky", top: 86 }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
              {scene.name}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>{scene.tagline}</div>

            {/* Upload */}
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) setFile(f); e.target.value = ""; }} />
            <button
              onClick={() => refFile ? (setRefFile(null), setRefPreview(null)) : fileRef.current?.click()}
              style={{
                width: "100%",
                aspectRatio: "1",
                borderRadius: 12,
                border: `2px dashed ${refFile ? "var(--accent)" : "var(--border)"}`,
                background: "var(--bg)",
                cursor: "pointer",
                overflow: "hidden",
                padding: 0,
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 14,
              }}
            >
              {refPreview ? (
                <>
                  <img src={refPreview} alt="Ref" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <div style={{ position: "absolute", top: 8, right: 8, width: 24, height: 24, borderRadius: "50%", background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <X size={12} color="#fff" />
                  </div>
                </>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: "var(--text-muted)" }}>
                  <ImagePlus size={28} />
                  <span style={{ fontSize: 13, fontWeight: 500 }}>Upload your photo</span>
                  <span style={{ fontSize: 11 }}>Front-facing, clear lighting</span>
                </div>
              )}
            </button>

            <button
              onClick={generate}
              disabled={!refFile || generating}
              style={{
                width: "100%",
                padding: "13px 0",
                borderRadius: 10,
                border: "none",
                background: !refFile || generating ? "var(--border)" : "linear-gradient(135deg, #8b5cf6, #6366f1)",
                color: !refFile || generating ? "var(--text-muted)" : "#fff",
                fontWeight: 700,
                fontSize: 15,
                cursor: !refFile || generating ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                transition: "all 0.15s",
              }}
            >
              {generating ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Rendering…</> : <><Sparkles size={16} /> Generate · 1 Aura</>}
            </button>

            {loadingGallery ? null : (
              <button
                onClick={() => void fetchGallery()}
                style={{ width: "100%", marginTop: 10, padding: "9px 0", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                <RefreshCw size={13} /> Refresh gallery
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
