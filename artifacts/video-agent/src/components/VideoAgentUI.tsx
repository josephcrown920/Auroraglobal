import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Wand2,
  Video,
  Download,
  Loader2,
  RotateCcw,
  Monitor,
  Smartphone,
  Camera,
  Film,
  LogOut,
  Clock,
  History,
  Play,
  X,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { enhanceScript, submitVideo, getVideoStatus, finalizeVideo } from "@/lib/api";
import { supabase } from "@/lib/supabase";

interface Props { session: Session; }

type JobStatus = "pending" | "processing" | "completed" | "failed";
interface VideoGen {
  id: string;
  prompt: string;
  status: JobStatus;
  result_video_url: string | null;
  created_at: string;
  error: string | null;
}

type Stage = "idle" | "enhancing" | "submitting" | "polling" | "finalizing" | "done" | "error";
type View = "studio" | "history";

const DURATIONS = [10, 15, 20, 30, 45, 60, 90];
const MODES = [
  { id: "direct", label: "Direct-to-camera", icon: Camera, desc: "Intimate, personal delivery — speaks straight to the viewer" },
  { id: "cinematic", label: "Cinematic narration", icon: Film, desc: "Authoritative voiceover with a sense of place and movement" },
] as const;
type ModeId = (typeof MODES)[number]["id"];

const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 25 * 60_000;

function useElapsed(running: boolean) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!running) { setElapsed(0); return; }
    const start = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(t);
  }, [running]);
  return elapsed;
}

function StatusDot({ status }: { status: JobStatus }) {
  const map: Record<JobStatus, { color: string; label: string }> = {
    pending: { color: "#f59e0b", label: "Queued" },
    processing: { color: "oklch(0.72 0.2 300)", label: "Rendering" },
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

export function VideoAgentUI({ session }: Props) {
  const [view, setView] = useState<View>("studio");
  const [idea, setIdea] = useState("");
  const [script, setScript] = useState("");
  const [mode, setMode] = useState<ModeId>("direct");
  const [orientation, setOrientation] = useState<"landscape" | "portrait">("landscape");
  const [targetSeconds, setTargetSeconds] = useState(30);
  const [stage, setStage] = useState<Stage>("idle");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<VideoGen[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef(false);

  const token = session.access_token;
  const email = session.user.email ?? "";
  const busy = stage !== "idle" && stage !== "done" && stage !== "error";
  const polling = stage === "polling";
  const elapsed = useElapsed(polling || stage === "submitting" || stage === "finalizing");

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    const { data, error } = await supabase
      .from("generations")
      .select("id,prompt,status,result_video_url,created_at,error")
      .eq("kind", "video")
      .order("created_at", { ascending: false })
      .limit(30);
    if (!error && data) setHistory(data as VideoGen[]);
    setLoadingHistory(false);
  }, []);

  useEffect(() => {
    if (view === "history") void fetchHistory();
  }, [view, fetchHistory]);

  useEffect(() => {
    const hasActive = history.some(g => g.status === "pending" || g.status === "processing");
    if (hasActive && view === "history") {
      const t = setInterval(() => void fetchHistory(), 5000);
      return () => clearInterval(t);
    }
  }, [history, view, fetchHistory]);

  function stopPoll() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  function resetToIdle() {
    stopPoll();
    abortRef.current = false;
    setStage("idle");
  }

  async function handleEnhance() {
    if (!idea.trim()) { toast.error("Enter an idea or draft first"); return; }
    setStage("enhancing");
    setScript("");
    try {
      const res = await enhanceScript(
        { prompt: idea, targetSeconds, directToCamera: mode === "direct" },
        token,
      );
      setScript(res.script);
      setStage("idle");
      toast.success("Script enhanced");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enhancement failed");
      resetToIdle();
    }
  }

  const handlePoll = useCallback(
    async (videoId: string, url: string, prompt: string, reservationRef: string, cost: number, startedAt: number) => {
      if (abortRef.current) return;
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        stopPoll();
        toast.error("HeyGen is taking too long — the video may still complete. Check back in History.");
        resetToIdle();
        return;
      }
      try {
        const st = await getVideoStatus(videoId, token);
        if (abortRef.current) return;

        if (st.status === "completed" && st.url) {
          stopPoll();
          setStage("finalizing");
          try {
            await finalizeVideo({ videoId, url: st.url, prompt, reservationRef, cost }, token);
          } catch {
            // Non-fatal — video still playable
          }
          setResultUrl(st.url);
          setStage("done");
          toast.success("Video ready!");
        } else if (st.status === "failed") {
          stopPoll();
          toast.error(st.error ?? "HeyGen video generation failed");
          resetToIdle();
        }
      } catch {
        // Network hiccup — keep polling
      }
    },
    [token],
  );

  async function handleGenerate() {
    const final = script.trim() || idea.trim();
    if (!final) { toast.error("Write or enhance a script first"); return; }
    abortRef.current = false;
    setStage("submitting");
    setResultUrl(null);

    try {
      const res = await submitVideo({ prompt: final, orientation }, token);
      if (!res.ok || !res.videoId) {
        if (res.heygenCredit) {
          toast.error("HeyGen API credits exhausted — top up at app.heygen.com");
        } else if (res.insufficient) {
          toast.error("Insufficient Aura credits — top up in Aurora");
        } else {
          toast.error(res.error ?? "Submit failed");
        }
        resetToIdle();
        return;
      }

      const { videoId, reservationRef, cost } = res;
      toast.success("Submitted to HeyGen — rendering…");
      setStage("polling");
      const startedAt = Date.now();

      void handlePoll(videoId, res.videoId, final, reservationRef!, cost!, startedAt);
      pollRef.current = setInterval(
        () => void handlePoll(videoId, res.videoId!, final, reservationRef!, cost!, startedAt),
        POLL_INTERVAL_MS,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
      resetToIdle();
    }
  }

  function handleReset() {
    abortRef.current = true;
    stopPoll();
    setIdea(""); setScript(""); setResultUrl(null); setStage("idle");
  }

  const activeScript = script || idea;

  const stageLabel: Record<Stage, string> = {
    idle: "",
    enhancing: "Enhancing…",
    submitting: "Reserving credits & submitting…",
    polling: `Rendering on HeyGen · ${elapsed}s`,
    finalizing: "Saving to gallery…",
    done: "",
    error: "",
  };

  const activeRenderCount = history.filter(g => g.status === "pending" || g.status === "processing").length;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative", zIndex: 1 }}>
      {/* Header */}
      <header style={{
        borderBottom: "1px solid var(--border)",
        padding: "0 24px",
        height: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "oklch(0.085 0.022 272 / 0.9)",
        backdropFilter: "blur(12px)",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: "oklch(0.72 0.2 300 / 0.15)",
            border: "1px solid oklch(0.72 0.2 300 / 0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Video size={16} color="oklch(0.72 0.2 300)" />
          </div>
          <span style={{ fontWeight: 700, fontSize: 16, color: "var(--text)", letterSpacing: "-0.02em" }}>
            Aurora <span style={{ color: "var(--accent)" }}>Video Agent</span>
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {busy && stageLabel[stage] && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--accent)" }}>
              <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
              {stageLabel[stage]}
            </div>
          )}
          {/* Tab buttons */}
          {(["studio", "history"] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "6px 13px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                border: `1px solid ${view === v ? "var(--accent)" : "var(--border)"}`,
                background: view === v ? "oklch(0.72 0.2 300 / 0.12)" : "transparent",
                color: view === v ? "var(--accent)" : "var(--text-muted)",
                cursor: "pointer", textTransform: "capitalize",
              }}
            >
              {v === "history"
                ? <><History size={13} /> History{activeRenderCount > 0 ? ` · ${activeRenderCount}` : ""}</>
                : <><Video size={13} /> Studio</>
              }
            </button>
          ))}
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{email}</span>
          <button
            onClick={() => supabase.auth.signOut()}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 12px", borderRadius: 8,
              background: "transparent", border: "1px solid var(--border)",
              color: "var(--text-muted)", cursor: "pointer", fontSize: 12,
            }}
          >
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </header>

      {view === "studio" ? (
        <>
          {/* Photo strip */}
          <div style={{
            borderBottom: "1px solid var(--border)",
            padding: "12px 24px",
            display: "flex",
            alignItems: "center",
            gap: 14,
            background: "oklch(0.085 0.022 272 / 0.5)",
          }}>
            <img
              src="/video-agent/demo-cinematic.webp"
              alt=""
              style={{ height: 52, width: 92, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)", flexShrink: 0 }}
            />
            <img
              src="/video-agent/demo-variations.jpg"
              alt=""
              style={{ height: 52, width: 148, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)", flexShrink: 0 }}
            />
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>
                HeyGen avatar · your script, your face, any scene
              </p>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Write or paste an idea → AI enhances it → video generated in ~60–120s
              </p>
            </div>
          </div>

          {/* Main content */}
          <main style={{ flex: 1, padding: "32px 24px", maxWidth: 760, margin: "0 auto", width: "100%" }}>
            {/* Step 1 — Idea / Script */}
            <Section num={1} label="Write your script">
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <textarea
                  value={script || idea}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (script) setScript(val); else setIdea(val);
                  }}
                  placeholder="Paste your raw idea, rough notes, or draft script here — the AI will shape it into polished spoken words your avatar will deliver on camera…"
                  rows={7}
                  disabled={busy}
                  style={{
                    width: "100%", background: "var(--bg-input)",
                    border: "1px solid var(--border)", borderRadius: 12,
                    padding: "14px 16px", color: "var(--text)", fontSize: 14,
                    resize: "vertical", outline: "none", lineHeight: 1.6,
                    transition: "border-color 0.15s",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
                />

                {/* Mode + Duration row */}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {MODES.map((m) => {
                    const Icon = m.icon;
                    const active = mode === m.id;
                    return (
                      <button
                        key={m.id}
                        onClick={() => setMode(m.id)}
                        disabled={busy}
                        title={m.desc}
                        style={{
                          display: "flex", alignItems: "center", gap: 6,
                          padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 500,
                          border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                          background: active ? "oklch(0.72 0.2 300 / 0.12)" : "transparent",
                          color: active ? "var(--accent)" : "var(--text-muted)",
                          cursor: "pointer", transition: "all 0.15s",
                        }}
                      >
                        <Icon size={14} /> {m.label}
                      </button>
                    );
                  })}
                  <select
                    value={targetSeconds}
                    onChange={(e) => setTargetSeconds(Number(e.target.value))}
                    disabled={busy}
                    style={{
                      marginLeft: "auto",
                      padding: "7px 12px", borderRadius: 8, fontSize: 13,
                      background: "var(--bg-input)", border: "1px solid var(--border)",
                      color: "var(--text-muted)", cursor: "pointer", outline: "none",
                    }}
                  >
                    {DURATIONS.map((d) => <option key={d} value={d}>{d}s</option>)}
                  </select>
                </div>

                <button
                  onClick={handleEnhance}
                  disabled={busy || !idea.trim()}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    padding: "11px 20px", borderRadius: 12, fontWeight: 600, fontSize: 14,
                    background: "oklch(0.72 0.2 300 / 0.15)",
                    border: "1px solid oklch(0.72 0.2 300 / 0.35)",
                    color: "var(--accent)", cursor: busy || !idea.trim() ? "not-allowed" : "pointer",
                    opacity: busy || !idea.trim() ? 0.5 : 1,
                    transition: "all 0.15s",
                  }}
                >
                  {stage === "enhancing"
                    ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Enhancing…</>
                    : <><Wand2 size={15} /> Enhance with AI</>
                  }
                </button>
              </div>
            </Section>

            {/* Step 2 — Generate */}
            <Section num={2} label="Generate video">
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Orientation picker */}
                <div style={{ display: "flex", gap: 10 }}>
                  {(["landscape", "portrait"] as const).map((o) => {
                    const Icon = o === "landscape" ? Monitor : Smartphone;
                    const active = orientation === o;
                    return (
                      <button
                        key={o}
                        onClick={() => setOrientation(o)}
                        disabled={busy}
                        style={{
                          display: "flex", alignItems: "center", gap: 6,
                          padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500,
                          border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                          background: active ? "oklch(0.72 0.2 300 / 0.12)" : "transparent",
                          color: active ? "var(--accent)" : "var(--text-muted)",
                          cursor: "pointer", textTransform: "capitalize",
                        }}
                      >
                        <Icon size={14} /> {o}
                      </button>
                    );
                  })}
                </div>

                {/* Script preview */}
                {activeScript && (
                  <div style={{
                    background: "var(--bg-input)", border: "1px solid var(--border)",
                    borderRadius: 10, padding: "12px 14px",
                  }}>
                    <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6, fontWeight: 500 }}>
                      Script preview
                    </p>
                    <p style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
                      {activeScript.slice(0, 300)}{activeScript.length > 300 ? "…" : ""}
                    </p>
                  </div>
                )}

                <button
                  onClick={handleGenerate}
                  disabled={busy || !activeScript.trim()}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    padding: "13px 24px", borderRadius: 12, fontWeight: 700, fontSize: 15,
                    background: busy || !activeScript.trim() ? "oklch(0.3 0.02 272)" : "var(--accent)",
                    border: "none", color: "#fff",
                    cursor: busy || !activeScript.trim() ? "not-allowed" : "pointer",
                    transition: "all 0.15s",
                    boxShadow: !busy && activeScript.trim() ? "0 0 24px oklch(0.72 0.2 300 / 0.35)" : "none",
                  }}
                >
                  {stage === "submitting"
                    ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Submitting…</>
                    : stage === "polling"
                      ? <><Clock size={16} /> Rendering on HeyGen · {elapsed}s elapsed</>
                      : stage === "finalizing"
                        ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Saving…</>
                        : <><Video size={16} /> Generate HeyGen Video</>
                  }
                </button>

                {stage === "polling" && (
                  <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.5 }}>
                    Polling HeyGen every 5s. Videos typically take 60–120s.{" "}
                    <button
                      onClick={resetToIdle}
                      style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 12, padding: 0 }}
                    >
                      Cancel
                    </button>
                  </p>
                )}
              </div>
            </Section>

            {/* Result */}
            {resultUrl && (
              <Section num={3} label="Your video">
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{
                    borderRadius: 14, overflow: "hidden",
                    border: "1px solid var(--border)",
                    background: "#000",
                    aspectRatio: orientation === "landscape" ? "16/9" : "9/16",
                    maxWidth: orientation === "portrait" ? 300 : "100%",
                    margin: "0 auto",
                  }}>
                    <video
                      ref={videoRef}
                      src={resultUrl}
                      controls
                      autoPlay
                      playsInline
                      style={{ width: "100%", height: "100%", display: "block" }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                    <button
                      onClick={() => {
                        fetch(resultUrl)
                          .then(r => r.blob())
                          .then(blob => {
                            const a = document.createElement("a");
                            a.href = URL.createObjectURL(blob);
                            a.download = "aurora-video-agent.mp4";
                            a.click();
                          })
                          .catch(() => window.open(resultUrl, "_blank"));
                      }}
                      style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                        background: "var(--bg-input)", border: "1px solid var(--border)",
                        color: "var(--text)", cursor: "pointer",
                      }}
                    >
                      <Download size={14} /> Download
                    </button>
                    <button
                      onClick={() => { handleReset(); setView("history"); void fetchHistory(); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                        background: "transparent", border: "1px solid var(--border)",
                        color: "var(--text-muted)", cursor: "pointer",
                      }}
                    >
                      <History size={14} /> View in History
                    </button>
                    <button
                      onClick={handleReset}
                      style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                        background: "transparent", border: "1px solid var(--border)",
                        color: "var(--text-muted)", cursor: "pointer",
                      }}
                    >
                      <RotateCcw size={14} /> Make another
                    </button>
                  </div>
                </div>
              </Section>
            )}
          </main>
        </>
      ) : (
        /* History view */
        <div style={{ flex: 1, maxWidth: 1000, margin: "0 auto", width: "100%", padding: "28px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text)" }}>
              Video history
            </div>
            <button
              onClick={() => { setLoadingHistory(true); void fetchHistory(); }}
              style={{
                padding: "7px 14px", background: "transparent", border: "1px solid var(--border)",
                borderRadius: 8, color: "var(--text-muted)", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6, fontSize: 13,
              }}
            >
              <RotateCcw size={13} /> Refresh
            </button>
          </div>

          {loadingHistory ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "var(--text-muted)", gap: 8 }}>
              <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> Loading…
            </div>
          ) : history.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 300, gap: 12, color: "var(--text-muted)" }}>
              <Video size={48} style={{ opacity: 0.3 }} />
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>No videos yet</div>
              <p style={{ fontSize: 14, color: "var(--text-muted)", textAlign: "center", margin: 0 }}>
                Generate your first HeyGen video in Studio
              </p>
              <button
                onClick={() => setView("studio")}
                style={{
                  padding: "10px 22px", background: "var(--accent)", border: "none",
                  borderRadius: 10, color: "white", fontWeight: 700, fontSize: 15, cursor: "pointer",
                  boxShadow: "0 0 20px oklch(0.72 0.2 300 / 0.35)",
                }}
              >
                Go to Studio
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
              {history.map(g => (
                <div
                  key={g.id}
                  style={{
                    borderRadius: 16, overflow: "hidden",
                    border: "1px solid var(--border)",
                    background: "var(--bg-card)",
                  }}
                >
                  {g.result_video_url ? (
                    <div style={{ position: "relative", aspectRatio: "16/9", background: "#000" }}>
                      <video
                        src={g.result_video_url}
                        controls
                        playsInline
                        style={{ width: "100%", height: "100%", display: "block" }}
                      />
                      <button
                        onClick={() => {
                          fetch(g.result_video_url!)
                            .then(r => r.blob())
                            .then(blob => {
                              const a = document.createElement("a");
                              a.href = URL.createObjectURL(blob);
                              a.download = `aurora-video-${g.id}.mp4`;
                              a.click();
                            })
                            .catch(() => window.open(g.result_video_url!, "_blank"));
                        }}
                        style={{
                          position: "absolute", bottom: 10, right: 10,
                          padding: "6px 10px",
                          background: "rgba(0,0,0,0.7)", border: "1px solid rgba(255,255,255,0.15)",
                          borderRadius: 8, color: "white", cursor: "pointer",
                          display: "flex", alignItems: "center", gap: 5,
                          fontSize: 12, fontWeight: 600, backdropFilter: "blur(4px)",
                        }}
                      >
                        <Download size={11} /> Save
                      </button>
                    </div>
                  ) : (
                    <div style={{
                      aspectRatio: "16/9", display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center", gap: 10,
                      background: "var(--bg)",
                    }}>
                      {g.status === "failed" ? (
                        <>
                          <X size={28} style={{ color: "#ef4444" }} />
                          <div style={{ fontSize: 13, color: "#ef4444", textAlign: "center", padding: "0 16px" }}>
                            {g.error ?? "Render failed"}
                          </div>
                        </>
                      ) : (
                        <>
                          <Loader2 size={28} style={{ color: "var(--accent)", animation: "spin 1s linear infinite" }} />
                          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                            {g.status === "pending" ? "Queued…" : "Rendering on HeyGen…"}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  <div style={{ padding: "12px 14px" }}>
                    <p style={{
                      fontSize: 13, color: "var(--text)", lineHeight: 1.5,
                      margin: "0 0 8px",
                      overflow: "hidden", display: "-webkit-box",
                      WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                    }}>
                      {g.prompt}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {new Date(g.created_at).toLocaleDateString()}
                      </span>
                      <StatusDot status={g.status} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
    </div>
  );
}

function Section({ num, label, children }: { num: number; label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <span style={{
          width: 26, height: 26, borderRadius: "50%",
          background: "oklch(0.72 0.2 300 / 0.15)",
          border: "1px solid oklch(0.72 0.2 300 / 0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 700, color: "var(--accent)", flexShrink: 0,
        }}>
          {num}
        </span>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", letterSpacing: "-0.01em" }}>
          {label}
        </h2>
      </div>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "20px" }}>
        {children}
      </div>
    </div>
  );
}
