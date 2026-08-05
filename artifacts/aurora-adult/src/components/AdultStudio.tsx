import { useState, useEffect, useRef, useCallback } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  Camera, Download, EyeOff, ImagePlus, Loader2, Lock,
  LogOut, RefreshCw, ShieldCheck, Sparkles, Star, X,
} from "lucide-react";

interface Props { session: Session | null; }
type JobStatus = "pending" | "processing" | "completed" | "failed";
interface Generation { id: string; prompt: string; status: JobStatus; result_image_url: string | null; created_at: string; error: string | null; }

// ── Looks ────────────────────────────────────────────────────────────────────
const LOOKS = [
  { id: "boudoir",  label: "Boudoir Editorial", accent: "#e11d6a", gradient: "from-rose-950 to-rose-800",
    prompt: "Magazine-grade boudoir editorial portrait — luxurious silk sheets, soft morning window light, warm amber glow, intimate but tasteful composition. Preserve facial likeness exactly. ARRI cinema look, 85mm f/1.4, 8K ultra-HD." },
  { id: "velvet",  label: "Velvet Fantasy",    accent: "#7c3aed", gradient: "from-violet-950 to-violet-800",
    prompt: "Cinematic editorial portrait in deep velvet surroundings — velvet chaise, rich jewel-tone colors, atmospheric side lighting, dramatic shadows, editorial fashion look. Preserve facial likeness. 50mm anamorphic, 8K ultra-HD." },
  { id: "golden",  label: "Golden Hour",       accent: "#b45309", gradient: "from-amber-950 to-amber-800",
    prompt: "Golden hour outdoor editorial — warm backlit rim light, soft bokeh background, glowing skin, sun-kissed look. Preserve facial likeness exactly. 85mm shallow DOF, 8K ultra-HD cinematic." },
  { id: "neon",    label: "Neon Temptation",   accent: "#db2777", gradient: "from-fuchsia-950 to-pink-900",
    prompt: "Moody neon-lit editorial portrait — Blade Runner color palette with magenta and cyan gels, atmospheric haze, wet reflections. Preserve facial likeness. 35mm anamorphic, 8K ultra-HD." },
  { id: "luxury",  label: "Luxury Suite",      accent: "#92400e", gradient: "from-stone-900 to-amber-950",
    prompt: "Five-star hotel suite editorial — marble surfaces, designer furnishings, warm chandelier light, aspirational editorial look. Preserve facial likeness exactly. 50mm, 8K ultra-HD." },
  { id: "noir",    label: "Private Noir",      accent: "#374151", gradient: "from-gray-950 to-gray-800",
    prompt: "Classic film noir editorial portrait — high contrast black and white, single hard spotlight, venetian blind shadow patterns, old Hollywood glamour. Preserve facial likeness. 50mm, 8K ultra-HD." },
  { id: "ethereal",label: "Ethereal Light",    accent: "#6d28d9", gradient: "from-purple-950 to-indigo-900",
    prompt: "Ethereal high-key editorial portrait — soft diffused light, dreamy atmosphere, white and cream tones, delicate shadows, angelic editorial look. Preserve facial likeness exactly. 85mm f/1.2, 8K ultra-HD." },
  { id: "power",   label: "Power Shot",        accent: "#be123c", gradient: "from-red-950 to-rose-900",
    prompt: "Bold power editorial portrait — strong directional dramatic lighting, high contrast, confident pose framing, fashion magazine cover quality. Preserve facial likeness. 50mm, 8K ultra-HD." },
] as const;

type LookId = (typeof LOOKS)[number]["id"];

const TRUST = [
  { icon: EyeOff,      label: "Identity Masking",    desc: "AI face-swap and blur on demand" },
  { icon: Lock,        label: "Private Vault",        desc: "Zero public indexing, ever" },
  { icon: ShieldCheck, label: "Watermark Built-in",   desc: "Brand every frame automatically" },
  { icon: Star,        label: "Subscriber Magnets",   desc: "Magazine-grade editorial looks" },
];

function download(url: string, name: string) {
  fetch(url).then(r => r.blob()).then(blob => {
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  }).catch(() => window.open(url, "_blank"));
}

// ── Component ─────────────────────────────────────────────────────────────────
export function AdultStudio({ session }: Props) {
  const [lookId, setLookId] = useState<LookId>("boudoir");
  const [customPrompt, setCustomPrompt] = useState("");
  const [refFiles, setRefFiles] = useState<File[]>([]);
  const [refPreviews, setRefPreviews] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(true);
  const [view, setView] = useState<"studio" | "gallery">("studio");
  const fileRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const look = LOOKS.find(l => l.id === lookId) ?? LOOKS[0];

  const fetchGallery = useCallback(async () => {
    const { data, error } = await supabase.from("generations").select("id,prompt,status,result_image_url,created_at,error").eq("kind", "image").order("created_at", { ascending: false }).limit(40);
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

  function addFiles(files: FileList | null) {
    if (!files) return;
    const next = [...refFiles, ...Array.from(files)].slice(0, 2);
    setRefFiles(next);
    setRefPreviews(next.map(f => URL.createObjectURL(f)));
  }

  function removeFile(i: number) {
    const nf = refFiles.filter((_, idx) => idx !== i);
    setRefFiles(nf); setRefPreviews(nf.map(f => URL.createObjectURL(f)));
  }

  async function uploadRef(file: File): Promise<string> {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${session?.user.id ?? "anon"}/adult-refs/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("studio").upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    const { data: signed, error: se } = await supabase.storage.from("studio").createSignedUrl(path, 3600);
    if (se || !signed) throw new Error("Could not sign reference image");
    return signed.signedUrl;
  }

  async function generate() {
    if (!session) { toast.error("Sign in to generate"); return; }
    if (refFiles.length === 0) { toast.error("Upload at least one face photo first"); return; }
    setGenerating(true);
    try {
      const imageUrls = await Promise.all(refFiles.map(uploadRef));
      const extra = customPrompt.trim() ? ` Additional details: ${customPrompt.trim()}.` : "";
      const prompt =
        "Use the uploaded face photo as strict identity reference — keep facial likeness, skin tone, and hairstyle EXACTLY the same. " +
        look.prompt + extra +
        " Hyper-realistic photography, ultra-HD 8K, lifelike skin texture, physically accurate lighting, no CGI.";
      const res = await fetch(`/api/public/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
        // No model specified — Aurora's orchestrator picks the best identity-aware provider
        body: JSON.stringify({ kind: "image", prompt, imageUrls }),
      });
      const data: unknown = await res.json();
      if (!res.ok) throw new Error((data as { error?: string })?.error ?? "Generation failed");
      toast.success("Shot queued — rendering now 🎬");
      setView("gallery");
      await fetchGallery();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  const activeCount = generations.filter(g => g.status === "pending" || g.status === "processing").length;

  return (
    <div className="min-h-screen bg-[#050207] text-white antialiased">
      {/* Ambient */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-40 right-0 h-[600px] w-[600px] rounded-full bg-rose-900/10 blur-[120px]" />
        <div className="absolute top-1/2 -left-40 h-[400px] w-[400px] rounded-full bg-violet-900/8 blur-[100px]" />
      </div>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-white/6 bg-[#050207]/80 px-6 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-rose-800 shadow-[0_0_20px_rgba(225,29,106,0.5)]">
            <Camera size={16} className="text-white" />
          </div>
          <div>
            <div className="text-[15px] font-black tracking-tight">Adult School</div>
            <div className="text-[10px] font-semibold text-rose-400">🔞 18+ · Private · Secured</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {activeCount > 0 && (
            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-rose-400">
              <Loader2 size={12} className="animate-spin" /> {activeCount} rendering
            </span>
          )}
          {(["studio", "gallery"] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`rounded-lg px-4 py-1.5 text-[13px] font-semibold capitalize transition-all ${view === v ? "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30" : "text-white/40 hover:text-white"}`}>
              {v}
            </button>
          ))}
          {session && (
            <button onClick={() => supabase.auth.signOut()}
              className="flex items-center gap-1.5 rounded-lg border border-white/8 px-3 py-1.5 text-[12px] text-white/40 hover:text-white transition-colors">
              <LogOut size={12} /> Sign out
            </button>
          )}
        </div>
      </header>

      {view === "studio" ? (
        <div className="relative z-10 mx-auto max-w-4xl px-6 py-10">

          {/* ── Hero ──────────────────────────────────────────────────── */}
          <div className="mb-10">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-rose-500/20 bg-rose-500/8 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-rose-400">
              <span className="size-1.5 rounded-full bg-rose-400 animate-pulse" />
              AI Photoshoot Studio
            </div>
            <h1 className="text-5xl font-black leading-[0.95] tracking-tight sm:text-6xl">
              Your content.<br />
              <span className="bg-gradient-to-r from-rose-400 to-pink-500 bg-clip-text text-transparent">Your control.</span>
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/50">
              AI photoshoots that protect your identity, amplify your brand, and keep subscribers wanting more. No set. No photographer. Complete discretion.
            </p>
          </div>

          {/* ── Trust pills ────────────────────────────────────────────── */}
          <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {TRUST.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="rounded-2xl border border-white/6 bg-white/[0.03] p-4 backdrop-blur-sm">
                <Icon size={16} className="text-rose-400 mb-2.5" />
                <div className="text-[12px] font-bold text-white">{label}</div>
                <div className="mt-1 text-[11px] leading-snug text-white/40">{desc}</div>
              </div>
            ))}
          </div>

          {/* ── Studio card ─────────────────────────────────────────────── */}
          <div className="rounded-3xl border border-white/8 bg-white/[0.025] p-6 backdrop-blur-sm sm:p-8">
            <div className="mb-6 text-[18px] font-black tracking-tight">Create your shoot</div>

            {/* Look picker */}
            <div className="mb-6">
              <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.15em] text-white/40">Choose a look</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {LOOKS.map(l => (
                  <button key={l.id} onClick={() => setLookId(l.id)}
                    className={`relative overflow-hidden rounded-xl border px-3 py-4 text-left transition-all ${lookId === l.id ? "border-rose-500/50 bg-rose-500/12 shadow-[0_0_20px_rgba(225,29,106,0.15)]" : "border-white/6 bg-white/[0.02] hover:border-white/12"}`}>
                    <div className={`mb-2 size-6 rounded-lg bg-gradient-to-br ${l.gradient}`} />
                    <div className={`text-[12px] font-bold ${lookId === l.id ? "text-rose-300" : "text-white/70"}`}>{l.label}</div>
                    {lookId === l.id && (
                      <div className="absolute right-2 top-2 size-2 rounded-full bg-rose-400" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom prompt */}
            <div className="mb-6">
              <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.15em] text-white/40">
                Additional details <span className="normal-case tracking-normal font-normal opacity-60">(optional)</span>
              </div>
              <textarea
                value={customPrompt}
                onChange={e => setCustomPrompt(e.target.value)}
                placeholder="Describe any specific outfit, setting, or styling details…"
                rows={3}
                className="w-full resize-none rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-[14px] text-white placeholder:text-white/25 outline-none focus:border-rose-500/40 focus:ring-1 focus:ring-rose-500/20 transition-all"
              />
            </div>

            {/* Reference upload */}
            <div className="mb-8">
              <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.15em] text-white/40">
                Your photo <span className="normal-case tracking-normal font-normal opacity-60">(up to 2 — face + outfit)</span>
              </div>
              <input ref={fileRef} type="file" accept="image/*" multiple onChange={e => addFiles(e.target.files)} className="hidden" />

              <div className="flex flex-wrap gap-3 items-start">
                {refPreviews.map((p, i) => (
                  <div key={i} className="group relative size-24 overflow-hidden rounded-2xl border border-white/10">
                    <img src={p} alt="" className="size-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-1.5 left-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-white/80">
                      {i === 0 ? "Face" : "Outfit"}
                    </div>
                    <button onClick={() => removeFile(i)}
                      className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-md bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100">
                      <X size={10} />
                    </button>
                  </div>
                ))}

                {refFiles.length < 2 && (
                  <button onClick={() => fileRef.current?.click()}
                    className="flex size-24 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-white/12 text-white/30 transition-colors hover:border-rose-500/40 hover:text-rose-400">
                    <ImagePlus size={22} />
                    <span className="text-[11px] font-semibold">Add photo</span>
                  </button>
                )}

                {refFiles.length === 0 && (
                  <p className="self-center text-[13px] leading-relaxed text-white/35">
                    Photo 1 → face reference for identity lock.<br />
                    Photo 2 (optional) → outfit inspiration.
                  </p>
                )}
              </div>
            </div>

            {/* CTA */}
            <button
              onClick={generate}
              disabled={generating || refFiles.length === 0}
              className={`relative w-full overflow-hidden rounded-2xl py-4 text-[15px] font-black tracking-tight transition-all ${generating || refFiles.length === 0
                ? "cursor-not-allowed border border-white/8 bg-white/4 text-white/25"
                : "bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-[0_0_40px_rgba(225,29,106,0.35)] hover:shadow-[0_0_60px_rgba(225,29,106,0.5)] hover:scale-[1.01] active:scale-[0.99]"}`}
            >
              {generating ? (
                <span className="flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" /> Queuing your shot…</span>
              ) : (
                <span className="flex items-center justify-center gap-2"><Sparkles size={16} /> Generate · 1 Aura</span>
              )}
            </button>

            {/* Privacy footnote */}
            <div className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-1.5">
              {["🔒 Private vault", "🛡 Watermarked", "👁 Identity masking", "⚡ Results in ~60s"].map(t => (
                <span key={t} className="text-[11px] text-white/25">{t}</span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* ── Gallery ──────────────────────────────────────────────────── */
        <div className="relative z-10 mx-auto max-w-5xl px-6 py-10">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-[22px] font-black tracking-tight">Your private gallery</h2>
            <button onClick={() => { setLoadingGallery(true); void fetchGallery(); }}
              className="flex items-center gap-1.5 rounded-xl border border-white/8 px-4 py-2 text-[12px] text-white/50 hover:text-white transition-colors">
              <RefreshCw size={12} /> Refresh
            </button>
          </div>

          {loadingGallery ? (
            <div className="flex h-48 items-center justify-center gap-2 text-white/30">
              <Loader2 size={18} className="animate-spin" /> Loading…
            </div>
          ) : generations.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-4 text-center">
              <Camera size={48} className="text-white/10" />
              <div className="text-[18px] font-bold text-white/70">No shots yet</div>
              <button onClick={() => setView("studio")}
                className="rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 px-6 py-2.5 text-[14px] font-bold text-white shadow-[0_0_20px_rgba(225,29,106,0.3)] hover:scale-[1.02] transition-all">
                Start your first shoot
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {generations.map(g => (
                <div key={g.id} className="group overflow-hidden rounded-2xl border border-white/6 bg-white/[0.02]">
                  {g.result_image_url ? (
                    <div className="relative aspect-[9/16]">
                      <img src={g.result_image_url} alt="" className="size-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                      <button
                        onClick={() => download(g.result_image_url!, `aurora-creator-${g.id}.jpg`)}
                        className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-xl bg-black/70 px-3 py-1.5 text-[11px] font-semibold text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                        <Download size={11} /> Save
                      </button>
                    </div>
                  ) : (
                    <div className="flex aspect-[9/16] flex-col items-center justify-center gap-3 bg-white/[0.02]">
                      {g.status === "failed" ? (
                        <><X size={28} className="text-red-400" /><div className="px-4 text-center text-[12px] text-red-400">{g.error ?? "Render failed"}</div></>
                      ) : (
                        <><Loader2 size={28} className="animate-spin text-rose-400" /><div className="text-[12px] text-white/40">Rendering…</div></>
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-between px-3 py-2.5">
                    <span className="text-[11px] text-white/30">{new Date(g.created_at).toLocaleDateString()}</span>
                    <StatusDot status={g.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: JobStatus }) {
  const map: Record<JobStatus, { color: string; label: string }> = {
    pending:    { color: "text-amber-400",  label: "Queued" },
    processing: { color: "text-rose-400",   label: "Rendering" },
    completed:  { color: "text-green-400",  label: "Done" },
    failed:     { color: "text-red-400",    label: "Failed" },
  };
  const { color, label } = map[status];
  return <span className={`text-[11px] font-bold ${color}`}>{label}</span>;
}
