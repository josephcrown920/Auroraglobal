import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Film, Video, Download, Loader2, RotateCcw, LogOut,
  History, X, Clock, ArrowRight, Play,
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
const DIRECTORS = [
  { id: "auto", label: "Auto fastest", desc: "Use the first configured low-latency brain." },
  { id: "anthropic", label: "Claude", desc: "Prefer Anthropic Claude when ANTHROPIC_API_KEY is configured." },
  { id: "xai", label: "Grok xAI", desc: "Prefer Grok when XAI_API_KEY is configured." },
  { id: "openrouter", label: "Fable / OpenRouter", desc: "Prefer the OpenRouter lane for custom Fable-style routing." },
] as const;
type DirectorProvider = (typeof DIRECTORS)[number]["id"];

const MODES = [
  { id: "direct", label: "Direct-to-camera", icon: Camera, desc: "Intimate, personal delivery — speaks straight to the viewer" },
  { id: "cinematic", label: "Cinematic narration", icon: Film, desc: "Authoritative voiceover with a sense of place and movement" },
] as const;
type ModeId = (typeof MODES)[number]["id"];

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
    pending:    { color: "#f59e0b", label: "Queued" },
    processing: { color: "oklch(0.72 0.2 300)", label: "Rendering" },
    completed:  { color: "#22c55e", label: "Done" },
    failed:     { color: "#ef4444", label: "Failed" },
  };
  const { color, label } = map[status];
  return (
    <span className="inline-flex items-center gap-1" style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: "0.04em", textTransform: "uppercase" }}>
      <span className="inline-block shrink-0 rounded-full" style={{ width: 5, height: 5, background: color }} />
      {label}
    </span>
  );
}

function downloadVideo(url: string, filename: string) {
  fetch(url)
    .then(r => r.blob())
    .then(blob => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
    })
    .catch(() => window.open(url, "_blank"));
}

function HistoryItem({ g }: { g: VideoGen }) {
  const stale = Date.now() - new Date(g.created_at).getTime() > STALE_JOB_MS;
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg)]">
      {g.result_video_url ? (
        <div className="relative">
          <video src={g.result_video_url} controls playsInline className="block w-full bg-black" style={{ maxHeight: 160 }} />
          <button
            onClick={() => downloadVideo(g.result_video_url!, `aurora-video-${g.id}.mp4`)}
            className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur-sm"
            style={{ background: "rgba(0,0,0,0.75)" }}
          >
            <Download size={10} /> Save
          </button>
        </div>
      ) : (
        <div className="flex h-20 flex-col items-center justify-center gap-1.5" style={{ background: "oklch(0.09 0.018 272)" }}>
          {g.status === "failed" ? (
            <><X size={16} className="text-red-500" /><span className="text-[11px] text-red-500">Failed</span></>
          ) : stale ? (
            <><Clock size={16} className="text-amber-400" /><span className="text-[11px] font-semibold text-amber-400">Timed out</span></>
          ) : (
            <><Loader2 size={16} className="animate-spin text-[var(--accent)]" />
            <span className="text-[11px] text-[var(--text-muted)]">{g.status === "pending" ? "Queued…" : "Rendering…"}</span></>
          )}
        </div>
      )}
      <div className="px-3 py-2.5">
        <p className="mb-1.5 line-clamp-2 text-[11px] leading-relaxed text-[var(--text-muted)]">{g.prompt}</p>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[var(--text-muted)] opacity-50">
            {new Date(g.created_at).toLocaleDateString()}
          </span>
          <StatusDot status={g.status} />
        </div>
      </div>
    </div>
  );
}

export function VideoAgentUI({ session }: Props) {
  const [view, setView] = useState<View>("project");
  const [idea, setIdea] = useState("");
  const [script, setScript] = useState("");
  const [mode, setMode] = useState<ModeId>("direct");
  const [orientation, setOrientation] = useState<"landscape" | "portrait">("landscape");
  const [directorProvider, setDirectorProvider] = useState<DirectorProvider>("auto");
  const [targetSeconds, setTargetSeconds] = useState(30);
  const [stage, setStage]               = useState<Stage>("idle");
  const [resultUrl, setResultUrl]       = useState<string | null>(null);
  const [history, setHistory]           = useState<VideoGen[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showHistory, setShowHistory]   = useState(false);

  const videoRef      = useRef<HTMLVideoElement>(null);
  const pollRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef      = useRef(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const inputRef      = useRef<HTMLTextAreaElement>(null);

  const token = session.access_token;
  const email = session.user.email ?? "";
  const busy    = stage !== "idle" && stage !== "done" && stage !== "error";
  const polling = stage === "polling";
  const elapsed = useElapsed(polling || stage === "submitting" || stage === "finalizing");

  const activeRenderCount = history.filter(
    g => g.status === "pending" || g.status === "processing",
  ).length;

  const stageLabel: Record<Stage, string> = {
    idle: "", enhancing: "Crafting your script…",
    submitting: "Submitting to HeyGen…",
    polling: `Rendering · ${elapsed}s`,
    finalizing: "Saving…", done: "", error: "",
  };

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
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight });
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
  function resetToIdle() { stopPoll(); abortRef.current = false; setStage("idle"); }

  async function handleEnhance(text?: string) {
    const idea = (text ?? chatInput).trim();
    if (!idea) { toast.error("Describe your idea first"); return; }
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: idea, created_at: new Date().toISOString() };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setStage("enhancing");
    setScript("");
    try {
      const res = await enhanceScript(
        { prompt: idea, targetSeconds, directToCamera: mode === "direct", directorProvider },
        token,
      );
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
      setChatMessages([]); setScript(""); setChatInput("");
      toast.success("Conversation cleared");
    } catch { toast.error("Failed to clear conversation"); }
  }

  const handlePoll = useCallback(async (
    videoId: string, resultVideoId: string, prompt: string,
    reservationRef: string, cost: number, startedAt: number,
  ) => {
    if (abortRef.current) return;
    if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
      stopPoll(); toast.error("Still rendering — check back in History."); resetToIdle(); return;
    }
    try {
      const st = await getVideoStatus(videoId, token);
      if (abortRef.current) return;
      if (st.status === "completed" && st.url) {
        stopPoll(); setStage("finalizing");
        try { await finalizeVideo({ videoId, url: st.url, prompt, reservationRef, cost }, token); } catch { /* non-fatal */ }
        setResultUrl(st.url); setStage("done"); toast.success("Video ready!");
      } else if (st.status === "failed") {
        stopPoll(); toast.error(st.error ?? "HeyGen render failed"); resetToIdle();
      }
    } catch { /* network hiccup — keep polling */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleGenerate(useScript?: string) {
    const final = (useScript ?? script).trim();
    if (!final) { toast.error("Write or enhance a script first"); return; }
    abortRef.current = false;
    setStage("submitting"); setResultUrl(null);
    try {
      const res = await submitVideo({ prompt: final, orientation }, token);
      if (!res.ok || !res.videoId) {
        if (res.heygenCredit) toast.error("HeyGen API credits exhausted — top up at app.heygen.com");
        else if (res.insufficient) toast.error("Insufficient Aura credits — top up in Aurora");
        else toast.error(res.error ?? "Submit failed");
        resetToIdle(); return;
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
    abortRef.current = true; stopPoll();
    setChatInput(""); setScript(""); setResultUrl(null); setStage("idle");
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">

      {/* Header */}
      <header className="relative z-20 flex h-13 shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] px-4 backdrop-blur-md" style={{ background: "oklch(0.085 0.022 272 / 0.96)" }}>
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border" style={{ background: "oklch(0.72 0.2 300 / 0.12)", borderColor: "oklch(0.72 0.2 300 / 0.25)" }}>
            <Film size={13} color="oklch(0.72 0.2 300)" />
          </div>
          <span className="shrink-0 text-sm font-bold tracking-tight text-[var(--text)]">Video Director</span>
          {busy && stageLabel[stage] && (
            <div className="flex min-w-0 items-center gap-1.5 text-xs text-[var(--accent)]">
              <Loader2 size={11} className="shrink-0 animate-spin" />
              <span className="truncate">{stageLabel[stage]}</span>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            onClick={() => setShowHistory(h => !h)}
            className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors"
            style={{
              borderColor: showHistory ? "var(--accent)" : "var(--border)",
              background: showHistory ? "oklch(0.72 0.2 300 / 0.1)" : "transparent",
              color: showHistory ? "var(--accent)" : "var(--text-muted)",
            }}
          >
            <History size={12} />
            History
            {activeRenderCount > 0 && (
              <span className="rounded px-1 py-px text-[9px] font-black text-white" style={{ background: "var(--accent)" }}>{activeRenderCount}</span>
            )}
          </button>
          {chatMessages.length > 0 && (
            <button
              onClick={() => void handleClearChat()}
              disabled={busy}
              title="Clear conversation"
              className="flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[var(--text-muted)] disabled:cursor-not-allowed"
            >
              <X size={12} />
            </button>
          )}
          <span className="max-w-[120px] truncate text-[11px] text-[var(--text-muted)] opacity-55">{email}</span>
          <button
            onClick={() => supabase.auth.signOut()}
            className="flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[11px] text-[var(--text-muted)]"
          >
            <LogOut size={11} /> Out
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Chat column */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">

          {/* Messages scroll area */}
          <div ref={chatScrollRef} className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-5 pb-2 pt-6" style={{ scrollbarWidth: "thin" }}>

            {/* Empty state */}
            {!loadingChat && chatMessages.length === 0 && stage === "idle" && (
              <div className="flex flex-1 flex-col items-center justify-center pb-16" style={{ minHeight: 320 }}>
                <div className="w-full max-w-md text-center">
                  <div className="mx-auto mb-5 flex size-13 items-center justify-center rounded-[14px] border" style={{ background: "oklch(0.72 0.2 300 / 0.08)", borderColor: "oklch(0.72 0.2 300 / 0.18)" }}>
                    <Film size={22} color="oklch(0.72 0.2 300)" />
                  </div>
                  <p className="mb-2.5 text-[22px] font-black tracking-tight text-[var(--text)]">What are we shooting?</p>
                  <p className="mb-7 text-sm leading-relaxed text-[var(--text-muted)]">
                    Tell me the idea, the mood, the vibe. One line or ten.<br />
                    I'll shape it into a script and produce the video.
                  </p>
                  <div className="flex flex-col gap-2 text-left">
                    {STARTER_PROMPTS.map((p, i) => (
                      <button
                        key={i}
                        onClick={() => { setChatInput(p); inputRef.current?.focus(); }}
                        className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 text-left text-sm leading-relaxed text-[var(--text-muted)] transition-colors hover:border-[oklch(0.72_0.2_300_/_0.4)] hover:text-[var(--text)]"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {loadingChat && (
              <div className="flex items-center justify-center gap-2 pt-16 text-[var(--text-muted)]">
                <Loader2 size={14} className="animate-spin" />
                <span className="text-sm">Loading conversation…</span>
              </div>
            )}

            {/* Messages */}
            {chatMessages.map((m, idx) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className="max-w-[80%] rounded-2xl px-4 py-3"
                  style={{
                    maxWidth: m.role === "user" ? "68%" : "80%",
                    background: m.role === "user" ? "oklch(0.72 0.2 300 / 0.11)" : "var(--bg-card)",
                    border: `1px solid ${m.role === "user" ? "oklch(0.72 0.2 300 / 0.22)" : "var(--border)"}`,
                    borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  }}
                >
                  <div style={{
                    width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                    background: "var(--bg)", border: "1px solid var(--border)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 800, color: "var(--text)",
                  }}>
                    {o.id}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>{o.label}</span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", opacity: 0.7 }}>· {o.setting}</span>
                    </div>
                    <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>{o.key}</p>
                    {o.note && (
                      <p style={{ fontSize: 11, color: "#f59e0b", margin: "4px 0 0", fontWeight: 600 }}>★ {o.note}</p>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                    <OutfitStatusIcon status={o.status} />
                    <OutfitStatusLabel status={o.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Post-processing guide */}
          <div style={{
            marginTop: 20, borderRadius: 14, border: "1px solid var(--border)",
            background: "var(--bg-card)", padding: "16px 18px",
          }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)", marginBottom: 10 }}>
              Post-processing each clip (CapCut)
            </div>
            <ol style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                "Lay 24-second hook audio underneath — align Josh's movement to the beat drop",
                "Colour grade: golden hour = warm orange lift + teal shadows · night = deep blue/teal, crushed blacks",
                "Motion blur on officers (Video Effects → Motion Blur medium) — sells the treadmill illusion",
                "Vignette 25–35% — darkens edges, focuses eye on Josh",
                "Export: 1080×1920 vertical (TikTok/Reels) or 1920×1080 horizontal (YouTube)",
                "Caption: \"[Outfit vibe] 🔥 They ran full speed. Didn't move an inch. #NBAJosh #LoopingOfficers #OutTheMud\"",
              ].map((step, i) => (
                <li key={i} style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>{step}</li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {/* ── STUDIO VIEW (HeyGen) ── */}
      {view === "studio" && (
        <>
          <div style={{
            borderBottom: "1px solid var(--border)",
            padding: "12px 20px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "oklch(0.085 0.022 272 / 0.5)",
            overflowX: "auto",
          }}>
            <div style={{ marginLeft: 4 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 3 }}>
                HeyGen avatar · your script, your face, any scene
              </p>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 0 }}>
                Identity photo + outfit + scene reference → AI script → video in ~60–120s
              </p>
            </div>
          </div>

          <main style={{ flex: 1, padding: "28px 20px", maxWidth: 760, margin: "0 auto", width: "100%" }}>
            <Section num={1} label="Write your script">
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <textarea
                  value={script || idea}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (script) setScript(val); else setIdea(val);
                  }}
                  placeholder="Paste your raw idea, rough notes, or draft script here…"
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

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {DIRECTORS.map((d) => {
                    const active = directorProvider === d.id;
                    return (
                      <button
                        key={d.id}
                        onClick={() => setDirectorProvider(d.id)}
                        disabled={busy}
                        title={d.desc}
                        style={{
                          padding: "7px 11px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                          border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                          background: active ? "oklch(0.72 0.2 300 / 0.12)" : "transparent",
                          color: active ? "var(--accent)" : "var(--text-muted)",
                          cursor: busy ? "not-allowed" : "pointer", transition: "all 0.15s",
                        }}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {MODES.map((m) => {
                    const Icon = m.icon;
                    const active = mode === m.id;
                    return (
                      <button
                        onClick={() => { setScript(m.content); void handleGenerate(m.content); }}
                        disabled={busy}
                        className="flex items-center gap-1.5 rounded-[9px] px-4 py-2 text-sm font-bold text-white transition-all disabled:cursor-not-allowed"
                        style={{
                          background: busy ? "oklch(0.18 0.01 272)" : "oklch(0.72 0.2 300)",
                          color: busy ? "var(--text-muted)" : "white",
                          boxShadow: busy ? "none" : "0 0 18px oklch(0.72 0.2 300 / 0.38)",
                        }}
                      >
                        {busy && idx === chatMessages.length - 1 ? (
                          <><Loader2 size={12} className="animate-spin" /> {stageLabel[stage]}</>
                        ) : (
                          <><Play size={12} /> Produce Video</>
                        )}
                      </button>
                      <button
                        onClick={() => { setScript(m.content); toast.success("Script loaded — revise and re-send, or hit Produce Video"); }}
                        className="flex items-center gap-1 rounded-[9px] border border-[var(--border)] px-3.5 py-2 text-xs font-semibold text-[var(--text-muted)]"
                      >
                        Revise
                      </button>
                    </div>
                  )}
                  <div className={`mt-1.5 text-[10px] text-[var(--text-muted)] opacity-40 ${m.role === "user" ? "text-right" : "text-left"}`}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {stage === "enhancing" && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2.5 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3" style={{ borderRadius: "16px 16px 16px 4px" }}>
                  <div className="flex items-center gap-1">
                    {[0, 1, 2].map(i => (
                      <span key={i} className="block size-1.5 rounded-full bg-[var(--accent)]" style={{ animation: `dotPulse 1.3s ${i * 0.2}s ease-in-out infinite` }} />
                    ))}
                  </div>
                  <span className="text-sm text-[var(--text-muted)]">Writing your script…</span>
                </div>
              </div>
            )}

            {/* Generation in-progress bubble */}
            {(stage === "submitting" || stage === "polling" || stage === "finalizing") && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2.5 rounded-2xl border px-4 py-3" style={{ borderRadius: "16px 16px 16px 4px", background: "var(--bg-card)", borderColor: "oklch(0.72 0.2 300 / 0.18)" }}>
                  <Loader2 size={14} className="shrink-0 animate-spin text-[var(--accent)]" />
                  <div className="min-w-0">
                    <div className="mb-0.5 text-[10px] font-black uppercase tracking-widest text-[var(--accent)]">Director</div>
                    <span className="text-sm text-[var(--text)]">{stageLabel[stage]}</span>
                  </div>
                  <button onClick={handleReset} className="ml-1 flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--text-muted)]">
                    <X size={10} /> Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Result card */}
            {stage === "done" && resultUrl && (
              <div className="flex justify-start">
                <div className="w-full max-w-[540px] overflow-hidden rounded-2xl border bg-[var(--bg-card)]" style={{ borderColor: "oklch(0.22 0.2 145 / 0.5)", boxShadow: "0 0 32px oklch(0.52 0.18 145 / 0.12)" }}>
                  <div className="flex items-center gap-1.5 border-b border-[var(--border)] px-3.5 py-2.5">
                    <span className="inline-block size-1.5 rounded-full bg-[#22c55e]" style={{ boxShadow: "0 0 7px #22c55e" }} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#22c55e]">Video Ready</span>
                  </div>
                  <video ref={videoRef} src={resultUrl} controls playsInline autoPlay className="block w-full bg-black" />
                  <div className="flex gap-2 p-3">
                    <button
                      onClick={() => downloadVideo(resultUrl, `aurora-video-${Date.now()}.mp4`)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-[9px] py-2.5 text-sm font-bold text-white"
                      style={{ background: "oklch(0.72 0.2 300)", boxShadow: "0 0 16px oklch(0.72 0.2 300 / 0.35)" }}
                    >
                      <Download size={13} /> Download
                    </button>
                    <button
                      onClick={handleReset}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-[9px] border border-[var(--border)] py-2.5 text-sm font-semibold text-[var(--text-muted)]"
                    >
                      <RotateCcw size={13} /> Make another
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input bar */}
          <div className="shrink-0 border-t border-[var(--border)] px-4 pb-3.5 pt-2.5 backdrop-blur-md" style={{ background: "oklch(0.085 0.022 272 / 0.97)" }}>
            {/* Controls row */}
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              {(["direct", "cinematic"] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  disabled={busy}
                  className="rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors disabled:cursor-not-allowed"
                  style={{
                    borderColor: mode === m ? "var(--accent)" : "var(--border)",
                    background: mode === m ? "oklch(0.72 0.2 300 / 0.1)" : "transparent",
                    color: mode === m ? "var(--accent)" : "var(--text-muted)",
                  }}
                >
                  {m === "direct" ? "Direct-to-cam" : "Cinematic"}
                </button>
              ))}
              <select
                value={targetSeconds}
                onChange={e => setTargetSeconds(Number(e.target.value))}
                disabled={busy}
                className="rounded-md border border-[var(--border)] bg-[var(--bg-input)] px-2 py-1 text-xs text-[var(--text-muted)] outline-none disabled:cursor-not-allowed"
              >
                {DURATIONS.map(d => <option key={d} value={d}>{d}s</option>)}
              </select>
              <button
                onClick={() => setOrientation(o => o === "landscape" ? "portrait" : "landscape")}
                disabled={busy}
                className="rounded-md border border-[var(--border)] px-2.5 py-1 text-xs font-semibold text-[var(--text-muted)] disabled:cursor-not-allowed"
              >
                {orientation === "landscape" ? "16:9" : "9:16"}
              </button>
            </div>

            {/* Textarea + send */}
            <div className="flex items-end gap-2">
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
                className="min-h-[44px] flex-1 resize-none rounded-xl border border-[var(--border)] bg-[var(--bg-input)] px-3.5 py-3 text-sm leading-snug text-[var(--text)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[oklch(0.72_0.2_300_/_0.55)] disabled:cursor-not-allowed"
              />
              <button
                onClick={() => void handleEnhance()}
                disabled={busy || !chatInput.trim()}
                className="flex size-11 shrink-0 items-center justify-center rounded-xl border transition-all disabled:cursor-not-allowed"
                style={{
                  background: busy || !chatInput.trim() ? "oklch(0.13 0.015 272)" : "oklch(0.72 0.2 300)",
                  borderColor: busy || !chatInput.trim() ? "var(--border)" : "oklch(0.72 0.2 300)",
                  boxShadow: busy || !chatInput.trim() ? "none" : "0 0 16px oklch(0.72 0.2 300 / 0.4)",
                }}
              >
                {busy
                  ? <Loader2 size={16} className="animate-spin" style={{ color: "oklch(0.72 0.2 300 / 0.5)" }} />
                  : <ArrowRight size={16} color={chatInput.trim() ? "white" : "oklch(0.3 0.02 272)"} />
                }
              </button>
            </div>
          </div>
        </div>

        {/* History side panel */}
        {showHistory && (
          <div className="flex w-80 shrink-0 flex-col overflow-hidden border-l border-[var(--border)] bg-[var(--bg-card)]">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] px-3.5 py-3">
              <span className="text-sm font-bold text-[var(--text)]">Video History</span>
              <div className="flex gap-1.5">
                <button
                  onClick={() => void fetchHistory()}
                  className="flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--text-muted)]"
                >
                  <RotateCcw size={10} />
                </button>
                <button
                  onClick={() => setShowHistory(false)}
                  className="flex size-6 items-center justify-center rounded-md border border-[var(--border)] text-[var(--text-muted)]"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2.5">
              {loadingHistory ? (
                <div className="flex h-28 items-center justify-center gap-2 text-[var(--text-muted)]">
                  <Loader2 size={14} className="animate-spin" /><span className="text-sm">Loading…</span>
                </div>
              ) : history.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <Video size={30} className="mx-auto mb-3 block text-[var(--text-muted)] opacity-15" />
                  <div className="mb-1 text-sm font-semibold text-[var(--text)]">No videos yet</div>
                  <p className="m-0 text-xs leading-relaxed text-[var(--text-muted)]">Generate your first video to see it here.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {history.map(g => <HistoryItem key={g.id} g={g} />)}
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
