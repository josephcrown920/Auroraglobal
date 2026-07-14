import { useState, useRef } from "react";
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
  Sparkles,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { enhanceScript, generateVideo } from "@/lib/api";
import { supabase } from "@/lib/supabase";

interface Props {
  session: Session;
}

type Stage = "idle" | "enhancing" | "generating" | "done" | "error";

const DURATIONS = [10, 15, 20, 30, 45, 60, 90];
const MODES = [
  { id: "direct",     label: "Direct-to-camera",    icon: Camera, desc: "Intimate, personal delivery — speaks straight to the viewer" },
  { id: "cinematic",  label: "Cinematic narration",  icon: Film,   desc: "Authoritative voiceover with a sense of place and movement" },
] as const;
type ModeId = (typeof MODES)[number]["id"];

// ─── Glassmorphism helpers ─────────────────────────────────────────────────────
const glass = {
  card: {
    background: "rgba(12, 12, 22, 0.58)",
    backdropFilter: "blur(24px) saturate(170%)",
    WebkitBackdropFilter: "blur(24px) saturate(170%)",
    border: "1px solid rgba(255,255,255,0.09)",
    boxShadow: "0 8px 40px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.07)",
  } as React.CSSProperties,
  input: {
    background: "rgba(255,255,255,0.06)",
    backdropFilter: "blur(8px)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "#fff",
    outline: "none",
  } as React.CSSProperties,
  button: {
    background: "rgba(255,255,255,0.06)",
    backdropFilter: "blur(8px)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "rgba(255,255,255,0.7)",
    cursor: "pointer",
    transition: "all 0.15s",
  } as React.CSSProperties,
  header: {
    background: "rgba(6, 6, 14, 0.72)",
    backdropFilter: "blur(24px) saturate(180%)",
    WebkitBackdropFilter: "blur(24px) saturate(180%)",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  } as React.CSSProperties,
};

export function VideoAgentUI({ session }: Props) {
  const [idea,          setIdea]          = useState("");
  const [script,        setScript]        = useState("");
  const [mode,          setMode]          = useState<ModeId>("direct");
  const [orientation,   setOrientation]   = useState<"landscape" | "portrait">("landscape");
  const [targetSeconds, setTargetSeconds] = useState(30);
  const [stage,         setStage]         = useState<Stage>("idle");
  const [resultUrl,     setResultUrl]     = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const token = session.access_token;
  const email = session.user.email ?? "";

  async function handleEnhance() {
    if (!idea.trim()) { toast.error("Enter an idea or draft first"); return; }
    setStage("enhancing");
    setScript("");
    try {
      const res = await enhanceScript({ prompt: idea, targetSeconds, directToCamera: mode === "direct" }, token);
      setScript(res.script);
      setStage("idle");
      toast.success("Script enhanced");
    } catch (e) {
      setStage("error");
      toast.error(e instanceof Error ? e.message : "Enhancement failed");
      setStage("idle");
    }
  }

  async function handleGenerate() {
    const final = script.trim() || idea.trim();
    if (!final) { toast.error("Write or enhance a script first"); return; }
    setStage("generating");
    setResultUrl(null);
    try {
      const res = await generateVideo({ prompt: final, orientation }, token);
      if (!res.ok) {
        setStage("error");
        if (res.heygenCredit)   toast.error("HeyGen API credits exhausted — top up at app.heygen.com");
        else if (res.insufficient) toast.error("Insufficient Aura credits — top up in Aurora");
        else toast.error(res.error ?? "Generation failed");
        setStage("idle");
        return;
      }
      if (res.url) {
        setResultUrl(res.url);
        setStage("done");
        toast.success("Video ready!");
      } else {
        setStage("error");
        toast.error("No video URL returned");
        setStage("idle");
      }
    } catch (e) {
      setStage("error");
      toast.error(e instanceof Error ? e.message : "Generation failed");
      setStage("idle");
    }
  }

  function handleReset() {
    setIdea(""); setScript(""); setResultUrl(null); setStage("idle");
  }

  const busy         = stage === "enhancing" || stage === "generating";
  const activeScript = script || idea;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative" }}>

      {/* ── Cinematic blurred background ── */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0,
        backgroundImage: "url('/video-agent/demo-cinematic.webp')",
        backgroundSize: "cover", backgroundPosition: "center 25%",
        filter: "blur(10px) brightness(0.28) saturate(1.5)",
        transform: "scale(1.06)",
      }} />
      {/* Violet gradient overlay */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0,
        background: "linear-gradient(160deg, oklch(0.15 0.05 300 / 0.55) 0%, oklch(0.085 0.022 272 / 0.85) 55%, oklch(0.07 0.03 250 / 0.9) 100%)",
      }} />

      {/* ── Header (glass) ── */}
      <header style={{
        ...glass.header,
        position: "sticky", top: 0, zIndex: 20,
        padding: "0 24px", height: 60,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        {/* Top shimmer line */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent 0%, rgba(147,104,245,0.4) 40%, rgba(147,104,245,0.4) 60%, transparent 100%)" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative", zIndex: 1 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: "rgba(147,104,245,0.15)",
            border: "1px solid rgba(147,104,245,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 16px rgba(147,104,245,0.2)",
          }}>
            <Video size={16} color="oklch(0.72 0.2 300)" />
          </div>
          <span style={{ fontWeight: 800, fontSize: 16, color: "#fff", letterSpacing: "-0.03em" }}>
            Aurora <span style={{ color: "oklch(0.72 0.2 300)" }}>Video Agent</span>
          </span>
          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "rgba(147,104,245,0.15)", border: "1px solid rgba(147,104,245,0.25)", color: "oklch(0.72 0.2 300)", letterSpacing: "0.04em" }}>HEYGEN</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{email}</span>
          <button
            onClick={() => supabase.auth.signOut()}
            style={{ ...glass.button, display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, fontSize: 12 }}
          >
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </header>

      {/* ── Hero showcase ── */}
      <div style={{ position: "relative", zIndex: 1, borderBottom: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
        {/* Variation grid */}
        <div style={{ position: "relative", height: 180 }}>
          <img
            src="/video-agent/demo-variations.jpg"
            alt="Sample video outputs"
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 30%", display: "block" }}
          />
          {/* Deep gradient overlay */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(6,6,14,0.2) 0%, rgba(6,6,14,0.82) 100%)" }} />
          {/* Cinematic still — small inset on the right */}
          <div style={{ position: "absolute", right: 24, bottom: 18, width: 110, height: 70, borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.18)", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
            <img src="/video-agent/demo-cinematic.webp" alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 15%" }} />
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.25)" }} />
            <div style={{ position: "absolute", bottom: 5, left: 6 }}>
              <span style={{ fontSize: 8, fontWeight: 700, color: "rgba(255,255,255,0.8)", letterSpacing: "0.05em" }}>CINEMATIC</span>
            </div>
          </div>
          {/* Labels */}
          <div style={{ position: "absolute", bottom: 16, left: 24 }}>
            <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              {["Sports","Fashion","Music","Beauty","Lifestyle"].map(tag => (
                <span key={tag} style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "rgba(255,255,255,0.12)", backdropFilter: "blur(6px)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.75)", letterSpacing: "0.04em" }}>{tag}</span>
              ))}
            </div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}>
              Any niche. Any voice. Cinematic quality.
            </p>
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <main style={{ flex: 1, padding: "28px 24px 60px", maxWidth: 780, margin: "0 auto", width: "100%", position: "relative", zIndex: 1 }}>

        {/* ── Step 1 — Script ── */}
        <GlassSection num={1} label="Write your script">
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
                ...glass.input,
                width: "100%", borderRadius: 12,
                padding: "14px 16px", fontSize: 14,
                resize: "vertical", lineHeight: 1.65,
                transition: "border-color 0.15s, background 0.15s",
              }}
              onFocus={(e) => { e.target.style.borderColor = "oklch(0.72 0.2 300 / 0.55)"; e.target.style.background = "rgba(147,104,245,0.07)"; }}
              onBlur={(e)  => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; e.target.style.background = "rgba(255,255,255,0.06)"; }}
            />

            {/* Mode + Duration row */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
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
                      ...glass.button,
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "7px 14px", borderRadius: 9, fontSize: 13, fontWeight: 500,
                      border: `1px solid ${active ? "oklch(0.72 0.2 300 / 0.5)" : "rgba(255,255,255,0.1)"}`,
                      background: active ? "rgba(147,104,245,0.15)" : "rgba(255,255,255,0.05)",
                      color: active ? "oklch(0.72 0.2 300)" : "rgba(255,255,255,0.55)",
                      boxShadow: active ? "0 0 12px rgba(147,104,245,0.2)" : "none",
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
                  padding: "7px 12px", borderRadius: 9, fontSize: 13,
                  background: "rgba(255,255,255,0.06)",
                  backdropFilter: "blur(8px)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.55)", cursor: "pointer", outline: "none",
                }}
              >
                {DURATIONS.map((d) => (
                  <option key={d} value={d} style={{ background: "#0d0d18" }}>{d}s</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleEnhance}
              disabled={busy || !idea.trim()}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "11px 20px", borderRadius: 12, fontWeight: 600, fontSize: 14,
                background: busy || !idea.trim() ? "rgba(255,255,255,0.04)" : "rgba(147,104,245,0.18)",
                backdropFilter: "blur(8px)",
                border: `1px solid ${busy || !idea.trim() ? "rgba(255,255,255,0.08)" : "rgba(147,104,245,0.4)"}`,
                color: busy || !idea.trim() ? "rgba(255,255,255,0.25)" : "oklch(0.72 0.2 300)",
                cursor: busy || !idea.trim() ? "not-allowed" : "pointer",
                boxShadow: !busy && idea.trim() ? "0 0 20px rgba(147,104,245,0.15)" : "none",
                transition: "all 0.15s",
              }}
            >
              {stage === "enhancing"
                ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Enhancing…</>
                : <><Sparkles size={15} /> Enhance with AI</>
              }
            </button>
          </div>
        </GlassSection>

        {/* ── Step 2 — Generate ── */}
        <GlassSection num={2} label="Generate video">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 8 }}>
              {(["landscape", "portrait"] as const).map((o) => {
                const Icon = o === "landscape" ? Monitor : Smartphone;
                const active = orientation === o;
                return (
                  <button
                    key={o}
                    onClick={() => setOrientation(o)}
                    disabled={busy}
                    style={{
                      ...glass.button,
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "8px 16px", borderRadius: 9, fontSize: 13, fontWeight: 500,
                      border: `1px solid ${active ? "oklch(0.72 0.2 300 / 0.5)" : "rgba(255,255,255,0.1)"}`,
                      background: active ? "rgba(147,104,245,0.15)" : "rgba(255,255,255,0.05)",
                      color: active ? "oklch(0.72 0.2 300)" : "rgba(255,255,255,0.55)",
                      textTransform: "capitalize",
                      boxShadow: active ? "0 0 12px rgba(147,104,245,0.2)" : "none",
                    }}
                  >
                    <Icon size={14} /> {o}
                  </button>
                );
              })}
            </div>

            {activeScript && (
              <div style={{
                ...glass.card,
                borderRadius: 12, padding: "14px 16px",
                background: "rgba(147,104,245,0.06)",
                border: "1px solid rgba(147,104,245,0.15)",
              }}>
                <p style={{ fontSize: 11, color: "oklch(0.72 0.2 300 / 0.7)", marginBottom: 7, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  Script preview
                </p>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                  {activeScript.slice(0, 300)}{activeScript.length > 300 ? "…" : ""}
                </p>
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={busy || !activeScript.trim()}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
                padding: "14px 24px", borderRadius: 14, fontWeight: 800, fontSize: 15,
                background: busy || !activeScript.trim()
                  ? "rgba(255,255,255,0.06)"
                  : "linear-gradient(135deg, oklch(0.72 0.2 300) 0%, oklch(0.62 0.22 290) 100%)",
                border: busy || !activeScript.trim() ? "1px solid rgba(255,255,255,0.08)" : "none",
                color: busy || !activeScript.trim() ? "rgba(255,255,255,0.25)" : "#fff",
                cursor: busy || !activeScript.trim() ? "not-allowed" : "pointer",
                boxShadow: !busy && activeScript.trim()
                  ? "0 0 32px rgba(147,104,245,0.5), 0 6px 20px rgba(0,0,0,0.4)"
                  : "none",
                transition: "all 0.2s",
                letterSpacing: "-0.01em",
              }}
            >
              {stage === "generating"
                ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Generating — this takes ~60s…</>
                : <><Video size={16} /> Generate HeyGen Video</>
              }
            </button>

            {stage === "generating" && (
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", textAlign: "center" }}>
                Aurora credits will be deducted once the video is ready.
              </p>
            )}
          </div>
        </GlassSection>

        {/* ── Result ── */}
        {resultUrl && (
          <GlassSection num={3} label="Your video">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{
                borderRadius: 16, overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.1)",
                background: "#000",
                boxShadow: "0 0 40px rgba(147,104,245,0.2)",
                aspectRatio: orientation === "landscape" ? "16/9" : "9/16",
                maxWidth: orientation === "portrait" ? 300 : "100%",
                margin: "0 auto",
              }}>
                <video
                  ref={videoRef}
                  src={resultUrl}
                  controls autoPlay playsInline
                  style={{ width: "100%", height: "100%", display: "block" }}
                />
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <a
                  href={resultUrl}
                  download="aurora-video-agent.mp4"
                  style={{
                    ...glass.button,
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                    textDecoration: "none", color: "rgba(255,255,255,0.7)",
                  }}
                >
                  <Download size={14} /> Download
                </a>
                <button
                  onClick={handleReset}
                  style={{ ...glass.button, display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600 }}
                >
                  <RotateCcw size={14} /> Make another
                </button>
              </div>
            </div>
          </GlassSection>
        )}
      </main>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        textarea::placeholder, input::placeholder { color: rgba(255,255,255,0.28) !important; }
        select option { background: #0d0d18; }
      `}</style>
    </div>
  );
}

function GlassSection({ num, label, children }: { num: number; label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span style={{
          width: 28, height: 28, borderRadius: "50%",
          background: "rgba(147,104,245,0.15)",
          border: "1px solid rgba(147,104,245,0.3)",
          backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 800, color: "oklch(0.72 0.2 300)",
          flexShrink: 0,
          boxShadow: "0 0 12px rgba(147,104,245,0.2)",
        }}>
          {num}
        </span>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.9)", letterSpacing: "-0.02em" }}>
          {label}
        </h2>
      </div>
      <div style={{
        background: "rgba(12, 12, 22, 0.55)",
        backdropFilter: "blur(24px) saturate(170%)",
        WebkitBackdropFilter: "blur(24px) saturate(170%)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 20,
        padding: "22px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Top shimmer */}
        <div style={{ position: "absolute", top: 0, left: "15%", right: "15%", height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)" }} />
        {children}
      </div>
    </div>
  );
}
