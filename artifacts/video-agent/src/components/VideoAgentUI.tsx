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
  Clapperboard,
  CheckCircle2,
  Circle,
  ChevronRight,
  Shirt,
  User,
  Star,
  Images,
  Copy,
  Check,
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
type View = "project" | "studio" | "history" | "photos";

interface StudioPhoto {
  id: string;
  prompt: string;
  result_image_url: string;
  created_at: string;
  kind: string;
}

const DURATIONS = [10, 15, 20, 30, 45, 60, 90];
const MODES = [
  { id: "direct", label: "Direct-to-camera", icon: Camera, desc: "Intimate, personal delivery — speaks straight to the viewer" },
  { id: "cinematic", label: "Cinematic narration", icon: Film, desc: "Authoritative voiceover with a sense of place and movement" },
] as const;
type ModeId = (typeof MODES)[number]["id"];

const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 10 * 60_000;
const POLL_WARN_MS   =  4 * 60_000;
const STALE_JOB_MS  = 20 * 60_000;

// ── NBA Josh project data ─────────────────────────────────────────────────────

type OutfitStatus = "ready" | "generating" | "done" | "pending";

interface Outfit {
  id: string;
  label: string;
  setting: string;
  key: string;
  status: OutfitStatus;
  note?: string;
}

const OUTFITS: Outfit[] = [
  { id: "A", label: "Burgundy Sport Jersey", setting: "Dark night", key: "Dark burgundy sleeveless sport jersey · snake-frame sunglasses", status: "pending" },
  { id: "B", label: "White Mushroom Tee", setting: "Golden hour", key: "White psychedelic mushroom-eye tee · black leather pants · red Jordan 4s · red crystal belt", status: "ready", note: "IMG_3735 benchmark — closest to correct" },
  { id: "C", label: "NEVER JXST Racing Jersey", setting: "Dark night / golden hour", key: "Red/black long-sleeve racing jersey · white side panels · black distressed jeans · purple crystal belt · white Nike Shox", status: "pending" },
  { id: "D", label: "Crazy Visions Cyber-Punk", setting: "Golden hour / dusk", key: "Orange Crazy Visions beanie · dark mushroom-eye tee · red distressed jeans · fur boots · purple crystal belt", status: "pending" },
  { id: "E", label: "Red Puffer + Camo", setting: "Urban street", key: "Glossy red puffer jacket · wide-leg camo cargo pants · blue paisley basketball sneakers · wavy textured sunglasses", status: "pending" },
  { id: "F", label: "Crazy Visions Clean", setting: "Any", key: "Red/black Crazy Visions beanie · white crewneck oversized tee · dopamine custom Nike AF1s · red crystal belt", status: "pending" },
  { id: "G", label: "Shearling + Racing Edge", setting: "Dusk", key: "Distressed shearling fur bomber · NEVER JXST racing jersey underneath · red leather pants · painted Nike AF1 Mid", status: "pending" },
  { id: "H", label: "Minecraft Creeper Street", setting: "Urban", key: "Lime green Minecraft creeper tee · wide-leg camo cargo pants · blue paisley basketball sneakers", status: "pending" },
  { id: "🚗", label: "Red AMG Benz Scene", setting: "Dusk/night urban", key: "Borrow red AMG Mercedes GT 4-door · white streetwear jacket · embroidered cargo shorts · purple VaporMax — REPLACE FACE with Josh", status: "pending" },
];

const CORRECTIONS = [
  { issue: "Extra face/neck tattoos", fix: "Add to negative: 'no face tattoos, no neck tattoos, clean face'" },
  { issue: "Too muscular/thick", fix: "'slender lean tall basketball player proportions, long limbs, NOT bodybuilder'" },
  { issue: "Likeness drift", fix: "Upload blue-lit portrait as reference every time. Shorter prompts drift less." },
  { issue: "Extra letter on outfit", fix: "Explicitly describe outfit without labels — no 'A' or branding letters" },
  { issue: "Wrong glasses", fix: "Red snake-frame (A–D) · wavy sculptural (E, G, Benz) · black visor (alt)" },
];

// ─────────────────────────────────────────────────────────────────────────────

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

function OutfitStatusIcon({ status }: { status: OutfitStatus }) {
  if (status === "done") return <CheckCircle2 size={15} color="#22c55e" />;
  if (status === "generating") return <Loader2 size={15} color="oklch(0.72 0.2 300)" style={{ animation: "spin 1s linear infinite" }} />;
  if (status === "ready") return <Star size={15} color="#f59e0b" />;
  return <Circle size={15} color="var(--text-muted)" style={{ opacity: 0.4 }} />;
}

function OutfitStatusLabel({ status }: { status: OutfitStatus }) {
  const map: Record<OutfitStatus, { label: string; color: string }> = {
    done: { label: "Done", color: "#22c55e" },
    generating: { label: "Generating…", color: "oklch(0.72 0.2 300)" },
    ready: { label: "Next up", color: "#f59e0b" },
    pending: { label: "Pending", color: "var(--text-muted)" },
  };
  const { label, color } = map[status];
  return <span style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: "0.04em", textTransform: "uppercase" }}>{label}</span>;
}

export function VideoAgentUI({ session }: Props) {
  const [view, setView] = useState<View>("project");
  const [idea, setIdea] = useState("");
  const [script, setScript] = useState("");
  const [mode, setMode] = useState<ModeId>("direct");
  const [orientation, setOrientation] = useState<"landscape" | "portrait">("landscape");
  const [targetSeconds, setTargetSeconds] = useState(30);
  const [stage, setStage] = useState<Stage>("idle");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<VideoGen[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [expandedSpec, setExpandedSpec] = useState(false);
  const [photos, setPhotos] = useState<StudioPhoto[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [refPhoto, setRefPhoto] = useState<StudioPhoto | null>(null);
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

  const fetchPhotos = useCallback(async () => {
    setLoadingPhotos(true);
    const { data, error } = await supabase
      .from("generations")
      .select("id,prompt,result_image_url,created_at,kind")
      .in("status", ["complete", "succeeded"])
      .not("result_image_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(80);
    if (!error && data) setPhotos((data as StudioPhoto[]).filter(p => p.result_image_url));
    setLoadingPhotos(false);
  }, []);

  useEffect(() => {
    if (view === "history") void fetchHistory();
  }, [view, fetchHistory]);

  useEffect(() => {
    if (view === "photos") void fetchPhotos();
  }, [view, fetchPhotos]);

  useEffect(() => {
    const now = Date.now();
    const hasActive = history.some(g =>
      (g.status === "pending" || g.status === "processing") &&
      now - new Date(g.created_at).getTime() < STALE_JOB_MS,
    );
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
  const doneCount = OUTFITS.filter(o => o.status === "done").length;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative", zIndex: 1 }}>
      {/* Header */}
      <header style={{
        borderBottom: "1px solid var(--border)",
        padding: "0 20px",
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "oklch(0.085 0.022 272 / 0.95)",
        backdropFilter: "blur(12px)",
        position: "sticky",
        top: 0,
        zIndex: 10,
        gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9,
            background: "oklch(0.72 0.2 300 / 0.15)",
            border: "1px solid oklch(0.72 0.2 300 / 0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Clapperboard size={15} color="oklch(0.72 0.2 300)" />
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", letterSpacing: "-0.02em" }}>
            NBA Josh <span style={{ color: "var(--accent)" }}>· Video Pipeline</span>
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, overflowX: "auto" }}>
          {busy && stageLabel[stage] && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--accent)", flexShrink: 0 }}>
              <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />
              {stageLabel[stage]}
            </div>
          )}
          {(["project", "studio", "photos", "history"] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "5px 11px", borderRadius: 7, fontSize: 12, fontWeight: 600,
                border: `1px solid ${view === v ? "var(--accent)" : "var(--border)"}`,
                background: view === v ? "oklch(0.72 0.2 300 / 0.12)" : "transparent",
                color: view === v ? "var(--accent)" : "var(--text-muted)",
                cursor: "pointer", flexShrink: 0,
              }}
            >
              {v === "project"
                ? <><Clapperboard size={12} /> Project</>
                : v === "photos"
                  ? <><Images size={12} /> Studio Photos{photos.length > 0 ? ` · ${photos.length}` : ""}</>
                  : v === "history"
                    ? <><History size={12} /> History{activeRenderCount > 0 ? ` · ${activeRenderCount}` : ""}</>
                    : <><Video size={12} /> HeyGen Studio</>
              }
            </button>
          ))}
          <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>{email}</span>
          <button
            onClick={() => supabase.auth.signOut()}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "5px 10px", borderRadius: 7,
              background: "transparent", border: "1px solid var(--border)",
              color: "var(--text-muted)", cursor: "pointer", fontSize: 11, flexShrink: 0,
            }}
          >
            <LogOut size={12} /> Sign out
          </button>
        </div>
      </header>

      {/* ── PROJECT VIEW ── */}
      {view === "project" && (
        <div style={{ flex: 1, maxWidth: 900, margin: "0 auto", width: "100%", padding: "28px 20px" }}>

          {/* Hero banner */}
          <div style={{
            borderRadius: 16,
            background: "linear-gradient(135deg, oklch(0.12 0.03 272) 0%, oklch(0.1 0.04 300) 100%)",
            border: "1px solid oklch(0.72 0.2 300 / 0.2)",
            padding: "20px 24px",
            marginBottom: 24,
            position: "relative",
            overflow: "hidden",
          }}>
            <div style={{
              position: "absolute", inset: 0, opacity: 0.04,
              backgroundImage: "repeating-linear-gradient(45deg, oklch(0.72 0.2 300) 0, oklch(0.72 0.2 300) 1px, transparent 0, transparent 50%)",
              backgroundSize: "12px 12px",
            }} />
            <div style={{ position: "relative" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 18 }}>🎬</span>
                <span style={{ fontWeight: 800, fontSize: 18, color: "var(--text)", letterSpacing: "-0.02em" }}>
                  Looping Officers
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                  background: "oklch(0.72 0.2 300 / 0.15)", color: "var(--accent)",
                  border: "1px solid oklch(0.72 0.2 300 / 0.3)", borderRadius: 5, padding: "2px 7px",
                }}>
                  In Production
                </span>
              </div>
              <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6, margin: "0 0 12px", maxWidth: 600 }}>
                Each outfit = a separate standalone post synced to the same 24-second hook. Josh stands unbothered while officers charge hard behind him — frozen on an invisible treadmill. He turns, smirks, walks away.
              </p>
              <div style={{ display: "flex", gap: 16 }}>
                <Stat label="Outfit clips" value={`${doneCount} / ${OUTFITS.length}`} />
                <Stat label="Audio" value="24-sec hook" />
                <Stat label="Provider" value="Kling v3 (fal.ai)" />
                <Stat label="Format" value="10s · 16:9" />
              </div>
            </div>
          </div>

          {/* Character spec card */}
          <div style={{
            borderRadius: 14, border: "1px solid var(--border)",
            background: "var(--bg-card)", marginBottom: 20, overflow: "hidden",
          }}>
            <button
              onClick={() => setExpandedSpec(s => !s)}
              style={{
                width: "100%", padding: "14px 18px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                background: "transparent", border: "none", cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <User size={15} color="var(--accent)" />
                <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>Character Spec — read before every generation</span>
              </div>
              <ChevronRight size={15} color="var(--text-muted)" style={{ transform: expandedSpec ? "rotate(90deg)" : "none", transition: "transform 0.2s" }} />
            </button>
            {expandedSpec && (
              <div style={{ padding: "0 18px 18px", borderTop: "1px solid var(--border)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 14 }}>
                  <SpecBlock title="Body">
                    6'3" TALL LEAN. Long-limbed. Slender. NOT muscular, NOT thick, NOT bloated. Basketball-player proportions.
                  </SpecBlock>
                  <SpecBlock title="Hair">
                    Long fully red dreadlocks past shoulders.
                  </SpecBlock>
                  <SpecBlock title="Tattoos — EXACT (arm-only)" accent>
                    <b>Right shoulder:</b> "NBA" with stars + "JOSH" gothic<br />
                    <b>Left shoulder:</b> portrait of young Black male face (low-cut Afro)<br />
                    <b>Both forearms:</b> full sleeves — clouds, roses, stars<br />
                    <b style={{ color: "#ef4444" }}>ZERO tattoos on face, neck, chest, or legs</b>
                  </SpecBlock>
                  <SpecBlock title="Jewellery (every outfit)">
                    Diamond "NBA JOSH 444" pendant on heavy Cuban link chain + iced-out AP diamond watch (left wrist)
                  </SpecBlock>
                  <SpecBlock title="Prop (every scene)">
                    Vintage silver retro hanging microphone — dangles from above, always visible.
                  </SpecBlock>
                  <SpecBlock title="Officers">
                    4–6 in full uniform. Maximum aggression. Frozen on invisible treadmill — running hard, going nowhere. Collapse at end.
                  </SpecBlock>
                </div>

                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
                    Known AI drift — corrections to add every time
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {CORRECTIONS.map((c, i) => (
                      <div key={i} style={{
                        display: "grid", gridTemplateColumns: "160px 1fr", gap: 10, alignItems: "start",
                        padding: "9px 12px", borderRadius: 9, background: "var(--bg)",
                        border: "1px solid var(--border)", fontSize: 12,
                      }}>
                        <span style={{ fontWeight: 600, color: "#f59e0b" }}>{c.issue}</span>
                        <span style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>{c.fix}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Outfit tracker */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Shirt size={15} color="var(--accent)" />
              <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>Outfit Tracker</span>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>— each = separate standalone post</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {OUTFITS.map(o => (
                <div
                  key={o.id}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 12,
                    padding: "13px 16px", borderRadius: 12,
                    border: `1px solid ${o.status === "ready" ? "oklch(0.72 0.2 300 / 0.3)" : "var(--border)"}`,
                    background: o.status === "ready" ? "oklch(0.72 0.2 300 / 0.05)" : "var(--bg-card)",
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

            <Section num={2} label="Generate video">
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.5, margin: 0 }}>
                      Polling HeyGen every 5s · typically 60–120s
                    </p>
                    {elapsed >= POLL_WARN_MS / 1000 && (
                      <div style={{
                        borderRadius: 10, border: "1px solid #f59e0b55",
                        background: "rgba(245,158,11,0.08)",
                        padding: "10px 14px", textAlign: "center",
                      }}>
                        <p style={{ fontSize: 12, color: "#f59e0b", margin: 0, fontWeight: 600 }}>
                          Taking longer than usual — HeyGen may be under load.
                        </p>
                        <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "4px 0 0" }}>
                          Will auto-cancel at 10 min. Your credits are reserved and safe.
                        </p>
                      </div>
                    )}
                    <button
                      onClick={resetToIdle}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        padding: "11px 20px", borderRadius: 12, fontWeight: 600, fontSize: 13,
                        background: "rgba(239,68,68,0.10)",
                        border: "1px solid rgba(239,68,68,0.35)",
                        color: "#ef4444", cursor: "pointer", transition: "all 0.15s",
                      }}
                    >
                      <X size={14} /> Cancel — stop waiting
                    </button>
                  </div>
                )}
              </div>
            </Section>

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
      )}

      {/* ── HISTORY VIEW ── */}
      {view === "history" && (
        <div style={{ flex: 1, maxWidth: 1000, margin: "0 auto", width: "100%", padding: "28px 20px" }}>
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
                Generate your first video
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
                      ) : Date.now() - new Date(g.created_at).getTime() > STALE_JOB_MS ? (
                        <>
                          <Clock size={28} style={{ color: "#f59e0b" }} />
                          <div style={{ fontSize: 13, color: "#f59e0b", textAlign: "center", padding: "0 16px", fontWeight: 600 }}>
                            Timed out — HeyGen didn't respond
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", padding: "0 20px" }}>
                            Credits were not charged. Try again from Studio.
                          </div>
                        </>
                      ) : (
                        <>
                          <Loader2 size={28} style={{ color: "var(--accent)", animation: "spin 1s linear infinite" }} />
                          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                            {g.status === "pending" ? "Queued…" : "Rendering…"}
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

      {/* ── PHOTOS VIEW ── */}
      {view === "photos" && (
        <div style={{ flex: 1, maxWidth: 1100, margin: "0 auto", width: "100%", padding: "28px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text)", marginBottom: 4 }}>
                Studio Photos
              </div>
              <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
                Your Aurora-generated images — click any to use as video reference
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {refPhoto && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "7px 12px", borderRadius: 9,
                  background: "oklch(0.72 0.2 300 / 0.1)",
                  border: "1px solid oklch(0.72 0.2 300 / 0.3)",
                }}>
                  <img src={refPhoto.result_image_url} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: "cover" }} />
                  <span style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>Pinned as reference</span>
                  <button
                    onClick={() => setRefPhoto(null)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0, display: "flex" }}
                  >
                    <X size={13} />
                  </button>
                </div>
              )}
              <button
                onClick={() => { setLoadingPhotos(true); void fetchPhotos(); }}
                style={{
                  padding: "7px 14px", background: "transparent", border: "1px solid var(--border)",
                  borderRadius: 8, color: "var(--text-muted)", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6, fontSize: 13,
                }}
              >
                <RotateCcw size={13} /> Refresh
              </button>
            </div>
          </div>

          {refPhoto && (
            <div style={{
              marginBottom: 20, padding: "14px 16px", borderRadius: 12,
              background: "oklch(0.72 0.2 300 / 0.06)", border: "1px solid oklch(0.72 0.2 300 / 0.2)",
              display: "flex", alignItems: "center", gap: 14,
            }}>
              <img
                src={refPhoto.result_image_url}
                alt="Reference"
                style={{ width: 72, height: 72, borderRadius: 10, objectFit: "cover", flexShrink: 0, border: "1px solid oklch(0.72 0.2 300 / 0.3)" }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--accent)", marginBottom: 4 }}>
                  Active Reference Photo
                </div>
                <p style={{ fontSize: 12, color: "var(--text)", margin: "0 0 8px", lineHeight: 1.5 }}>
                  {refPhoto.prompt.slice(0, 120)}{refPhoto.prompt.length > 120 ? "…" : ""}
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(refPhoto.result_image_url).then(() => {
                        setCopiedId(refPhoto.id);
                        setTimeout(() => setCopiedId(null), 2000);
                      });
                    }}
                    style={{
                      display: "flex", alignItems: "center", gap: 5,
                      padding: "5px 11px", borderRadius: 7, fontSize: 12, fontWeight: 600,
                      background: "transparent", border: "1px solid var(--border)",
                      color: "var(--text-muted)", cursor: "pointer",
                    }}
                  >
                    {copiedId === refPhoto.id ? <><Check size={11} /> Copied!</> : <><Copy size={11} /> Copy URL</>}
                  </button>
                  <button
                    onClick={() => { setRefPhoto(null); setView("studio"); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 5,
                      padding: "5px 11px", borderRadius: 7, fontSize: 12, fontWeight: 600,
                      background: "oklch(0.72 0.2 300 / 0.12)", border: "1px solid oklch(0.72 0.2 300 / 0.3)",
                      color: "var(--accent)", cursor: "pointer",
                    }}
                  >
                    <Video size={11} /> Use in Studio →
                  </button>
                </div>
              </div>
            </div>
          )}

          {loadingPhotos ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "var(--text-muted)", gap: 8 }}>
              <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> Loading your Aurora photos…
            </div>
          ) : photos.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 320, gap: 14, color: "var(--text-muted)" }}>
              <Images size={52} style={{ opacity: 0.2 }} />
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>No photos yet</div>
              <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", margin: 0, maxWidth: 340, lineHeight: 1.6 }}>
                Generate images in the main Aurora Studio and they'll appear here automatically — same account, same library.
              </p>
              <a
                href="/"
                style={{
                  padding: "10px 22px", background: "var(--accent)", border: "none",
                  borderRadius: 10, color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer",
                  textDecoration: "none", display: "inline-block",
                }}
              >
                Open Aurora Studio →
              </a>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
              {photos.map(p => {
                const isRef = refPhoto?.id === p.id;
                const isCopied = copiedId === p.id;
                return (
                  <div
                    key={p.id}
                    style={{
                      borderRadius: 12, overflow: "hidden",
                      border: `1px solid ${isRef ? "oklch(0.72 0.2 300 / 0.6)" : "var(--border)"}`,
                      background: "var(--bg-card)",
                      boxShadow: isRef ? "0 0 0 2px oklch(0.72 0.2 300 / 0.25)" : "none",
                      transition: "box-shadow 0.15s",
                      cursor: "pointer",
                      position: "relative",
                    }}
                    onClick={() => setRefPhoto(isRef ? null : p)}
                  >
                    <div style={{ position: "relative", aspectRatio: "1", background: "var(--bg)" }}>
                      <img
                        src={p.result_image_url}
                        alt={p.prompt}
                        loading="lazy"
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      />
                      {isRef && (
                        <div style={{
                          position: "absolute", top: 8, right: 8,
                          width: 22, height: 22, borderRadius: "50%",
                          background: "oklch(0.72 0.2 300)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <Check size={12} color="#fff" />
                        </div>
                      )}
                      <div style={{
                        position: "absolute", inset: 0,
                        background: "linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 50%)",
                        opacity: 0,
                        transition: "opacity 0.2s",
                        display: "flex", alignItems: "flex-end", padding: 8, gap: 6,
                      }}
                        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = "1")}
                        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = "0")}
                      >
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(p.result_image_url).then(() => {
                              setCopiedId(p.id);
                              toast.success("URL copied");
                              setTimeout(() => setCopiedId(null), 2000);
                            });
                          }}
                          style={{
                            display: "flex", alignItems: "center", gap: 4,
                            padding: "5px 9px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                            background: "rgba(0,0,0,0.7)", border: "1px solid rgba(255,255,255,0.2)",
                            color: "white", cursor: "pointer", backdropFilter: "blur(4px)",
                          }}
                        >
                          {isCopied ? <><Check size={10} /> Copied</> : <><Copy size={10} /> URL</>}
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); setRefPhoto(p); }}
                          style={{
                            display: "flex", alignItems: "center", gap: 4,
                            padding: "5px 9px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                            background: isRef ? "oklch(0.72 0.2 300)" : "rgba(0,0,0,0.7)",
                            border: "1px solid rgba(255,255,255,0.2)",
                            color: "white", cursor: "pointer", backdropFilter: "blur(4px)",
                          }}
                        >
                          {isRef ? "✓ Ref" : "Pin ref"}
                        </button>
                      </div>
                    </div>
                    <div style={{ padding: "8px 10px" }}>
                      <p style={{
                        fontSize: 11, color: "var(--text-muted)", margin: 0, lineHeight: 1.4,
                        overflow: "hidden", display: "-webkit-box",
                        WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                      }}>
                        {p.prompt}
                      </p>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
                        <span style={{ fontSize: 10, color: "var(--text-muted)", opacity: 0.6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          {p.kind}
                        </span>
                        <span style={{ fontSize: 10, color: "var(--text-muted)", opacity: 0.6 }}>
                          {new Date(p.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
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
          fontSize: 12, fontWeight: 800, color: "var(--accent)",
        }}>
          {num}
        </span>
        <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{label}</span>
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{value}</div>
    </div>
  );
}

function SpecBlock({ title, children, accent }: { title: string; children: React.ReactNode; accent?: boolean }) {
  return (
    <div style={{
      padding: "12px 14px", borderRadius: 10,
      background: "var(--bg)",
      border: `1px solid ${accent ? "oklch(0.72 0.2 300 / 0.2)" : "var(--border)"}`,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: accent ? "var(--accent)" : "var(--text-muted)", marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}
