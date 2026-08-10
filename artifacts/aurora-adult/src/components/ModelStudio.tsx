// Per-model generation studio.
// - The model (identity anchors) is shared — all creators use the same photos.
// - The gallery/history is PRIVATE — scoped to the signed-in user via Supabase RLS.

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, Camera, Download, ImagePlus, Loader2,
  LogOut, Sparkles, X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { LOOKS, type LookId, type Model } from "@/lib/models";
import type { User } from "@supabase/supabase-js";

// ── Types ─────────────────────────────────────────────────────────────────────

type JobStatus = "processing" | "completed" | "failed";

interface GenerationRow {
  id: string;
  lookLabel: string;
  status: JobStatus;
  result_image_url: string | null;
  created_at: string;
  error: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function urlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ── Private history persistence (Supabase, RLS-scoped) ────────────────────────

/** Persist a completed generation to the user's private history. */
/** Load the signed-in user's private history for a specific model. */
async function loadHistory(userId: string, modelId: string): Promise<GenerationRow[]> {
  const { data, error } = await supabase
    .from("generations")
    .select("id, prompt, model, status, result_image_url, created_at")
    .eq("user_id", userId)
    .like("model", `adult-school/${modelId}%`)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.warn("[adult-school] loadHistory:", error.message);
    return [];
  }

  return (data ?? []).map((row: Record<string, unknown>) => {
    // The look id is encoded server-side in the model column as
    // adult-school/<modelId>/<lookId>; fall back to a prompt scan for
    // rows written before that convention.
    const modelStr = String(row.model ?? "");
    const lookId = modelStr.split("/")[2];
    const promptStr = String(row.prompt ?? "");
    const lookMatch =
      LOOKS.find((l) => l.id === lookId) ??
      LOOKS.find((l) => promptStr.toLowerCase().includes(l.label.toLowerCase()));
    return {
      id: String(row.id),
      lookLabel: lookMatch?.label ?? "Shot",
      // The authoritative server row uses "succeeded"; older client-written
      // rows used "completed". Treat both as success.
      status: row.status === "succeeded" || row.status === "completed" ? "completed" : "failed",
      result_image_url: row.result_image_url ? String(row.result_image_url) : null,
      created_at: String(row.created_at ?? ""),
      error: null,
    } satisfies GenerationRow;
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  model: Model;
  user: User;
  onBack: () => void;
}

export function ModelStudio({ model, user, onBack }: Props) {
  const [lookId, setLookId] = useState<LookId>("boudoir");
  const [customPrompt, setCustomPrompt] = useState("");
  const [extraFiles, setExtraFiles] = useState<File[]>([]);
  const [extraPreviews, setExtraPreviews] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generations, setGenerations] = useState<GenerationRow[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const look = LOOKS.find((l) => l.id === lookId) ?? LOOKS[0];
  const activeCount = generations.filter((g) => g.status === "processing").length;

  // Load the user's private history for this model on mount.
  useEffect(() => {
    loadHistory(user.id, model.id).then((rows) => {
      setGenerations(rows);
      setHistoryLoaded(true);
    });
  }, [user.id, model.id]);

  function addExtraFiles(files: FileList | null) {
    if (!files) return;
    const next = [...extraFiles, ...Array.from(files)].slice(0, 1); // 1 outfit/style ref max
    setExtraFiles(next);
    setExtraPreviews(next.map((f) => URL.createObjectURL(f)));
  }

  function removeExtraFile() {
    setExtraFiles([]);
    setExtraPreviews([]);
  }

  async function generate() {
    setGenerating(true);
    const tempId = `gen-${Date.now()}`;

    setGenerations((prev) => [
      {
        id: tempId,
        lookLabel: look.label,
        status: "processing",
        result_image_url: null,
        created_at: new Date().toISOString(),
        error: null,
      },
      ...prev,
    ]);

    try {
      // Identity anchors: always include the model's own reference photos,
      // plus any optional extra reference the creator uploaded.
      const presetDataUrls = await Promise.all(model.photos.map(urlToDataUrl));
      const extraDataUrls = await Promise.all(extraFiles.map(fileToDataUrl));
      const base64Images = [...presetDataUrls, ...extraDataUrls];

      const extra = customPrompt.trim() ? ` Additional details: ${customPrompt.trim()}.` : "";
      const prompt =
        `Use the uploaded face photo as strict identity reference — keep facial likeness, skin tone, ` +
        `and hairstyle EXACTLY the same. ${look.prompt}${extra} ` +
        `Hyper-realistic photography, ultra-HD 8K, lifelike skin texture, physically accurate lighting, no CGI.`;

      // Authenticate as the signed-in creator — the endpoint verifies this
      // Supabase session JWT server-side and charges the creator's own
      // account. No privileged credential ever reaches the browser bundle.
      const { data: sessionData } = await supabase.auth.getSession();
      const sessionToken = sessionData.session?.access_token;
      if (!sessionToken) throw new Error("Session expired — sign in again");

      const res = await fetch(`/api/adult-admin/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          kind: "image",
          prompt,
          base64Images,
          editStrict: true,
          // Server tags the authoritative generations row with these so the
          // private gallery filters by model and recovers the look on reload.
          historyModelId: model.id,
          historyLookId: lookId,
        }),
      });

      const data: unknown = await res.json();
      if (!res.ok) throw new Error((data as { error?: string })?.error ?? "Generation failed");

      const resultUrl = (data as { url?: string })?.url ?? null;

      if (resultUrl) {
        // Update in-memory state.
        setGenerations((prev) =>
          prev.map((g) =>
            g.id === tempId
              ? { ...g, status: "completed", result_image_url: resultUrl, error: null }
              : g,
          ),
        );
        // No client-side insert: the server already recorded the single
        // authoritative generations row (tagged adult-school/<model>/<look>).
        toast.success("Shot ready 🎬");
      } else {
        setGenerations((prev) =>
          prev.map((g) =>
            g.id === tempId
              ? { ...g, status: "failed", error: "No image returned" }
              : g,
          ),
        );
        toast.error("Render finished but no image was returned");
      }
    } catch (err) {
      setGenerations((prev) =>
        prev.map((g) =>
          g.id === tempId
            ? { ...g, status: "failed", error: err instanceof Error ? err.message : "Failed" }
            : g,
        ),
      );
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#050207] text-white antialiased">
      {/* Ambient */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-40 right-0 h-[500px] w-[500px] rounded-full bg-rose-900/10 blur-[120px]" />
        <div className="absolute bottom-0 left-0 h-[350px] w-[350px] rounded-full bg-violet-900/8 blur-[100px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 flex h-12 shrink-0 items-center justify-between border-b border-white/6 bg-[#050207]/90 px-5 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-lg border border-white/8 px-2.5 py-1 text-[11px] text-white/35 transition-colors hover:text-white"
          >
            <ArrowLeft size={11} /> Models
          </button>
          <div className="flex items-center gap-2">
            <img
              src={model.cover}
              alt={model.name}
              className="size-6 rounded-full object-cover object-top border border-white/10"
            />
            <span className="text-[13px] font-bold text-white">{model.name}</span>
            <span className="text-[11px] text-white/30">{model.niche}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {activeCount > 0 && (
            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-rose-400">
              <Loader2 size={11} className="animate-spin" /> {activeCount} rendering
            </span>
          )}
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 rounded-lg border border-white/8 px-2.5 py-1 text-[11px] text-white/35 transition-colors hover:text-white"
          >
            <LogOut size={11} /> Sign out
          </button>
        </div>
      </header>

      {/* Two-column body */}
      <div className="relative z-10 flex flex-1 gap-0 overflow-hidden">

        {/* LEFT: Controls */}
        <aside className="flex w-[300px] shrink-0 flex-col gap-5 overflow-y-auto border-r border-white/6 p-5">

          {/* Model identity preview */}
          <div className="flex items-center gap-3 rounded-xl border border-rose-500/20 bg-rose-500/8 px-3 py-2.5">
            <div className="flex gap-1.5 shrink-0">
              {model.photos.slice(0, 2).map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt={`${model.name} ref ${i + 1}`}
                  className="size-9 rounded-lg object-cover object-top border border-white/10"
                />
              ))}
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-white">{model.name}</p>
              <p className="text-[10px] text-rose-400/70">Identity locked · {model.photos.length} ref{model.photos.length !== 1 ? "s" : ""}</p>
            </div>
          </div>

          {/* Look picker */}
          <div>
            <div className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.15em] text-white/35">Look</div>
            <div className="grid grid-cols-4 gap-1.5">
              {LOOKS.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setLookId(l.id)}
                  className={`group flex flex-col items-center gap-1.5 rounded-xl border py-2.5 transition-all ${
                    lookId === l.id
                      ? "border-rose-500/50 bg-rose-500/10 shadow-[0_0_12px_rgba(225,29,106,0.15)]"
                      : "border-white/5 bg-white/[0.02] hover:border-white/10"
                  }`}
                >
                  <div className={`size-5 rounded-md bg-gradient-to-br ${l.swatch}`} />
                  <span
                    className={`text-center text-[9px] font-bold leading-tight ${
                      lookId === l.id ? "text-rose-300" : "text-white/40 group-hover:text-white/60"
                    }`}
                  >
                    {l.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Optional style reference upload */}
          <div>
            <div className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.15em] text-white/35">
              Style reference{" "}
              <span className="normal-case tracking-normal font-normal opacity-60">(optional)</span>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={(e) => addExtraFiles(e.target.files)}
              className="hidden"
            />
            <div className="flex flex-wrap gap-2.5">
              {extraPreviews.map((p, i) => (
                <div key={i} className="group relative size-20 overflow-hidden rounded-xl border border-white/10">
                  <img src={p} alt="" className="size-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-1 left-1 rounded bg-black/70 px-1 py-0.5 text-[7px] font-black uppercase tracking-widest text-white/70">
                    Outfit
                  </div>
                  <button
                    onClick={removeExtraFile}
                    className="absolute right-1 top-1 flex size-4 items-center justify-center rounded bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <X size={9} />
                  </button>
                </div>
              ))}
              {extraFiles.length === 0 && (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex size-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-white/10 text-white/25 transition-colors hover:border-rose-500/40 hover:text-rose-400"
                >
                  <ImagePlus size={18} />
                  <span className="text-[9px] font-semibold">Outfit</span>
                </button>
              )}
            </div>
            <p className="mt-2 text-[10px] text-white/20">
              Upload an outfit or setting reference to override the look
            </p>
          </div>

          {/* Custom prompt */}
          <div>
            <div className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.15em] text-white/35">
              Extra details{" "}
              <span className="normal-case tracking-normal font-normal opacity-60">(optional)</span>
            </div>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Outfit details, setting notes, styling instructions…"
              rows={3}
              className="w-full resize-none rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-2.5 text-[13px] text-white placeholder:text-white/20 outline-none focus:border-rose-500/40 focus:ring-1 focus:ring-rose-500/20 transition-all"
            />
          </div>

          {/* Generate CTA */}
          <button
            onClick={generate}
            disabled={generating}
            className={`mt-auto flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[14px] font-black tracking-tight transition-all ${
              generating
                ? "cursor-not-allowed border border-white/8 bg-white/4 text-white/25"
                : "bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-[0_0_32px_rgba(225,29,106,0.35)] hover:shadow-[0_0_48px_rgba(225,29,106,0.5)] hover:scale-[1.01] active:scale-[0.99]"
            }`}
          >
            {generating ? (
              <>
                <Loader2 size={15} className="animate-spin" /> Rendering…
              </>
            ) : (
              <>
                <Sparkles size={15} /> Generate · 1 Aura
              </>
            )}
          </button>

          <p className="text-center text-[10px] text-white/20">
            🔒 Private to you · 🛡 Watermarked · ⚡ ~60s
          </p>
        </aside>

        {/* RIGHT: Private gallery */}
        <main className="flex flex-1 flex-col overflow-y-auto p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-[13px] font-bold uppercase tracking-widest text-white/50">
                Your gallery — {model.name}
              </h2>
              <p className="mt-0.5 text-[10px] text-white/25">
                Only visible to you · {generations.filter((g) => g.status === "completed").length} shot
                {generations.filter((g) => g.status === "completed").length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {!historyLoaded ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 size={20} className="animate-spin text-rose-400/50" />
            </div>
          ) : generations.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
              <Camera size={44} className="text-white/8" />
              <p className="text-[13px] text-white/25">
                Choose a look and hit Generate to create your first shot.
                <br />
                Everything you generate here is private to your account.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {generations.map((g) => (
                <div
                  key={g.id}
                  className="group overflow-hidden rounded-2xl border border-white/6 bg-white/[0.02]"
                >
                  {g.result_image_url ? (
                    <div className="relative aspect-[9/16]">
                      <img src={g.result_image_url} alt="" className="size-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                      <button
                        onClick={() =>
                          download(g.result_image_url!, `adult-school-${model.id}-${g.id}.jpg`)
                        }
                        className="absolute bottom-2.5 right-2.5 flex items-center gap-1 rounded-lg bg-black/70 px-2.5 py-1 text-[10px] font-semibold text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100"
                      >
                        <Download size={9} /> Save
                      </button>
                    </div>
                  ) : (
                    <div className="flex aspect-[9/16] flex-col items-center justify-center gap-2 bg-white/[0.02]">
                      {g.status === "failed" ? (
                        <>
                          <X size={22} className="text-red-400" />
                          <div className="px-3 text-center text-[10px] text-red-400/80">
                            {g.error ?? "Failed"}
                          </div>
                        </>
                      ) : (
                        <>
                          <Loader2 size={22} className="animate-spin text-rose-400" />
                          <div className="text-[10px] text-white/35">Rendering…</div>
                        </>
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-between px-2.5 py-2">
                    <span className="text-[10px] font-semibold text-white/30">{g.lookLabel}</span>
                    <StatusDot status={g.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: JobStatus }) {
  const map: Record<JobStatus, { color: string; label: string }> = {
    processing: { color: "text-rose-400", label: "Rendering" },
    completed: { color: "text-green-400", label: "Done" },
    failed: { color: "text-red-400", label: "Failed" },
  };
  const { color, label } = map[status];
  return <span className={`text-[10px] font-bold ${color}`}>{label}</span>;
}
