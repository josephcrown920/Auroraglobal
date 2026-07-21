import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Film, Video, Download, Loader2, RotateCcw, LogOut,
  History, X, Clock, Trash2, ArrowRight, Play,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import {
  enhanceScript, submitVideo, getVideoStatus,
  finalizeVideo, getMessages, clearMessages,
} from "@/lib/api";
import type { ChatMessage } from "@/lib/api";
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

const DURATIONS = [10, 15, 20, 30, 45, 60, 90];
const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 10 * 60_000;
const STALE_JOB_MS = 20 * 60_000;

const STARTER_PROMPTS = [
  "A 30-second bold brand intro — urban cinematic, no voice, just vibe",
  "A 15-second direct-to-camera hook about resilience and coming up",
  "Announce a new drop — short, punchy, like a Netflix opener",
  "Open a music video teaser. Dark, moody. 20 seconds.",
];

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
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, color, letterSpacing: "0.04em", textTransform: "uppercase" as const }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
      {label}
    </span>
  );
}

export function VideoAgentUI({ session }: Props) {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [loadingChat, setLoadingChat] = useState(false);
  const [script, setScript] = useState("");
  const [mode, setMode] = useState<"direct" | "cinematic">("direct");
  const [orientation, setOrientation] = useState<"landscape" | "portrait">("landscape");
  const [targetSeconds, setTargetSeconds] = useState(30);
  const [stage, setStage] = useState<Stage>("idle");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<VideoGen[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
    setLoadingChat(true);
    getMessages(token)
      .then(msgs => setChatMessages(msgs))
      .catch(() => {})
      .finally(() => setLoadingChat(false));
  }, [token]);

  useEffect(() => {
    const el = chatScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatMessages, stage]);

  useEffect(() => {
    if (!showHistory) return;
    void fetchHistory();
  }, [showHistory, fetchHistory]);

  useEffect(() => {
    if (!showHistory) return;
    const hasActive = history.some(
      g => (g.status === "pending" || g.status === "processing") &&
        Date.now() - new Date(g.created_at).getTime() < STALE_JOB_MS,
    );
    if (!hasActive) return;
    const t = setInterval(() => void fetchHistory(), 5000);
    return () => clearInterval(t);
  }, [history, showHistory, fetchHistory]);

  function stopPoll() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  function resetToIdle() {
    stopPoll();
    abortRef.current = false;
    setStage("idle");
  }

  async function handleEnhance(text?: string) {
    const idea = (text ?? chatInput).trim();
    if (!idea) { toast.error("Describe your idea first"); return; }
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: idea,
      created_at: new Date().toISOString(),
    };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setStage("enhancing");
    setScript("");
    try {
      const res = await enhanceScript(
        { prompt: idea, targetSeconds, directToCamera: mode === "direct" },
        token,
      );
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: res.script,
        created_at: new Date().toISOString(),
      };
      setChatMessages(prev => [...prev, assistantMsg]);
      setScript(res.script);
      setStage("idle");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enhancement failed");
      resetToIdle();
    }
  }

  async function handleClearChat() {
    try {
      await clearMessages(token);
      setChatMessages([]);
      setScript("");
      setChatInput("");
      toast.success("Conversation cleared");
    } catch {
      toast.error("Failed to clear conversation");
    }
  }

  const handlePoll = useCallback(
    async (
      videoId: string,
      resultVideoId: string,
      prompt: string,
      reservationRef: string,
      cost: number,
      startedAt: number,
    ) => {
      if (abortRef.current) return;
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        stopPoll();
        toast.error("Still rendering — check back in History.");
        resetToIdle();
        return;
      }
      try {
        const st = await getVideoStatus(videoId, token);
        if (abortRef.current) return;
        if (st.status === "completed" && st.url) {
          stopPoll();
          setStage("finalizing");
          try { await finalizeVideo({ videoId, url: st.url, prompt, reservationRef, cost }, token); } catch { /* non-fatal */ }
          setResultUrl(st.url);
          setStage("done");
          toast.success("Video ready!");
        } else if (st.status === "failed") {
          stopPoll();
          toast.error(st.error ?? "HeyGen render failed");
          resetToIdle();
        }
      } catch { /* network hiccup — keep polling */ }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token],
  );

  async function handleGenerate(useScript?: string) {
    const final = (useScript ?? script).trim();
    if (!final) { toast.error("Write or enhance a script first"); return; }
    abortRef.current = false;
    setStage("submitting");
    setResultUrl(null);
    try {
      const res = await submitVideo({ prompt: final, orientation }, token);
      if (!res.ok || !res.videoId) {
        if (res.heygenCredit) toast.error("HeyGen API credits exhausted — top up at app.heygen.com");
        else if (res.insufficient) toast.error("Insufficient Aura credits — top up in Aurora");
        else toast.error(res.error ?? "Submit failed");
        resetToIdle();
        return;
      }
      const { videoId, reservationRef, cost } = res;
      toast.success("Submitted — HeyGen is rendering…");
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
    setChatInput("");
    setScript("");
    setResultUrl(null);
    setStage("idle");
  }

  const stageLabel: Record<Stage, string> = {
    idle: "",
    enhancing: "Crafting your script…",
    submitting: "Submitting to HeyGen…",
    polling: `Rendering · ${elapsed}s`,
    finalizing: "Saving…",
    done: "",
    error: "",
  };

  const activeRenderCount = history.filter(
    g => g.status === "pending" || g.status === "processing",
  ).length;

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header style={{
        height: 52, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 16px",
        borderBottom: "1px solid var(--border)",
        background: "oklch(0.085 0.022 272 / 0.96)",
        backdropFilter: "blur(12px)",
        position: "relative", zIndex: 20,
        gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
            background: "oklch(0.72 0.2 300 / 0.12)",
            border: "1px solid oklch(0.72 0.2 300 / 0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Film size={13} color="oklch(0.72 0.2 300)" />
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text)", flexShrink: 0 }}>
            Video Director
          </span>
          {busy && stageLabel[stage] && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--accent)", minWidth: 0 }}>
              <Loader2 size={11} style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{stageLabel[stage]}</span>
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <button
            onClick={() => setShowHistory(h => !h)}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "5px 11px", borderRadius: 7, fontSize: 12, fontWeight: 600,
              border: `1px solid ${showHistory ? "var(--accent)" : "var(--border)"}`,
              background: showHistory ? "oklch(0.72 0.2 300 / 0.1)" : "transparent",
              color: showHistory ? "var(--accent)" : "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            <History size={12} />
            History
            {activeRenderCount > 0 && (
              <span style={{
                fontSize: 9, fontWeight: 800, background: "var(--accent)", color: "white",
                borderRadius: 4, padding: "1px 5px",
              }}>{activeRenderCount}</span>
            )}
          </button>
          {chatMessages.length > 0 && (
            <button
              onClick={() => void handleClearChat()}
              disabled={busy}
              title="Clear conversation"
              style={{
                display: "flex", alignItems: "center", gap: 4,
                padding: "5px 10px", borderRadius: 7, fontSize: 12,
                background: "transparent", border: "1px solid var(--border)",
                color: "var(--text-muted)", cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              <Trash2 size={12} />
            </button>
          )}
          <span style={{ fontSize: 11, color: "var(--text-muted)", opacity: 0.55, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</span>
          <button
            onClick={() => supabase.auth.signOut()}
            style={{
              display: "flex", alignItems: "center", gap: 4,
              padding: "5px 10px", borderRadius: 7, fontSize: 11,
              background: "transparent", border: "1px solid var(--border)",
              color: "var(--text-muted)", cursor: "pointer",
            }}
          >
            <LogOut size={11} /> Out
          </button>
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Chat column */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

          {/* Messages scroll area */}
          <div
            ref={chatScrollRef}
            style={{
              flex: 1, overflowY: "auto", padding: "24px 20px 8px",
              display: "flex", flexDirection: "column", gap: 14,
              scrollbarWidth: "thin",
            }}
          >
            {/* Empty state */}
            {!loadingChat && chatMessages.length === 0 && stage === "idle" && (
              <div style={{
                flex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                paddingBottom: 60, minHeight: 320,
              }}>
                <div style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 14,
                    background: "oklch(0.72 0.2 300 / 0.08)",
                    border: "1px solid oklch(0.72 0.2 300 / 0.18)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 20px",
                  }}>
                    <Film size={22} color="oklch(0.72 0.2 300)" />
                  </div>
                  <p style={{
                    fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em",
                    color: "var(--text)", margin: "0 0 10px",
                  }}>
                    What are we shooting?
                  </p>
                  <p style={{
                    fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7,
                    margin: "0 0 28px",
                  }}>
                    Tell me the idea, the mood, the vibe. One line or ten.<br />
                    I'll shape it into a script and produce the video.
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 7, textAlign: "left" }}>
                    {STARTER_PROMPTS.map((p, i) => (
                      <button
                        key={i}
                        onClick={() => { setChatInput(p); inputRef.current?.focus(); }}
                        style={{
                          padding: "11px 16px", borderRadius: 10, textAlign: "left",
                          background: "var(--bg-card)", border: "1px solid var(--border)",
                          color: "var(--text-muted)", fontSize: 13, cursor: "pointer",
                          lineHeight: 1.5, transition: "border-color 0.15s, color 0.15s",
                          fontFamily: "inherit",
                        }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLElement).style.borderColor = "oklch(0.72 0.2 300 / 0.4)";
                          (e.currentTarget as HTMLElement).style.color = "var(--text)";
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                          (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
                        }}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {loadingChat && (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                paddingTop: 60, color: "var(--text-muted)", gap: 8,
              }}>
                <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                <span style={{ fontSize: 13 }}>Loading conversation…</span>
              </div>
            )}

            {/* Message bubbles */}
            {chatMessages.map((m, idx) => (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div style={{
                  maxWidth: m.role === "user" ? "68%" : "80%",
                  background: m.role === "user"
                    ? "oklch(0.72 0.2 300 / 0.11)"
                    : "var(--bg-card)",
                  border: `1px solid ${m.role === "user"
                    ? "oklch(0.72 0.2 300 / 0.22)"
                    : "var(--border)"}`,
                  borderRadius: m.role === "user"
                    ? "16px 16px 4px 16px"
                    : "16px 16px 16px 4px",
                  padding: "12px 16px",
                }}>
                  {m.role === "assistant" && (
                    <div style={{
                      fontSize: 10, fontWeight: 800, letterSpacing: "0.12em",
                      textTransform: "uppercase" as const,
                      color: "var(--accent)", marginBottom: 8,
                    }}>
                      Director
                    </div>
                  )}
                  <p style={{
                    fontSize: 14, color: "var(--text)", margin: 0,
                    lineHeight: 1.72, whiteSpace: "pre-wrap",
                  }}>
                    {m.content}
                  </p>
                  {m.role === "assistant" && (
                    <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        onClick={() => { setScript(m.content); void handleGenerate(m.content); }}
                        disabled={busy}
                        style={{
                          display: "flex", alignItems: "center", gap: 6,
                          padding: "8px 16px", borderRadius: 9, fontSize: 13, fontWeight: 700,
                          background: busy ? "oklch(0.18 0.01 272)" : "oklch(0.72 0.2 300)",
                          border: "none",
                          color: busy ? "var(--text-muted)" : "white",
                          cursor: busy ? "not-allowed" : "pointer",
                          boxShadow: busy ? "none" : "0 0 18px oklch(0.72 0.2 300 / 0.38)",
                          transition: "all 0.15s",
                        }}
                      >
                        {busy && idx === chatMessages.length - 1 ? (
                          <><Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> {stageLabel[stage]}</>
                        ) : (
                          <><Play size={12} /> Produce Video</>
                        )}
                      </button>
                      <button
                        onClick={() => { setScript(m.content); toast.success("Script loaded — revise and re-send, or hit Produce Video"); }}
                        style={{
                          display: "flex", alignItems: "center", gap: 5,
                          padding: "8px 14px", borderRadius: 9, fontSize: 12, fontWeight: 600,
                          background: "transparent", border: "1px solid var(--border)",
                          color: "var(--text-muted)", cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        Revise
                      </button>
                    </div>
                  )}
                  <div style={{
                    fontSize: 10, color: "var(--text-muted)", opacity: 0.38,
                    marginTop: 6, textAlign: m.role === "user" ? "right" : "left",
                  }}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {stage === "enhancing" && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div style={{
                  background: "var(--bg-card)", border: "1px solid var(--border)",
                  borderRadius: "16px 16px 16px 4px",
                  padding: "12px 16px",
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    {[0, 1, 2].map(i => (
                      <span key={i} style={{
                        width: 6, height: 6, borderRadius: "50%",
                        background: "var(--accent)", display: "block",
                        animation: `dotPulse 1.3s ${i * 0.2}s ease-in-out infinite`,
                      }} />
                    ))}
                  </div>
                  <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Writing your script…</span>
                </div>
              </div>
            )}

            {/* Generation in-progress bubble */}
            {(stage === "submitting" || stage === "polling" || stage === "finalizing") && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div style={{
                  background: "var(--bg-card)",
                  border: "1px solid oklch(0.72 0.2 300 / 0.18)",
                  borderRadius: "16px 16px 16px 4px",
                  padding: "13px 16px",
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  <Loader2 size={14} style={{ animation: "spin 1s linear infinite", color: "var(--accent)", flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "var(--accent)", marginBottom: 2 }}>
                      Director
                    </div>
                    <span style={{ fontSize: 13, color: "var(--text)" }}>{stageLabel[stage]}</span>
                  </div>
                  <button
                    onClick={handleReset}
                    style={{
                      marginLeft: 4,
                      display: "flex", alignItems: "center", gap: 4,
                      padding: "4px 9px", borderRadius: 6, fontSize: 11,
                      background: "transparent", border: "1px solid var(--border)",
                      color: "var(--text-muted)", cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    <X size={10} /> Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Result card */}
            {stage === "done" && resultUrl && (
              <div style={{ display: "flex", justifyContent: "flex-start", maxWidth: "100%" }}>
                <div style={{
                  width: "100%", maxWidth: 540,
                  background: "var(--bg-card)",
                  border: "1px solid oklch(0.22 0.2 145 / 0.5)",
                  borderRadius: 16, overflow: "hidden",
                  boxShadow: "0 0 32px oklch(0.52 0.18 145 / 0.12)",
                }}>
                  <div style={{
                    padding: "9px 14px", borderBottom: "1px solid var(--border)",
                    display: "flex", alignItems: "center", gap: 7,
                  }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 7px #22c55e", display: "inline-block" }} />
                    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "#22c55e" }}>
                      Video Ready
                    </span>
                  </div>
                  <video
                    ref={videoRef}
                    src={resultUrl}
                    controls
                    playsInline
                    autoPlay
                    style={{ width: "100%", display: "block", background: "#000" }}
                  />
                  <div style={{ padding: "12px 14px", display: "flex", gap: 8 }}>
                    <button
                      onClick={() => {
                        fetch(resultUrl)
                          .then(r => r.blob())
                          .then(blob => {
                            const a = document.createElement("a");
                            a.href = URL.createObjectURL(blob);
                            a.download = `aurora-video-${Date.now()}.mp4`;
                            a.click();
                          })
                          .catch(() => window.open(resultUrl, "_blank"));
                      }}
                      style={{
                        flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        padding: "9px 16px", borderRadius: 9, fontSize: 13, fontWeight: 700,
                        background: "oklch(0.72 0.2 300)", border: "none",
                        color: "white", cursor: "pointer",
                        boxShadow: "0 0 16px oklch(0.72 0.2 300 / 0.35)",
                        fontFamily: "inherit",
                      }}
                    >
                      <Download size={13} /> Download
                    </button>
                    <button
                      onClick={handleReset}
                      style={{
                        flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        padding: "9px 16px", borderRadius: 9, fontSize: 13, fontWeight: 600,
                        background: "transparent", border: "1px solid var(--border)",
                        color: "var(--text-muted)", cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      <RotateCcw size={13} /> Make another
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Input bar ─────────────────────────────────────────────────── */}
          <div style={{
            flexShrink: 0,
            padding: "10px 16px 14px",
            borderTop: "1px solid var(--border)",
            background: "oklch(0.085 0.022 272 / 0.97)",
            backdropFilter: "blur(14px)",
          }}>
            {/* Controls row */}
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
              {(["direct", "cinematic"] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  disabled={busy}
                  style={{
                    padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                    border: `1px solid ${mode === m ? "var(--accent)" : "var(--border)"}`,
                    background: mode === m ? "oklch(0.72 0.2 300 / 0.1)" : "transparent",
                    color: mode === m ? "var(--accent)" : "var(--text-muted)",
                    cursor: busy ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {m === "direct" ? "Direct-to-cam" : "Cinematic"}
                </button>
              ))}
              <select
                value={targetSeconds}
                onChange={e => setTargetSeconds(Number(e.target.value))}
                disabled={busy}
                style={{
                  padding: "4px 8px", borderRadius: 6, fontSize: 12,
                  background: "var(--bg-input)", border: "1px solid var(--border)",
                  color: "var(--text-muted)", cursor: busy ? "not-allowed" : "pointer",
                  outline: "none", fontFamily: "inherit",
                }}
              >
                {DURATIONS.map(d => <option key={d} value={d}>{d}s</option>)}
              </select>
              <button
                onClick={() => setOrientation(o => o === "landscape" ? "portrait" : "landscape")}
                disabled={busy}
                style={{
                  padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                  border: "1px solid var(--border)", background: "transparent",
                  color: "var(--text-muted)", cursor: busy ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                }}
              >
                {orientation === "landscape" ? "16:9" : "9:16"}
              </button>
            </div>

            {/* Textarea + send */}
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <textarea
                ref={inputRef}
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey && !busy && chatInput.trim()) {
                    e.preventDefault();
                    void handleEnhance();
                  }
                }}
                placeholder="Describe the scene, the vibe, the direction… (Enter to send)"
                rows={2}
                disabled={busy}
                style={{
                  flex: 1, background: "var(--bg-input)",
                  border: "1px solid var(--border)", borderRadius: 12,
                  padding: "11px 14px", color: "var(--text)", fontSize: 14,
                  resize: "none", outline: "none", lineHeight: 1.55,
                  fontFamily: "inherit", transition: "border-color 0.15s",
                }}
                onFocus={e => (e.target.style.borderColor = "oklch(0.72 0.2 300 / 0.55)")}
                onBlur={e => (e.target.style.borderColor = "var(--border)")}
              />
              <button
                onClick={() => void handleEnhance()}
                disabled={busy || !chatInput.trim()}
                style={{
                  width: 44, height: 44, flexShrink: 0, borderRadius: 11,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: busy || !chatInput.trim()
                    ? "oklch(0.13 0.015 272)"
                    : "oklch(0.72 0.2 300)",
                  border: `1px solid ${busy || !chatInput.trim() ? "var(--border)" : "oklch(0.72 0.2 300)"}`,
                  cursor: busy || !chatInput.trim() ? "not-allowed" : "pointer",
                  boxShadow: busy || !chatInput.trim() ? "none" : "0 0 16px oklch(0.72 0.2 300 / 0.4)",
                  transition: "all 0.15s",
                }}
              >
                {busy ? (
                  <Loader2 size={16} color="oklch(0.72 0.2 300 / 0.5)" style={{ animation: "spin 1s linear infinite" }} />
                ) : (
                  <ArrowRight size={16} color={chatInput.trim() ? "white" : "oklch(0.3 0.02 272)"} />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ── History side panel ──────────────────────────────────────────── */}
        {showHistory && (
          <div style={{
            width: 320, flexShrink: 0,
            borderLeft: "1px solid var(--border)",
            background: "var(--bg-card)",
            display: "flex", flexDirection: "column", overflow: "hidden",
          }}>
            <div style={{
              padding: "13px 14px", borderBottom: "1px solid var(--border)",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Video History</span>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => void fetchHistory()}
                  style={{
                    display: "flex", alignItems: "center", gap: 4,
                    padding: "4px 8px", borderRadius: 6, fontSize: 11,
                    background: "transparent", border: "1px solid var(--border)",
                    color: "var(--text-muted)", cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  <RotateCcw size={10} />
                </button>
                <button
                  onClick={() => setShowHistory(false)}
                  style={{
                    width: 26, height: 26, borderRadius: 6,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: "transparent", border: "1px solid var(--border)",
                    color: "var(--text-muted)", cursor: "pointer",
                  }}
                >
                  <X size={12} />
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "10px" }}>
              {loadingHistory ? (
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  height: 120, gap: 8, color: "var(--text-muted)",
                }}>
                  <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                  <span style={{ fontSize: 13 }}>Loading…</span>
                </div>
              ) : history.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 16px" }}>
                  <Video size={30} style={{ opacity: 0.15, display: "block", margin: "0 auto 12px", color: "var(--text-muted)" }} />
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>No videos yet</div>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, lineHeight: 1.6 }}>
                    Generate your first video to see it here.
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {history.map(g => (
                    <div key={g.id} style={{
                      borderRadius: 12, overflow: "hidden",
                      border: "1px solid var(--border)", background: "var(--bg)",
                    }}>
                      {g.result_video_url ? (
                        <div style={{ position: "relative" }}>
                          <video
                            src={g.result_video_url}
                            controls
                            playsInline
                            style={{ width: "100%", display: "block", background: "#000", maxHeight: 160 }}
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
                              position: "absolute", bottom: 7, right: 7,
                              padding: "4px 9px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                              background: "rgba(0,0,0,0.75)", border: "1px solid rgba(255,255,255,0.12)",
                              color: "white", cursor: "pointer",
                              display: "flex", alignItems: "center", gap: 4,
                              backdropFilter: "blur(4px)", fontFamily: "inherit",
                            }}
                          >
                            <Download size={10} /> Save
                          </button>
                        </div>
                      ) : (
                        <div style={{
                          height: 80, display: "flex", flexDirection: "column",
                          alignItems: "center", justifyContent: "center", gap: 5,
                          background: "oklch(0.09 0.018 272)",
                        }}>
                          {g.status === "failed" ? (
                            <><X size={16} style={{ color: "#ef4444" }} /><span style={{ fontSize: 11, color: "#ef4444" }}>Failed</span></>
                          ) : Date.now() - new Date(g.created_at).getTime() > STALE_JOB_MS ? (
                            <><Clock size={16} style={{ color: "#f59e0b" }} /><span style={{ fontSize: 11, color: "#f59e0b", fontWeight: 600 }}>Timed out</span></>
                          ) : (
                            <><Loader2 size={16} style={{ color: "var(--accent)", animation: "spin 1s linear infinite" }} />
                            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{g.status === "pending" ? "Queued…" : "Rendering…"}</span></>
                          )}
                        </div>
                      )}
                      <div style={{ padding: "9px 11px" }}>
                        <p style={{
                          fontSize: 11, color: "var(--text-muted)", margin: "0 0 5px",
                          lineHeight: 1.5, overflow: "hidden", display: "-webkit-box",
                          WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                        }}>
                          {g.prompt}
                        </p>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 10, color: "var(--text-muted)", opacity: 0.45 }}>
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
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes dotPulse {
          0%, 80%, 100% { transform: scale(0.55); opacity: 0.35; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
