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
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { enhanceScript, submitVideo, getVideoStatus, finalizeVideo } from "@/lib/api";
import { supabase } from "@/lib/supabase";

interface Props { session: Session; }

// Stage progression:
//  idle → enhancing → idle (with script)
//  idle → submitting → polling → finalizing → done
//  any error → error (auto-resets to idle after toast)
type Stage = "idle" | "enhancing" | "submitting" | "polling" | "finalizing" | "done" | "error";

const DURATIONS = [10, 15, 20, 30, 45, 60, 90];
const MODES = [
  { id: "direct", label: "Direct-to-camera", icon: Camera, desc: "Intimate, personal delivery — speaks straight to the viewer" },
  { id: "cinematic", label: "Cinematic narration", icon: Film, desc: "Authoritative voiceover with a sense of place and movement" },
] as const;
type ModeId = (typeof MODES)[number]["id"];

const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 25 * 60_000; // 25 min hard cap

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

export function VideoAgentUI({ session }: Props) {
  const [idea, setIdea] = useState("");
  const [script, setScript] = useState("");
  const [mode, setMode] = useState<ModeId>("direct");
  const [orientation, setOrientation] = useState<"landscape" | "portrait">("landscape");
  const [targetSeconds, setTargetSeconds] = useState(30);
  const [stage, setStage] = useState<Stage>("idle");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef(false);

  const token = session.access_token;
  const email = session.user.email ?? "";
  const busy = stage !== "idle" && stage !== "done" && stage !== "error";
  const polling = stage === "polling";
  const elapsed = useElapsed(polling || stage === "submitting" || stage === "finalizing");

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
        toast.error("HeyGen is taking too long — the video may still complete. Check back in a few minutes.");
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
            // Finalize errors (e.g. already committed) are non-fatal — video is still playable.
          }
          setResultUrl(st.url);
          setStage("done");
          toast.success("Video ready!");
        } else if (st.status === "failed") {
          stopPoll();
          toast.error(st.error ?? "HeyGen video generation failed");
          resetToIdle();
        }
        // pending / processing → keep polling
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

      // Poll immediately, then every POLL_INTERVAL_MS.
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
