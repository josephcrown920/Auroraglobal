import { useState, useEffect, useRef, useCallback } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { COLOR_PRESETS, SETUP_KINDS, SETUPS, buildPrompt, type SetupKind, type OutputMode, type CameraMode } from "@/lib/colors-data";
import { Palette, ImagePlus, X, Download, Loader2, Sparkles, LogOut, RefreshCw, Check, ArrowLeft } from "lucide-react";

interface Props { session: Session; }

type JobStatus = "pending" | "processing" | "completed" | "failed";
interface Generation {
  id: string;
  prompt: string;
  status: JobStatus;
  result_image_url: string | null;
  result_video_url: string | null;
  created_at: string;
  error: string | null;
}

const AURORA_URL = import.meta.env.VITE_AURORA_URL || "";
const COST_IMAGE = 1;
const COST_VIDEO = 10;
const MODEL = "google/gemini-3.1-flash-image-preview";

function download(url: string, name: string) {
  fetch(url)
    .then((r) => r.blob())
    .then((blob) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
    })
    .catch(() => window.open(url, "_blank"));
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
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: color,
          display: "inline-block",
          boxShadow: status === "processing" ? `0 0 8px ${color}` : undefined,
        }}
        className={status === "processing" ? "animate-pulse-glow" : ""}
      />
      {label}
    </span>
  );
}

export function ColorsStudio({ session }: Props) {
  const [colorId, setColorId] = useState(COLOR_PRESETS[1].id);
  const [setupKind, setSetupKind] = useState<SetupKind>("performance");
  const [setupId, setSetupId] = useState("performance");
  const [outputMode, setOutputMode] = useState<OutputMode>("image");
  const [cameraMode, setCameraMode] = useState<CameraMode>("tripod");
  const [refFiles, setRefFiles] = useState<File[]>([]);
  const [refPreviews, setRefPreviews] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const color = COLOR_PRESETS.find((c) => c.id === colorId) ?? COLOR_PRESETS[0];
  const filteredSetups = SETUPS.filter((s) => s.kind === setupKind);
  const setup = filteredSetups.find((s) => s.id === setupId) ?? filteredSetups[0];

  const fetchGallery = useCallback(async () => {
    const { data, error } = await supabase
      .from("generations")
      .select("id,prompt,status,result_image_url,result_video_url,created_at,error")
      .in("kind", ["image", "video"])
      .order("created_at", { ascending: false })
      .limit(30);
    if (!error && data) setGenerations(data as Generation[]);
    setLoadingGallery(false);
  }, []);

  useEffect(() => {
    void fetchGallery();
  }, [fetchGallery]);

  useEffect(() => {
    const hasActive = generations.some((g) => g.status === "pending" || g.status === "processing");
    if (hasActive) {
      if (!pollRef.current) {
        pollRef.current = setInterval(() => void fetchGallery(), 3500);
      }
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [generations, fetchGallery]);

  function addFiles(files: FileList | null) {
    if (!files) return;
    const arr = Array.from(files).slice(0, 2 - refFiles.length);
    const newFiles = [...refFiles, ...arr].slice(0, 2);
    setRefFiles(newFiles);
    setRefPreviews(newFiles.map((f) => URL.createObjectURL(f)));
  }

  function removeFile(i: number) {
    const nf = refFiles.filter((_, idx) => idx !== i);
    setRefFiles(nf);
    setRefPreviews(nf.map((f) => URL.createObjectURL(f)));
  }

  async function uploadRef(file: File): Promise<string> {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${session.user.id}/colors-refs/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("studio").upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (error) throw error;
    const { data: signed, error: se } = await supabase.storage.from("studio").createSignedUrl(path, 3600);
    if (se || !signed) throw new Error("Could not sign reference image");
    return signed.signedUrl;
  }

  async function generate() {
    if (refFiles.length === 0) {
      toast.error("Upload at least one reference photo");
      return;
    }
    setGenerating(true);
    try {
      const imageUrls = await Promise.all(refFiles.map(uploadRef));
      const prompt = buildPrompt(colorId, setup?.id ?? setupId, refFiles.length > 1, outputMode, cameraMode);
      const token = session.access_token;
      const res = await fetch(`${AURORA_URL}/api/public/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          kind: outputMode === "video" ? "video" : "image",
          prompt,
          imageUrls,
          model: outputMode === "video" ? undefined : MODEL,
        }),
      });
      const data: unknown = await res.json();
      if (!res.ok) {
        const msg = (data as { error?: string })?.error ?? "Generation failed";
        throw new Error(msg);
      }
      toast.success("Shot queued! Rendering now…");
      await fetchGallery();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to start generation");
    } finally {
      setGenerating(false);
    }
  }

  const activeCount = generations.filter(
    (g) => g.status === "pending" || g.status === "processing",
  ).length;

  const canGenerate = !generating && refFiles.length > 0;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      {/* ── Header ───────────────────────────────────────────────── */}
      <header
        style={{
          borderBottom: "1px solid var(--border)",
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "var(--bg-card)",
          position: "sticky",
          top: 0,
          zIndex: 50,
          backdropFilter: "blur(12px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "linear-gradient(135deg, var(--accent), oklch(0.6 0.22 280))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 16px var(--accent-glow)",
            }}
          >
            <Palette size={18} color="white" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.02em", color: "var(--text)" }}>
              Colors Studio
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>by Aurora</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {activeCount > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--accent)", fontWeight: 600 }}>
              <Loader2 size={14} className="animate-spin" /> {activeCount} rendering
            </div>
          )}
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{session.user.email}</span>
          <button
            onClick={() => supabase.auth.signOut()}
            style={{
              padding: "7px 12px",
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--text-muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </header>

      <div style={{ flex: 1, display: "flex", gap: 0 }}>
        {/* ── Sidebar — controls ────────────────────────────────── */}
        <div
          style={{
            width: 340,
            borderRight: "1px solid var(--border)",
            padding: "24px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 24,
            overflowY: "auto",
            flexShrink: 0,
          }}
        >
          {/* Intro copy */}
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text)", lineHeight: 1.2 }}>
              Pick a color.{" "}
              <span
                style={{
                  background: "linear-gradient(90deg, var(--accent), oklch(0.72 0.2 260))",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Show up in that world.
              </span>
            </h1>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
              12 seamless-cyclorama studio sets, each lit in its own bold color. Upload a selfie and Aurora places you inside it.
            </p>
          </div>

          {/* ── Color picker — pills ──────────────────────────────── */}
          <section>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 10,
              }}
            >
              Color
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {COLOR_PRESETS.map((c) => {
                const selected = colorId === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setColorId(c.id)}
                    aria-label={`Select ${c.name}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "5px 12px",
                      borderRadius: 999,
                      border: `1px solid ${selected ? "rgba(139,92,246,0.6)" : "var(--border)"}`,
                      background: selected ? `${c.swatch}33` : "var(--bg-card)",
                      color: selected ? "var(--text)" : "var(--text-muted)",
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: "pointer",
                      transition: "all 0.15s",
                      boxShadow: selected ? `0 0 14px ${c.swatch}55` : "none",
                      transform: selected ? "scale(1.04)" : "scale(1)",
                    }}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: c.swatch,
                        flexShrink: 0,
                        boxShadow: selected ? `0 0 6px ${c.swatch}` : "none",
                        border: c.swatch === "#f8fafc" ? "1px solid rgba(255,255,255,0.3)" : "none",
                      }}
                    />
                    {c.name}
                  </button>
                );
              })}
            </div>
          </section>

          {/* ── Scene type ───────────────────────────────────────── */}
          <section>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 10,
              }}
            >
              Scene type
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {SETUP_KINDS.map((k) => (
                <button
                  key={k.id}
                  onClick={() => {
                    setSetupKind(k.id);
                    setSetupId(SETUPS.find((s) => s.kind === k.id)?.id ?? k.id);
                  }}
                  style={{
                    padding: "6px 13px",
                    borderRadius: 8,
                    border: `1px solid ${setupKind === k.id ? "var(--accent)" : "var(--border)"}`,
                    background: setupKind === k.id ? "rgba(139,92,246,0.12)" : "transparent",
                    color: setupKind === k.id ? "var(--accent)" : "var(--text-muted)",
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </section>

          {/* ── Setup grid ───────────────────────────────────────── */}
          <section>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 10,
              }}
            >
              Setup
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {filteredSetups.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSetupId(s.id)}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: `1px solid ${setupId === s.id ? "var(--accent)" : "var(--border)"}`,
                    background: setupId === s.id ? "rgba(139,92,246,0.1)" : "var(--bg-card)",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 13,
                      color: setupId === s.id ? "var(--accent)" : "var(--text)",
                      marginBottom: 2,
                    }}
                  >
                    {s.name}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}>
                    {s.description}
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      right: 0,
                      width: 4,
                      bottom: 0,
                      background: s.preview(color.swatch),
                      opacity: 0.7,
                    }}
                  />
                </button>
              ))}
            </div>
          </section>

          {/* ── Output mode ─────────────────────────────────────── */}
          <section>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
              Output
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {([
                { id: "image", label: "📸 Still", hint: "Photoreal image · 1 Aura" },
                { id: "video", label: "🎬 Animated Clip", hint: "3–5 sec loopable · 10 Aura" },
              ] as { id: OutputMode; label: string; hint: string }[]).map((m) => (
                <button
                  key={m.id}
                  onClick={() => setOutputMode(m.id)}
                  title={m.hint}
                  style={{
                    flex: 1,
                    padding: "9px 10px",
                    borderRadius: 10,
                    border: `1px solid ${outputMode === m.id ? "var(--accent)" : "var(--border)"}`,
                    background: outputMode === m.id ? "rgba(139,92,246,0.12)" : "var(--bg-card)",
                    color: outputMode === m.id ? "var(--accent)" : "var(--text-muted)",
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: "pointer",
                    textAlign: "center",
                    transition: "all 0.15s",
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {outputMode === "video" && (
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
                Breathing · head movement · mic interaction — loopable performance clip.
              </p>
            )}
          </section>

          {/* ── Camera mode ──────────────────────────────────────── */}
          <section>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
              Camera
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {([
                { id: "tripod",   label: "Tripod",   icon: "🎥" },
                { id: "push-in",  label: "Push-in",  icon: "🔭" },
                { id: "handheld", label: "Handheld", icon: "📷" },
                { id: "closeup",  label: "Close-up", icon: "🔬" },
              ] as { id: CameraMode; label: string; icon: string }[]).map((cam) => (
                <button
                  key={cam.id}
                  onClick={() => setCameraMode(cam.id)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: `1px solid ${cameraMode === cam.id ? "var(--accent)" : "var(--border)"}`,
                    background: cameraMode === cam.id ? "rgba(139,92,246,0.1)" : "transparent",
                    color: cameraMode === cam.id ? "var(--accent)" : "var(--text-muted)",
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  {cam.icon} {cam.label}
                </button>
              ))}
            </div>
          </section>

          {/* ── Reference photos ─────────────────────────────────── */}
          <section>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 10,
              }}
            >
              Reference photo{" "}
              <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                (up to 2)
              </span>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => addFiles(e.target.files)}
              style={{ display: "none" }}
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {refPreviews.map((p, i) => (
                <div
                  key={i}
                  style={{
                    position: "relative",
                    width: 80,
                    height: 80,
                    borderRadius: 10,
                    overflow: "hidden",
                    border: "1px solid var(--border)",
                  }}
                >
                  <img src={p} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <button
                    onClick={() => removeFile(i)}
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      width: 20,
                      height: 20,
                      borderRadius: 6,
                      background: "rgba(0,0,0,0.7)",
                      border: "none",
                      cursor: "pointer",
                      color: "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 0,
                    }}
                  >
                    <X size={11} />
                  </button>
                  {i === 0 && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: 3,
                        left: 3,
                        fontSize: 10,
                        fontWeight: 700,
                        background: "rgba(0,0,0,0.7)",
                        color: "white",
                        padding: "2px 5px",
                        borderRadius: 4,
                      }}
                    >
                      FACE
                    </div>
                  )}
                  {i === 1 && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: 3,
                        left: 3,
                        fontSize: 10,
                        fontWeight: 700,
                        background: "rgba(0,0,0,0.7)",
                        color: "white",
                        padding: "2px 5px",
                        borderRadius: 4,
                      }}
                    >
                      OUTFIT
                    </div>
                  )}
                </div>
              ))}
              {refFiles.length < 2 && (
                <button
                  onClick={() => fileRef.current?.click()}
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 10,
                    border: "2px dashed var(--border)",
                    background: "var(--bg-card)",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                    color: "var(--text-muted)",
                    transition: "border-color 0.15s",
                  }}
                >
                  <ImagePlus size={20} />
                  <span style={{ fontSize: 11, fontWeight: 600 }}>Add photo</span>
                </button>
              )}
            </div>
            {refFiles.length === 0 && (
              <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
                Photo 1 = face reference. Photo 2 (optional) = outfit lock.
              </p>
            )}
          </section>

          {/* ── Generate button ──────────────────────────────────── */}
          <button
            onClick={generate}
            disabled={!canGenerate}
            style={{
              padding: "14px",
              background: canGenerate
                ? "linear-gradient(135deg, var(--accent), oklch(0.62 0.22 290))"
                : "var(--bg-elevated)",
              border: `1px solid ${canGenerate ? "transparent" : "var(--border)"}`,
              borderRadius: 12,
              color: canGenerate ? "white" : "var(--text-muted)",
              fontWeight: 800,
              fontSize: 16,
              cursor: canGenerate ? "pointer" : "default",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              boxShadow: canGenerate ? "0 0 28px var(--accent-glow)" : "none",
              transition: "all 0.2s",
              letterSpacing: "-0.01em",
            }}
          >
            {generating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            {generating ? "Queuing shot…" : `Generate · ${outputMode === "video" ? COST_VIDEO : COST_IMAGE} Aura`}
          </button>
        </div>

        {/* ── Main panel — preview + gallery ──────────────────────── */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {/* Color preview banner */}
          <div
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "16/6",
              overflow: "hidden",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: setup ? setup.preview(color.swatch) : color.swatch,
                transition: "background 0.4s ease",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 55%, rgba(0,0,0,0.2) 100%)",
              }}
            />
            <div style={{ position: "absolute", top: 14, left: 16 }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 12px",
                  borderRadius: 999,
                  background: "rgba(0,0,0,0.5)",
                  backdropFilter: "blur(8px)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.9)",
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: color.swatch,
                    flexShrink: 0,
                    boxShadow: `0 0 6px ${color.swatch}`,
                  }}
                />
                {color.name} · COLORS Studio
              </div>
            </div>
            <div style={{ position: "absolute", bottom: 0, insetInline: 0, padding: "12px 16px" }}>
              <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 2 }}>
                12 colors · 5 scene types · your face
              </p>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "white", letterSpacing: "-0.01em" }}>
                {color.name} — {setup?.name ?? "seamless cyclorama"}
              </p>
            </div>
          </div>

          <div style={{ padding: "24px" }}>
            {/* Setup description card */}
            <div
              style={{
                marginBottom: 24,
                padding: "16px 20px",
                borderRadius: 14,
                border: "1px solid var(--border)",
                background: "var(--bg-card)",
                display: "flex",
                gap: 16,
                alignItems: "flex-start",
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 12,
                  background: setup ? setup.preview(color.swatch) : color.swatch,
                  flexShrink: 0,
                }}
              />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 3 }}>
                  {color.name} × {setup?.name}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.01em" }}>
                  Ready to shoot
                </div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 3, lineHeight: 1.5 }}>
                  {setup?.description}
                </div>
              </div>
              {refFiles.length > 0 && (
                <div
                  style={{
                    marginLeft: "auto",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#22c55e",
                    flexShrink: 0,
                  }}
                >
                  <Check size={14} /> {refFiles.length} photo{refFiles.length > 1 ? "s" : ""} ready
                </div>
              )}
            </div>

            {/* Gallery header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 800,
                  letterSpacing: "-0.02em",
                  color: "var(--text)",
                }}
              >
                Your shots
              </div>
              <button
                onClick={() => {
                  setLoadingGallery(true);
                  void fetchGallery();
                }}
                style={{
                  padding: "6px 12px",
                  background: "transparent",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 13,
                }}
              >
                <RefreshCw size={13} /> Refresh
              </button>
            </div>

            {loadingGallery ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: 200,
                  color: "var(--text-muted)",
                  gap: 8,
                }}
              >
                <Loader2 size={18} className="animate-spin" /> Loading gallery…
              </div>
            ) : generations.length === 0 ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  height: 240,
                  gap: 12,
                  color: "var(--text-muted)",
                }}
              >
                <Palette size={40} style={{ opacity: 0.3 }} />
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>No shots yet</div>
                <div style={{ fontSize: 14 }}>Upload a reference photo and hit Generate</div>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                  gap: 14,
                }}
              >
                {generations.map((g) => {
                  const mediaUrl = g.result_video_url ?? g.result_image_url;
                  const isVideo = !!g.result_video_url;
                  return (
                    <div
                      key={g.id}
                      style={{
                        borderRadius: 14,
                        overflow: "hidden",
                        border: "1px solid var(--border)",
                        background: "var(--bg-card)",
                        position: "relative",
                      }}
                      className="animate-fade-in"
                    >
                      {mediaUrl ? (
                        <div style={{ position: "relative", aspectRatio: "9/16" }}>
                          {isVideo ? (
                            <video
                              src={mediaUrl}
                              autoPlay
                              loop
                              muted
                              playsInline
                              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                            />
                          ) : (
                            <img
                              src={mediaUrl}
                              alt=""
                              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                            />
                          )}
                          <button
                            onClick={() =>
                              download(
                                mediaUrl,
                                `aurora-colors-${g.id}.${isVideo ? "mp4" : "jpg"}`,
                              )
                            }
                            style={{
                              position: "absolute",
                              bottom: 10,
                              right: 10,
                              padding: "7px 10px",
                              background: "rgba(0,0,0,0.7)",
                              border: "1px solid rgba(255,255,255,0.15)",
                              borderRadius: 8,
                              color: "white",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 5,
                              fontSize: 12,
                              fontWeight: 600,
                              backdropFilter: "blur(4px)",
                            }}
                          >
                            <Download size={12} /> Save
                          </button>
                        </div>
                      ) : (
                        <div
                          style={{
                            aspectRatio: "9/16",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 10,
                            background: "var(--bg)",
                          }}
                        >
                          {g.status === "failed" ? (
                            <>
                              <X size={28} style={{ color: "#ef4444" }} />
                              <div
                                style={{
                                  fontSize: 13,
                                  color: "#ef4444",
                                  textAlign: "center",
                                  padding: "0 12px",
                                }}
                              >
                                {g.error ?? "Render failed"}
                              </div>
                            </>
                          ) : (
                            <>
                              <Loader2
                                size={28}
                                style={{ color: "var(--accent)" }}
                                className="animate-spin"
                              />
                              <div
                                style={{
                                  fontSize: 13,
                                  color: "var(--text-muted)",
                                  textAlign: "center",
                                }}
                              >
                                Rendering…
                              </div>
                            </>
                          )}
                        </div>
                      )}
                      <div
                        style={{
                          padding: "10px 12px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--text-muted)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            flex: 1,
                          }}
                        >
                          {new Date(g.created_at).toLocaleDateString()}
                        </div>
                        <StatusDot status={g.status} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
