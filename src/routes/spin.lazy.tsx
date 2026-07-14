import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Flame, Loader2, Check, Sparkles, ArrowLeft, User, AlertCircle, Image as ImageIcon, Video, Mic, Package, X, Film, ChevronDown, ChevronUp, Download } from "lucide-react";
import { getSpinOptions, spinThirty, getSpinJob, tickSpinJob } from "@/lib/spin.functions";
import {
  listAuroraTemplates,
  generateAuroraTemplateVideo,
  AURORA_TEMPLATE_MODEL,
  type AuroraTemplateRow,
} from "@/lib/aurora-templates.functions";
import { computeCost } from "@/lib/pricing";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  SPIN_COUNT,
  SPIN_PIECE_COST,
  SPIN_VIDEO_PIECE_COST,
  SPIN_VIDEO_DURATION_SECONDS,
  SPIN_TEMPLATES,
  type SpinMode,
  type SpinSpec,
  type SpinTemplate,
  type SpinTemplateId,
} from "@/lib/spin-engine";

export const Route = createLazyFileRoute("/spin")({ component: SpinPage });

type Variant = {
  id: string;
  idx: number;
  label: string;
  status: "queued" | "running" | "done" | "error";
  url: string | null;
  spec: SpinSpec | null;
  kind: "image" | "video";
};

type AvatarOption = { id: string; name: string; previewUrl: string | null };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Fetch → Blob → objectURL so the browser actually saves the file even when
// the image lives in a cross-origin bucket (a plain <a download> is silently
// ignored for cross-origin URLs). Caller should .catch() and surface a toast.
async function downloadVariant(url: string, idx: number, kind: "image" | "video") {
  const ext = kind === "video" ? "mp4" : "jpg";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = `spin-${idx + 1}.${ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
}

function toVariant(v: {
  id: string;
  idx: number;
  label: string;
  status: string;
  url: string | null;
  spec: unknown;
  kind?: string | null;
}): Variant {
  return {
    id: v.id,
    idx: v.idx,
    label: v.label,
    status: (["queued", "running", "done", "error"].includes(v.status) ? v.status : "queued") as Variant["status"],
    url: v.url,
    spec: (v.spec as SpinSpec | null) ?? null,
    kind: v.kind === "video" ? "video" : "image",
  };
}

function SpinPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const optionsFn = useServerFn(getSpinOptions);
  const startFn = useServerFn(spinThirty);
  const getJobFn = useServerFn(getSpinJob);
  const tickFn = useServerFn(tickSpinJob);

  const { user } = useAuth();

  const [prompt, setPrompt] = useState(search.prompt ?? "");
  const [avatars, setAvatars] = useState<AvatarOption[]>([]);
  const [avatarId, setAvatarId] = useState<string | undefined>(undefined);
  const [templates, setTemplates] = useState<SpinTemplate[]>(SPIN_TEMPLATES);
  const [templateId, setTemplateId] = useState<SpinTemplateId>("default");
  const [jobId, setJobId] = useState<string | null>(search.jobId ?? null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [busy, setBusy] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Video Mode (Product Showcase only): the same avatar holds YOUR product and
  // SPEAKS a short script — 30 talking clips instead of 30 stills. Reset back
  // to photo mode whenever the template changes away from product_showcase so
  // it's impossible to submit an invalid (mode=video, template≠showcase) pair.
  const [mode, setMode] = useState<SpinMode>("photo");
  const [script, setScript] = useState("");
  const [productUrl, setProductUrl] = useState<string | null>(null);
  const [productUploading, setProductUploading] = useState(false);
  const productInputRef = useRef<HTMLInputElement>(null);

  // Reference photo: upload a face and Spin locks that identity across all
  // 30 posts directly — no separate "create an avatar" step required.
  const [faceUrl, setFaceUrl] = useState<string | null>(null);
  const [faceUploading, setFaceUploading] = useState(false);
  const faceInputRef = useRef<HTMLInputElement>(null);

  // ── HeyGen Template ────────────────────────────────────────────────────
  const [heygenOpen, setHeygenOpen] = useState(false);
  const [selectedHeygenTplId, setSelectedHeygenTplId] = useState<string>("");
  const [heygenPhotoUrl, setHeygenPhotoUrl] = useState<string>("");
  const [heygenResult, setHeygenResult] = useState<{ url: string } | null>(null);
  const listAuroraTemplatesFn = useServerFn(listAuroraTemplates);
  const generateTplFn = useServerFn(generateAuroraTemplateVideo);
  const HEYGEN_COST = computeCost({ features: ["video"], model: AURORA_TEMPLATE_MODEL }).total;
  const heygenTplQuery = useQuery({
    queryKey: ["aurora-templates-spin"],
    enabled: !!user && heygenOpen,
    queryFn: () => listAuroraTemplatesFn(),
  });
  const heygenTpls = (heygenTplQuery.data ?? []) as AuroraTemplateRow[];
  const heygenMut = useMutation({
    mutationFn: async () => {
      if (!selectedHeygenTplId) throw new Error("Pick a template");
      const tpl = heygenTpls.find((t) => t.id === selectedHeygenTplId);
      if (!tpl) throw new Error("Template not found");
      const photo = heygenPhotoUrl.trim() || faceUrl;
      if (!photo) throw new Error("Upload a reference photo above or paste a photo URL");
      const res = await generateTplFn({
        data: {
          auroraTemplateId: selectedHeygenTplId,
          character: {
            name: tpl.character_variable_key,
            type: "character" as const,
            properties: { type: "talking_photo", character_id: photo },
          },
        },
      });
      if (!res.ok) throw new Error(res.error ?? "Generation failed");
      return res;
    },
    onSuccess: (res) => {
      if (res.ok) {
        setHeygenResult({ url: res.url });
        toast.success("HeyGen video ready!");
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Generation failed"),
  });

  const drivingRef = useRef(false);
  const autoStartedRef = useRef(false);

  const uploadFace = useCallback(
    async (file: File) => {
      if (!user) {
        setErr("Sign in to upload a reference photo.");
        return;
      }
      setFaceUploading(true);
      setErr(null);
      try {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${user.id}/spin/face/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from("studio")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw error;
        const { data } = supabase.storage.from("studio").getPublicUrl(path);
        setFaceUrl(data.publicUrl);
        setAvatarId(undefined); // an uploaded photo takes priority over a saved avatar
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Reference photo upload failed");
      } finally {
        setFaceUploading(false);
      }
    },
    [user],
  );

  const uploadProduct = useCallback(
    async (file: File) => {
      if (!user) {
        setErr("Sign in to upload a product photo.");
        return;
      }
      setProductUploading(true);
      setErr(null);
      try {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${user.id}/spin/product/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from("studio")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw error;
        // Public path (not a signed URL): the job can run for a while across
        // 30 pieces, and orchestrate() lazily re-signs any /object/public/studio/
        // ref right before each provider call — a 1-hour signed URL would expire
        // mid-batch.
        const { data } = supabase.storage.from("studio").getPublicUrl(path);
        setProductUrl(data.publicUrl);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Product photo upload failed");
      } finally {
        setProductUploading(false);
      }
    },
    [user],
  );

  // Load saved avatars + the template catalog for the pickers.
  useEffect(() => {
    optionsFn()
      .then((o) => {
        setAvatars(o.avatars);
        if (o.templates?.length) setTemplates(o.templates);
      })
      .catch(() => setAvatars([]));
  }, [optionsFn]);

  // Picking a template pre-fills the prompt box with its topic seed —
  // most people don't know how to write a good prompt, so the whole point of
  // a template is that they can just tap a card and go without typing.
  const pickTemplate = useCallback(
    (id: SpinTemplateId) => {
      setTemplateId(id);
      const t = templates.find((x) => x.id === id);
      if (t && (!prompt.trim() || templates.some((x) => x.topicSeed === prompt.trim()))) {
        setPrompt(t.topicSeed);
      }
      // Video Mode only exists for Product Showcase — leaving that template
      // must always drop back to photo mode so nothing invalid can be submitted.
      if (id !== "product_showcase" && mode === "video") setMode("photo");
    },
    [templates, prompt, mode],
  );

  // Poll + advance a job to completion. Each tick renders a small batch, so we
  // read fresh state after every tick and stop once the job is done.
  const drive = useCallback(
    async (id: string) => {
      if (drivingRef.current) return;
      drivingRef.current = true;
      setBusy(true);
      setErr(null);
      try {
        // Initial snapshot (also handles resume from a shared/refreshed URL).
        let snap = await getJobFn({ data: { jobId: id } });
        setVariants(snap.variants.map(toVariant));
        let guard = 0;
        while (snap.job.status !== "done" && guard < 200) {
          guard += 1;
          const res = await tickFn({ data: { jobId: id, batch: 2 } });
          snap = await getJobFn({ data: { jobId: id } });
          setVariants(snap.variants.map(toVariant));
          if (res.done || snap.job.status === "done") break;
          if (res.processed === 0) await sleep(1500);
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Spin failed");
      } finally {
        drivingRef.current = false;
        setBusy(false);
      }
    },
    [getJobFn, tickFn],
  );

  const startSpin = useCallback(
    async (p: string) => {
      if (!p.trim() || busy || planning) return;
      if (mode === "video") {
        if (!productUrl) {
          setErr("Upload a product photo to use Video Mode.");
          return;
        }
        if (!script.trim()) {
          setErr("Write a short script for the avatar to speak.");
          return;
        }
      }
      setErr(null);
      setPlanning(true);
      setVariants([]);
      try {
        const { jobId: id } = await startFn({
          data: {
            prompt: p.trim(),
            avatarId: faceUrl ? undefined : avatarId,
            faceUrl: faceUrl ?? undefined,
            templateId,
            mode,
            script: mode === "video" ? script.trim() : undefined,
            productUrl: mode === "video" ? productUrl! : undefined,
          },
        });
        setJobId(id);
        void navigate({ search: (prev) => ({ ...prev, jobId: id, prompt: undefined }), replace: true });
        setPlanning(false);
        await drive(id);
      } catch (e) {
        setPlanning(false);
        setErr(e instanceof Error ? e.message : "Could not start Spin");
      }
    },
    [avatarId, faceUrl, templateId, mode, script, productUrl, busy, planning, startFn, navigate, drive],
  );

  // Resume an in-flight job from the URL (refresh / shared link).
  useEffect(() => {
    if (autoStartedRef.current) return;
    if (search.jobId) {
      autoStartedRef.current = true;
      setJobId(search.jobId);
      void drive(search.jobId);
    } else if (search.prompt && search.prompt.trim()) {
      autoStartedRef.current = true;
      void startSpin(search.prompt.trim());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void startSpin(prompt.trim());
  };

  const done = variants.filter((v) => v.status === "done").length;
  const errored = variants.filter((v) => v.status === "error").length;
  const total = variants.length || SPIN_COUNT;
  const pct = Math.round(((done + errored) / total) * 100);
  const active = busy || planning;

  return (
    <main className="aurora-page-shell text-foreground">
      <span aria-hidden className="aurora-ambient" />
      <div className="relative z-10 mx-auto max-w-6xl px-4 py-10 md:px-8 md:py-14">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground no-underline">
          <ArrowLeft className="size-4" /> Back
        </Link>

        <div className="mt-6 flex items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-md border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-primary">
            <Flame className="size-3.5" /> TikTok30
          </span>
        </div>
        <h1 className="mt-3 text-4xl md:text-5xl font-extrabold tracking-tight">
          One prompt. <span className="aurora-gradient-text">{SPIN_COUNT} unique posts.</span>
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Describe your idea once. Aurora writes a full viral campaign — every post a different location, outfit, angle,
          lighting and mood — then renders them all with the <span className="text-foreground">same face</span>.
        </p>

        {/* Template picker */}
        <div className="mt-8">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <Sparkles className="size-3.5" /> Pick a template
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => pickTemplate(t.id)}
                disabled={active}
                className={`group relative flex flex-col items-start justify-end gap-0.5 overflow-hidden rounded-xl border p-3 text-left transition aspect-[3/4] ${
                  templateId === t.id ? "border-primary" : "border-white/10 hover:border-white/25"
                }`}
              >
                {t.image ? (
                  <img
                    src={t.image}
                    alt={t.label}
                    className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="absolute inset-0 bg-white/5" />
                )}
                <div
                  className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10 ${
                    templateId === t.id ? "ring-2 ring-inset ring-primary" : ""
                  }`}
                />
                <span className="relative text-lg leading-none">{t.emoji}</span>
                <span className="relative text-xs font-semibold text-white">{t.label}</span>
                <span className="relative text-[10px] leading-tight text-white/70">{t.blurb}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Video Mode (Product Showcase only) */}
        {templateId === "product_showcase" && (
          <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
                <Video className="size-3.5" /> Video Mode
              </div>
              <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
                <button
                  type="button"
                  onClick={() => setMode("photo")}
                  disabled={active}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition ${mode === "photo" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Photos
                </button>
                <button
                  type="button"
                  onClick={() => setMode("video")}
                  disabled={active}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition ${mode === "video" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Videos
                </button>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Your avatar holds your product and <span className="text-foreground">speaks your script</span> in {SPIN_VIDEO_DURATION_SECONDS}s
              talking clips — {SPIN_COUNT} unique scenes, same script, same product.
            </p>

            {mode === "video" && (
              <div className="mt-4 grid gap-4 md:grid-cols-[160px_1fr]">
                <div className="flex flex-col gap-2">
                  <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    <Package className="size-3" /> Product photo
                  </span>
                  <button
                    type="button"
                    onClick={() => productInputRef.current?.click()}
                    disabled={active || productUploading}
                    className={`group relative aspect-square overflow-hidden rounded-xl border-2 border-dashed transition ${
                      productUrl ? "border-primary/40" : "border-white/15 hover:border-primary/40"
                    }`}
                  >
                    {productUrl ? (
                      <img src={productUrl} alt="Product" className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-muted-foreground group-hover:text-primary">
                        {productUploading ? <Loader2 className="size-5 animate-spin" /> : <ImageIcon className="size-5" />}
                        <span className="px-2 text-center text-[10px]">Upload product photo</span>
                      </div>
                    )}
                  </button>
                  {productUrl && (
                    <button
                      type="button"
                      onClick={() => setProductUrl(null)}
                      disabled={active}
                      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-3" /> Remove
                    </button>
                  )}
                  <input
                    ref={productInputRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadProduct(f);
                      e.target.value = "";
                    }}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    <Mic className="size-3" /> Script (spoken in every clip)
                  </span>
                  <textarea
                    value={script}
                    onChange={(e) => setScript(e.target.value)}
                    placeholder="e.g. This is the game-changer your routine's been missing. Grab yours today."
                    maxLength={600}
                    rows={5}
                    disabled={active}
                    className="flex-1 resize-none rounded-xl aurora-glass px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  />
                  <span className="self-end text-[10px] text-muted-foreground">{script.length}/600</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Identity picker */}
        <div className="mt-6">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <User className="size-3.5" /> Keep this face across every post
          </div>
          <p className="mb-3 text-sm text-muted-foreground">
            Upload a reference photo and Spin locks that exact face across all {SPIN_COUNT} posts — nothing else to set up.
          </p>
          <input
            ref={faceInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadFace(f);
              e.target.value = "";
            }}
          />
          {faceUrl ? (
            <div className="flex items-center gap-3 rounded-xl aurora-glass p-2">
              <img src={faceUrl} alt="Reference" className="size-12 rounded-lg object-cover" />
              <div className="flex-1 text-sm text-foreground">Reference photo locked in</div>
              <button
                type="button"
                onClick={() => setFaceUrl(null)}
                disabled={active}
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" /> Remove
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => faceInputRef.current?.click()}
              disabled={active || faceUploading}
              className="inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary transition hover:bg-primary/15 disabled:opacity-60"
            >
              {faceUploading ? <Loader2 className="size-3.5 animate-spin" /> : <ImageIcon className="size-3.5" />}
              {faceUploading ? "Uploading…" : "Upload reference photo"}
            </button>
          )}

          {!faceUrl && avatars.length > 0 && (
            <div className="mt-3">
              <div className="mb-1.5 text-[11px] uppercase tracking-widest text-muted-foreground">Or reuse a saved identity</div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setAvatarId(undefined)}
                  disabled={active}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    avatarId === undefined ? "border-primary bg-primary/15 text-primary" : "border-white/10 bg-white/5 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  No avatar
                </button>
                {avatars.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setAvatarId(a.id)}
                    disabled={active}
                    className={`inline-flex items-center gap-2 rounded-lg border py-1 pl-1 pr-3 text-xs font-medium transition ${
                      avatarId === a.id ? "border-primary bg-primary/15 text-primary" : "border-white/10 bg-white/5 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {a.previewUrl ? (
                      <img src={a.previewUrl} alt={a.name} className="size-6 rounded-full object-cover" />
                    ) : (
                      <span className="grid size-6 place-items-center rounded-full bg-white/10">
                        <User className="size-3" />
                      </span>
                    )}
                    {a.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <form onSubmit={submit} className="mt-6 flex flex-col gap-3 md:flex-row">
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. day in my life as a Miami fitness creator"
            className="flex-1 rounded-xl aurora-glass px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            disabled={active}
          />
          <button
            type="submit"
            disabled={active || !prompt.trim() || (mode === "video" && (!productUrl || !script.trim()))}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[image:var(--gradient-hero)] px-6 py-3 font-bold text-white shadow-[var(--shadow-glow-soft)] transition-[filter] hover:brightness-110 disabled:opacity-50"
          >
            {active ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {planning
              ? "Writing campaign…"
              : `Spin ${SPIN_COUNT} ${mode === "video" ? "videos" : ""} · ${SPIN_COUNT * (mode === "video" ? SPIN_VIDEO_PIECE_COST : SPIN_PIECE_COST)} Aura`}
          </button>
        </form>

        {/* ── HeyGen Template: one-click talking-head video ──────────────── */}
        <div className="mt-4 rounded-2xl border border-pink-400/20 bg-pink-500/5">
          <button
            type="button"
            onClick={() => setHeygenOpen((o) => !o)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-white/80 hover:text-white transition-colors"
          >
            <span className="flex items-center gap-2">
              <Film className="size-4 text-pink-400" />
              Generate one HeyGen template video
              <span className="rounded-md bg-pink-500/20 px-2 py-0.5 text-[10px] font-semibold text-pink-300">
                {HEYGEN_COST} Aura
              </span>
            </span>
            {heygenOpen ? <ChevronUp className="size-4 text-white/40" /> : <ChevronDown className="size-4 text-white/40" />}
          </button>

          {heygenOpen && (
            <div className="px-4 pb-4 space-y-3 border-t border-pink-400/10 pt-3">
              <p className="text-[11px] text-muted-foreground">
                Pick one of your saved Aurora templates. Uses the reference photo you uploaded above — or paste a URL below.
              </p>

              {/* template picker */}
              {heygenTplQuery.isLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" /> Loading templates…
                </div>
              ) : heygenTpls.length === 0 ? (
                <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-muted-foreground">
                  No Aurora templates saved yet. Visit{" "}
                  <Link to="/heygen-templates" className="text-primary underline underline-offset-2">
                    HeyGen Templates
                  </Link>{" "}
                  to create one.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {heygenTpls.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedHeygenTplId(t.id)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                        selectedHeygenTplId === t.id
                          ? "border-pink-400 bg-pink-500/20 text-pink-200"
                          : "border-white/10 bg-white/5 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              )}

              {/* photo URL override */}
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Photo URL {faceUrl ? "(auto-filled from reference photo above)" : "(required)"}
                </label>
                <input
                  value={heygenPhotoUrl}
                  onChange={(e) => setHeygenPhotoUrl(e.target.value)}
                  placeholder={faceUrl ? faceUrl.slice(0, 60) + "…" : "https://…"}
                  className="w-full rounded-xl aurora-glass px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-pink-400 focus:outline-none"
                />
              </div>

              {/* generate button */}
              <button
                type="button"
                onClick={() => { setHeygenResult(null); heygenMut.mutate(); }}
                disabled={heygenMut.isPending || !selectedHeygenTplId || (!heygenPhotoUrl.trim() && !faceUrl)}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 px-5 py-2.5 text-sm font-bold text-white shadow-[0_0_20px_oklch(0.65_0.28_350/0.4)] transition-[filter] hover:brightness-110 disabled:opacity-50"
              >
                {heygenMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                {heygenMut.isPending ? "Generating…" : `Generate · ${HEYGEN_COST} Aura`}
              </button>

              {/* result */}
              {heygenResult && (
                <div className="mt-2 rounded-xl overflow-hidden border border-pink-400/20">
                  <video
                    src={heygenResult.url}
                    className="w-full max-h-72 object-contain bg-black"
                    controls
                    playsInline
                    autoPlay
                    muted
                  />
                  <div className="flex items-center gap-2 px-3 py-2 bg-black/30">
                    <a
                      href={heygenResult.url}
                      download
                      className="text-[11px] text-pink-300 hover:text-pink-100 underline underline-offset-2"
                    >
                      Download
                    </a>
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard.writeText(heygenResult!.url); toast.success("URL copied"); }}
                      className="text-[11px] text-white/50 hover:text-white"
                    >
                      Copy URL
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {err && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">
            <AlertCircle className="mt-0.5 size-4 shrink-0" /> {err}
          </div>
        )}

        {(jobId || planning) && (
          <section className="mt-10">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{done}</span> / {total} ready
                {errored > 0 && <span className="ml-2 text-red-300">· {errored} refunded</span>}
              </div>
              {jobId && <div className="text-xs text-muted-foreground">job {jobId.slice(0, 8)}</div>}
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-[image:var(--gradient-hero)] transition-all" style={{ width: `${pct}%` }} />
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
              {(variants.length
                ? variants
                : Array.from({ length: SPIN_COUNT }).map((_, i) => ({
                    id: String(i),
                    idx: i,
                    label: "Queued",
                    status: "queued" as const,
                    url: null,
                    spec: null,
                    kind: (mode === "video" ? "video" : "image") as "image" | "video",
                  }))
              ).map((v) => (
                <div key={v.id} className="group relative overflow-hidden rounded-xl aurora-glass aspect-[2/3]">
                  {v.url ? (
                    v.kind === "video" ? (
                      <video
                        src={v.url}
                        className="absolute inset-0 h-full w-full object-cover"
                        muted
                        loop
                        playsInline
                        autoPlay
                        preload="metadata"
                      />
                    ) : (
                      <img src={v.url} alt={v.spec?.caption ?? v.label} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                    )
                  ) : (
                    <div className="absolute inset-0 grid place-items-center">
                      {v.status === "running" ? (
                        <Loader2 className="size-5 animate-spin text-primary" />
                      ) : v.status === "error" ? (
                        <AlertCircle className="size-5 text-red-300/70" />
                      ) : (
                        <span className="size-2 rounded-full bg-white/30" />
                      )}
                    </div>
                  )}
                  {v.status === "done" && v.url && (
                    <button
                      type="button"
                      onClick={() => downloadVariant(v.url!, v.idx, v.kind).catch(() => toast.error("Download failed"))}
                      className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 opacity-0 backdrop-blur-sm transition group-hover:opacity-100"
                      title="Download"
                    >
                      <Download className="size-3 text-white" />
                    </button>
                  )}
                  <div className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-2">
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-[10px] font-semibold text-foreground">{v.label}</span>
                      {v.status === "done" && <Check className="size-3 shrink-0 text-emerald-300" />}
                    </div>
                    {v.spec?.caption && (
                      <span className="truncate text-[9px] leading-tight text-white/60">{v.spec.caption}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
