import { useState, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  Camera, ChevronRight, Download, ImagePlus,
  Loader2, LogOut, Sparkles, X,
} from "lucide-react";

type JobStatus = "processing" | "completed" | "failed";
interface Generation {
  id: string;
  lookLabel: string;
  status: JobStatus;
  result_image_url: string | null;
  created_at: string;
  error: string | null;
}

// ── Looks ─────────────────────────────────────────────────────────────────────
const LOOKS = [
  { id: "boudoir",  label: "Boudoir",      swatch: "from-rose-700 to-rose-950",
    prompt: "Magazine-grade boudoir editorial portrait — luxurious silk sheets, soft morning window light, warm amber glow, intimate but tasteful composition. Preserve facial likeness exactly. ARRI cinema look, 85mm f/1.4, 8K ultra-HD." },
  { id: "velvet",  label: "Velvet",        swatch: "from-violet-700 to-violet-950",
    prompt: "Cinematic editorial portrait in deep velvet surroundings — velvet chaise, rich jewel-tone colors, atmospheric side lighting, dramatic shadows, editorial fashion look. Preserve facial likeness. 50mm anamorphic, 8K ultra-HD." },
  { id: "golden",  label: "Golden Hour",   swatch: "from-amber-600 to-amber-950",
    prompt: "Golden hour outdoor editorial — warm backlit rim light, soft bokeh background, glowing skin, sun-kissed look. Preserve facial likeness exactly. 85mm shallow DOF, 8K ultra-HD cinematic." },
  { id: "neon",    label: "Neon",          swatch: "from-fuchsia-600 to-pink-950",
    prompt: "Moody neon-lit editorial portrait — Blade Runner color palette with magenta and cyan gels, atmospheric haze, wet reflections. Preserve facial likeness. 35mm anamorphic, 8K ultra-HD." },
  { id: "luxury",  label: "Luxury Suite",  swatch: "from-stone-600 to-stone-950",
    prompt: "Five-star hotel suite editorial — marble surfaces, designer furnishings, warm chandelier light, aspirational editorial look. Preserve facial likeness exactly. 50mm, 8K ultra-HD." },
  { id: "noir",    label: "Noir",          swatch: "from-gray-600 to-gray-950",
    prompt: "Classic film noir editorial portrait — high contrast black and white, single hard spotlight, venetian blind shadow patterns, old Hollywood glamour. Preserve facial likeness. 50mm, 8K ultra-HD." },
  { id: "ethereal",label: "Ethereal",      swatch: "from-purple-600 to-indigo-950",
    prompt: "Ethereal high-key editorial portrait — soft diffused light, dreamy atmosphere, white and cream tones, delicate shadows, angelic editorial look. Preserve facial likeness exactly. 85mm f/1.2, 8K ultra-HD." },
  { id: "power",   label: "Power",         swatch: "from-red-600 to-red-950",
    prompt: "Bold power editorial portrait — strong directional dramatic lighting, high contrast, confident pose framing, fashion magazine cover quality. Preserve facial likeness. 50mm, 8K ultra-HD." },
] as const;

type LookId = (typeof LOOKS)[number]["id"];

function download(url: string, name: string) {
  fetch(url).then(r => r.blob()).then(blob => {
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  }).catch(() => window.open(url, "_blank"));
}

/** Upload a file to the shared studio bucket and return its public https:// URL.
 *  data: URLs are rejected by /api/public/generate's URL-guard; storage URLs work. */
async function uploadRefPhoto(file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `adult-studio/ref/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("studio")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  const { data } = supabase.storage.from("studio").getPublicUrl(path);
  return data.publicUrl;
}

function signOut() {
  try { sessionStorage.removeItem("aurora_adult_admin_unlocked"); } catch { /* */ }
  window.location.reload();
}

// ── Component ─────────────────────────────────────────────────────────────────
interface AdultStudioProps { accessToken: string; }
export function AdultStudio({ accessToken }: AdultStudioProps) {
  const [lookId, setLookId] = useState<LookId>("boudoir");
  const [customPrompt, setCustomPrompt] = useState("");
  const [refFiles, setRefFiles] = useState<File[]>([]);
  const [refPreviews, setRefPreviews] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const look = LOOKS.find(l => l.id === lookId) ?? LOOKS[0];
  const activeCount = generations.filter(g => g.status === "processing").length;

  function addFiles(files: FileList | null) {
    if (!files) return;
    const next = [...refFiles, ...Array.from(files)].slice(0, 2);
    setRefFiles(next);
    setRefPreviews(next.map(f => URL.createObjectURL(f)));
  }

  function removeFile(i: number) {
    const nf = refFiles.filter((_, idx) => idx !== i);
    setRefFiles(nf);
    setRefPreviews(nf.map(f => URL.createObjectURL(f)));
  }

  async function generate() {
    if (refFiles.length === 0) { toast.error("Upload at least one face photo first"); return; }
    setGenerating(true);

    const id = `gen-${Date.now()}`;
    setGenerations(prev => [{
      id, lookLabel: look.label, status: "processing",
      result_image_url: null, created_at: new Date().toISOString(), error: null,
    }, ...prev]);

    try {
      // Upload ref photos to storage to get https:// URLs that pass URL-guard.
      const imageUrls = await Promise.all(refFiles.map(uploadRefPhoto));
      const extra = customPrompt.trim() ? ` Additional details: ${customPrompt.trim()}.` : "";
      const prompt =
        "Use the uploaded face photo as strict identity reference — keep facial likeness, skin tone, " +
        "and hairstyle EXACTLY the same. " + look.prompt + extra +
        " Hyper-realistic photography, ultra-HD 8K, lifelike skin texture, physically accurate lighting, no CGI.";

      const res = await fetch(`/api/public/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ kind: "image", prompt, imageUrls }),
      });
      const data: unknown = await res.json();
      if (!res.ok) throw new Error((data as { error?: string })?.error ?? "Generation failed");

      // The /api/public/generate endpoint returns `url` (plus metadata).
      const resultUrl = (data as { url?: string })?.url ?? null;
      setGenerations(prev => prev.map(g => g.id === id
        ? { ...g, status: resultUrl ? "completed" : "failed", result_image_url: resultUrl,
            error: resultUrl ? null : "No image returned" }
        : g));
      if (resultUrl) toast.success("Shot ready 🎬");
      else toast.error("Render finished but no image was returned");
    } catch (err) {
      setGenerations(prev => prev.map(g => g.id === id
        ? { ...g, status: "failed", error: err instanceof Error ? err.message : "Failed" }
        : g));
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#050207] text-white antialiased">
      {/* Ambient */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-40 right-0 h-[500px] w-[500px] rounded-full bg-rose-900/10 blur-[120px]" />
        <div className="absolute bottom-0 left-0 h-[350px] w-[350px] rounded-full bg-violet-900/8 blur-[100px]" />
      </div>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 flex h-12 shrink-0 items-center justify-between border-b border-white/6 bg-[#050207]/90 px-5 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 to-rose-800 shadow-[0_0_14px_rgba(225,29,106,0.5)]">
            <Camera size={13} className="text-white" />
          </div>
          <span className="text-[14px] font-black tracking-tight">Adult School</span>
          <span className="rounded-md bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-rose-400 ring-1 ring-rose-500/20">Admin</span>
        </div>

        <div className="flex items-center gap-3">
          {activeCount > 0 && (
            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-rose-400">
              <Loader2 size={11} className="animate-spin" /> {activeCount} rendering
            </span>
          )}
          <button onClick={signOut}
            className="flex items-center gap-1.5 rounded-lg border border-white/8 px-2.5 py-1 text-[11px] text-white/35 transition-colors hover:text-white">
            <LogOut size={11} /> Lock
          </button>
        </div>
      </header>

      {/* ── Two-column body ──────────────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-1 gap-0 overflow-hidden">

        {/* ── LEFT: Controls ──────────────────────────────────────────────── */}
        <aside className="flex w-[340px] shrink-0 flex-col gap-5 overflow-y-auto border-r border-white/6 p-5">

          {/* Look picker */}
          <div>
            <div className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.15em] text-white/35">Look</div>
            <div className="grid grid-cols-4 gap-1.5">
              {LOOKS.map(l => (
                <button key={l.id} onClick={() => setLookId(l.id)}
                  className={`group flex flex-col items-center gap-1.5 rounded-xl border py-2.5 transition-all ${lookId === l.id
                    ? "border-rose-500/50 bg-rose-500/10 shadow-[0_0_12px_rgba(225,29,106,0.15)]"
                    : "border-white/5 bg-white/[0.02] hover:border-white/10"}`}>
                  <div className={`size-5 rounded-md bg-gradient-to-br ${l.swatch}`} />
                  <span className={`text-center text-[9px] font-bold leading-tight ${lookId === l.id ? "text-rose-300" : "text-white/40 group-hover:text-white/60"}`}>
                    {l.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom prompt */}
          <div>
            <div className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.15em] text-white/35">
              Extra details <span className="normal-case tracking-normal font-normal opacity-60">(optional)</span>
            </div>
            <textarea
              value={customPrompt}
              onChange={e => setCustomPrompt(e.target.value)}
              placeholder="Outfit, setting, styling notes…"
              rows={3}
              className="w-full resize-none rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-2.5 text-[13px] text-white placeholder:text-white/20 outline-none focus:border-rose-500/40 focus:ring-1 focus:ring-rose-500/20 transition-all"
            />
          </div>

          {/* Reference photos */}
          <div>
            <div className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.15em] text-white/35">
              Reference photos
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple onChange={e => addFiles(e.target.files)} className="hidden" />

            <div className="flex flex-wrap gap-2.5">
              {refPreviews.map((p, i) => (
                <div key={i} className="group relative size-20 overflow-hidden rounded-xl border border-white/10">
                  <img src={p} alt="" className="size-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-1 left-1 rounded bg-black/70 px-1 py-0.5 text-[7px] font-black uppercase tracking-widest text-white/70">
                    {i === 0 ? "Face" : "Outfit"}
                  </div>
                  <button onClick={() => removeFile(i)}
                    className="absolute right-1 top-1 flex size-4 items-center justify-center rounded bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100">
                    <X size={9} />
                  </button>
                </div>
              ))}

              {refFiles.length < 2 && (
                <button onClick={() => fileRef.current?.click()}
                  className="flex size-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-white/10 text-white/25 transition-colors hover:border-rose-500/40 hover:text-rose-400">
                  <ImagePlus size={18} />
                  <span className="text-[9px] font-semibold">Add</span>
                </button>
              )}
            </div>

            {refFiles.length === 0 && (
              <p className="mt-2 text-[11px] leading-relaxed text-white/25">
                Photo 1 → face (identity lock) · Photo 2 optional → outfit ref
              </p>
            )}
          </div>

          {/* Generate CTA */}
          <button
            onClick={generate}
            disabled={generating || refFiles.length === 0}
            className={`mt-auto flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[14px] font-black tracking-tight transition-all ${generating || refFiles.length === 0
              ? "cursor-not-allowed border border-white/8 bg-white/4 text-white/25"
              : "bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-[0_0_32px_rgba(225,29,106,0.35)] hover:shadow-[0_0_48px_rgba(225,29,106,0.5)] hover:scale-[1.01] active:scale-[0.99]"}`}
          >
            {generating
              ? <><Loader2 size={15} className="animate-spin" /> Queuing…</>
              : <><Sparkles size={15} /> Generate · 1 Aura</>}
          </button>

          <p className="text-center text-[10px] text-white/20">
            🔒 Private · 🛡 Watermarked · ⚡ ~60s
          </p>
        </aside>

        {/* ── RIGHT: Gallery ───────────────────────────────────────────────── */}
        <main className="flex flex-1 flex-col overflow-y-auto p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[13px] font-bold text-white/50 uppercase tracking-widest">
              Session output
            </h2>
            {generations.length > 0 && (
              <span className="text-[11px] text-white/25">{generations.length} shot{generations.length !== 1 ? "s" : ""}</span>
            )}
          </div>

          {generations.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
              <Camera size={44} className="text-white/8" />
              <p className="text-[13px] text-white/25">
                Choose a look, upload a face photo,<br />then hit Generate.
              </p>
              <ChevronRight size={18} className="rotate-180 text-white/15" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {generations.map(g => (
                <div key={g.id} className="group overflow-hidden rounded-2xl border border-white/6 bg-white/[0.02]">
                  {g.result_image_url ? (
                    <div className="relative aspect-[9/16]">
                      <img src={g.result_image_url} alt="" className="size-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                      <button
                        onClick={() => download(g.result_image_url!, `adult-school-${g.id}.jpg`)}
                        className="absolute bottom-2.5 right-2.5 flex items-center gap-1 rounded-lg bg-black/70 px-2.5 py-1 text-[10px] font-semibold text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                        <Download size={9} /> Save
                      </button>
                    </div>
                  ) : (
                    <div className="flex aspect-[9/16] flex-col items-center justify-center gap-2 bg-white/[0.02]">
                      {g.status === "failed"
                        ? <><X size={22} className="text-red-400" /><div className="px-3 text-center text-[10px] text-red-400/80">{g.error ?? "Failed"}</div></>
                        : <><Loader2 size={22} className="animate-spin text-rose-400" /><div className="text-[10px] text-white/35">Rendering…</div></>}
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
    processing: { color: "text-rose-400",  label: "Rendering" },
    completed:  { color: "text-green-400", label: "Done" },
    failed:     { color: "text-red-400",   label: "Failed" },
  };
  const { color, label } = map[status];
  return <span className={`text-[10px] font-bold ${color}`}>{label}</span>;
}
