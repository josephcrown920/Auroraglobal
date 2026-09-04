import { authNextSearch } from "@/lib/auth-return-path";
import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { listGenerations, generatePerformanceShot } from "@/lib/studio.functions";
import { usePerformanceShotJobFn, useVideoFromImageJobFn, useLipSyncJobFn } from "@/lib/use-job-polling";
import {
  COLOR_PRESETS,
  SETUPS,
  SETUP_KINDS,
  WORKFLOWS,
  ANIMATE_LOOP_PROMPT,
  buildCompositorPrompt,
  buildCompositorSpec,
  buildCustomCompositorSpec,
  describePerformance,
  CUSTOM_MIC_OPTIONS,
  CUSTOM_SCENE_FIELD_MAX,
  EMPTY_CUSTOM_SCENE,
  type CustomScene,
  type SetupKind,
} from "@/lib/colors.presets";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { getColorStudio } from "@/lib/colors.studios";
import { computeCost } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Palette, Wand2, ArrowLeft, ArrowRight, Check, ImagePlus, X, ChevronDown, Music2, Mic2, Download, Film, Layers } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getSetupScene } from "@/lib/colors.scenes";
import { TriedTestedShowcase } from "@/components/studio/TriedTestedShowcase";
import { ColorsShotsGallery } from "@/components/studio/ColorsShotsGallery";
import { ColorStudioBackdrop } from "@/components/studio/ColorStudioBackdrop";
import tutorialStudioRefs from "@/assets/tutorial-studio-refs.jpg.asset.json";
import tutorialColorsBlueFinal from "@/assets/tutorial-colors-blue-final.jpg.asset.json";
import { ColorsStudioGuide } from "@/components/onboarding/ColorsStudioGuide";
import { PageHeroBanner } from "@/components/visual/PageHeroBanner";
import { OutputGallery } from "@/components/visual/OutputGallery";
import { DEMO_ASSETS } from "@/lib/demo-assets";

// Setups that take place on the seamless cyclorama get the real, per-color
// animated COLORS studio environment as their preview backdrop (see
// ColorStudioBackdrop). Other scene kinds (indoor / outdoor / street) keep their
// gradient mockups since they aren't studio sets.
const STUDIO_BACKDROP_KINDS = new Set(["performance", "studio"]);

// ─── Scene reference upload ──────────────────────────────────────────────────
// The compositor pipeline sends the ACTUAL studio scene image to the model as
// the final reference (scene lock), so it composites the person into that
// exact set instead of inventing a background. Bundled assets aren't reachable
// by providers, so we mirror them into the user's studio bucket once (upsert)
// and cache the signed URL for the session.
const sceneRefCache = new Map<string, string>();

async function ensureSceneRef(userId: string, key: string, assetUrl: string): Promise<string> {
  const cached = sceneRefCache.get(key);
  if (cached) return cached;
  const res = await fetch(assetUrl);
  if (!res.ok) throw new Error("Could not load the studio scene reference");
  const blob = await res.blob();
  const path = `${userId}/scene-refs/${key}.jpg`;
  const { error } = await supabase.storage.from("studio").upload(path, blob, {
    contentType: blob.type || "image/jpeg",
    upsert: true,
  });
  if (error) throw error;
  const { data: signed, error: signErr } = await supabase.storage
    .from("studio")
    .createSignedUrl(path, 60 * 60);
  if (signErr || !signed?.signedUrl) throw signErr ?? new Error("Could not sign scene reference");
  sceneRefCache.set(key, signed.signedUrl);
  return signed.signedUrl;
}

export const Route = createLazyFileRoute("/colors")({ component: ColorsStudio });

const COLORS_CAMERA_OPTIONS: [string, string][] = [
  ["static",    "Static"],
  ["push_in",   "Push in"],
  ["pull_out",  "Pull out"],
  ["zoom_in",   "Zoom in"],
  ["zoom_out",  "Zoom out"],
  ["pan_left",  "Pan left"],
  ["pan_right", "Pan right"],
  ["tilt_up",   "Tilt up"],
  ["tilt_down", "Tilt down"],
  ["orbit_cw",  "Orbit CW"],
  ["orbit_ccw", "Orbit CCW"],
];

/** Tiny inline upload tile — much smaller than the full UploadSlot. */
function MiniUpload({
  userId,
  label,
  value,
  onChange,
  accept = "image/*",
  icon: Icon = ImagePlus,
}: {
  userId: string;
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
  accept?: string;
  icon?: React.ElementType;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    if (file.size > 50 * 1024 * 1024) return toast.error("Max 50MB");
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userId}/uploads/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("studio").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (error) throw error;
      const { data: signed, error: signErr } = await supabase.storage
        .from("studio").createSignedUrl(path, 60 * 60);
      if (signErr || !signed?.signedUrl) throw signErr ?? new Error("Could not sign upload URL");
      onChange(signed.signedUrl);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      className={cn(
        "group relative h-16 rounded-xl border border-dashed flex items-center gap-3 px-3 transition-colors overflow-hidden text-left",
        value ? "border-primary/40 bg-card/60" : "border-border bg-card/30 hover:border-primary/40",
      )}
    >
      <div className="relative size-12 shrink-0 rounded-lg overflow-hidden bg-background/60 flex items-center justify-center">
        {value && accept === "image/*" ? (
          <img src={value} alt={label} className="size-full object-cover" />
        ) : value ? (
          <Icon className="size-4 text-primary" />
        ) : busy ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : (
          <Icon className="size-4 text-muted-foreground group-hover:text-primary" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-xs text-foreground/80 truncate">{value ? "Uploaded" : "Tap to upload"}</div>
      </div>
      {value && (
        <span
          role="button"
          onClick={(e) => {
            e.stopPropagation();
            onChange(null);
          }}
          className="text-muted-foreground hover:text-destructive p-1"
        >
          <X className="size-3.5" />
        </span>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
        }}
      />
    </button>
  );
}

function ColorsStudio() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const genFn = usePerformanceShotJobFn();
  const videoFn = useVideoFromImageJobFn();
  const lipFn = useLipSyncJobFn();
  const listFn = useServerFn(listGenerations);

  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [outfitUrl, setOutfitUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [cameraMovement, setCameraMovement] = useState("push_in");
  const [lipSyncResults, setLipSyncResults] = useState<Record<string, string>>({});
  const [color, setColor] = useState(COLOR_PRESETS[1].id); // royal blue — matches tried & tested
  const [kind, setKind] = useState<SetupKind>("performance");
  const [setup, setSetup] = useState("performance");
  const [workflow, setWorkflow] = useState(WORKFLOWS[0].id);
  // Scene source: preset setups vs the user-composed Scene Builder.
  const [sceneMode, setSceneMode] = useState<"presets" | "builder">("presets");
  const [customScene, setCustomScene] = useState<CustomScene>(EMPTY_CUSTOM_SCENE);
  const [tripletColors, setTripletColors] = useState<string[]>([
    COLOR_PRESETS[0].id,
    COLOR_PRESETS[1].id,
    COLOR_PRESETS[3].id,
  ]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: authNextSearch() });
  }, [user, loading, navigate]);

  const refs = useMemo(() => [selfieUrl, outfitUrl].filter(Boolean) as string[], [selfieUrl, outfitUrl]);
  const filteredSetups = useMemo(() => SETUPS.filter((s) => s.kind === kind), [kind]);

  // Keep selected setup valid when kind changes.
  useEffect(() => {
    if (!filteredSetups.some((s) => s.id === setup)) {
      setSetup(filteredSetups[0]?.id ?? SETUPS[0].id);
    }
  }, [kind, filteredSetups, setup]);

  const { data: gens } = useQuery({
    queryKey: ["color-gens"],
    queryFn: () => listFn(),
    enabled: !!user,
    refetchInterval: 4000,
  });
  const allItems = gens?.items ?? [];
  const recent = allItems
    .filter((g) => ["image", "video"].includes(g.kind ?? "") && (g.result_image_url || g.result_video_url))
    .slice(0, 8);
  // Shots still rendering server-side (they keep going even if the tab closes).
  // Same kinds the Recent grid can display (image stills + animate loops) —
  // other studios' job kinds (lipsync, UGC, …) are excluded.
  const inFlight = allItems.filter(
    (g) =>
      ["image", "video"].includes(g.kind ?? "") &&
      !g.result_image_url &&
      !g.result_video_url &&
      !g.error &&
      ["queued", "pending", "processing"].includes(g.status ?? ""),
  );

  const usingBuilder = sceneMode === "builder";
  const builderReady = customScene.environment.trim().length >= 10;

  /** Build the request payload for one shot — shared by the blocking single
   *  render and the enqueue-only bulk paths. */
  const buildShotData = async (colorId: string, setupId: string) => {
    if (refs.length === 0) throw new Error("Upload at least a selfie reference");
    if (usingBuilder) {
      // Scene Builder: the scene is entirely the user's composition, so the
      // scene lock is prompt-only (no bundled scene asset to attach).
      if (!builderReady) throw new Error("Describe your scene first (at least 10 characters)");
      const prompt = buildCustomCompositorSpec(colorId, customScene, {
        hasOutfitRef: !!outfitUrl,
      }).final_render_prompt;
      return {
        prompt,
        imageUrls: refs,
        motionVideoUrl: null,
        model: "google/gemini-3.1-flash-image-preview",
      };
    }
    // Scene lock: mirror the exact studio scene into storage and attach it as
    // the LAST reference image. Cyclorama setups use the real per-color studio
    // poster; indoor/outdoor/street use the photoreal scene still.
    const setupDef = SETUPS.find((s) => s.id === setupId);
    const isStudioSet = STUDIO_BACKDROP_KINDS.has(setupDef?.kind ?? "");
    const sceneAsset = isStudioSet ? getColorStudio(colorId).poster : getSetupScene(setupId);
    let sceneRef: string | null = null;
    if (sceneAsset && user) {
      try {
        sceneRef = await ensureSceneRef(
          user.id,
          isStudioSet ? `studio-${colorId}` : `scene-${setupId}`,
          sceneAsset,
        );
      } catch {
        toast.message("Scene reference unavailable — locking the scene from the prompt only");
      }
    }
    const prompt = buildCompositorPrompt(colorId, setupId, {
      hasOutfitRef: !!outfitUrl,
      hasSceneRef: !!sceneRef,
    });
    return {
      prompt,
      imageUrls: sceneRef ? [...refs, sceneRef] : refs,
      motionVideoUrl: null,
      model: "google/gemini-3.1-flash-image-preview",
    };
  };

  /** Blocking render: enqueue + poll until the shot is done (single mode). */
  const fire = async (colorId: string, setupId: string) =>
    genFn({ data: await buildShotData(colorId, setupId) });

  // Enqueue-only server fn (no client polling). Bulk modes queue every shot
  // upfront through this, so ALL of them are safely in the server jobs queue
  // the moment the button is clicked — closing the tab loses nothing; the
  // jobs/tick worker renders them and results land in Recent shots + Gallery.
  const enqueueFn = useServerFn(generatePerformanceShot);
  const enqueueShot = async (colorId: string, setupId: string) =>
    enqueueFn({ data: await buildShotData(colorId, setupId) });

  /** Queue a batch of shots upfront; report how many made it into the queue. */
  const enqueueBatch = async (shots: { colorId: string; setupId: string }[]) => {
    const results = await Promise.allSettled(
      shots.map((s) => enqueueShot(s.colorId, s.setupId)),
    );
    const ok = results.filter((r) => r.status === "fulfilled").length;
    if (ok === 0) {
      const first = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
      throw first?.reason instanceof Error ? first.reason : new Error("Could not queue the shots");
    }
    if (ok < shots.length) {
      toast.warning(`Queued ${ok}/${shots.length} shots — the rest failed to queue`);
    }
    return ok;
  };

  const singleMut = useMutation({
    mutationFn: () => fire(color, setup),
    onSuccess: () => {
      toast.success("Color shot ready");
      qc.invalidateQueries({ queryKey: ["color-gens"] });
      qc.invalidateQueries({ queryKey: ["gens"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const tripletMut = useMutation({
    mutationFn: () => enqueueBatch(tripletColors.map((c) => ({ colorId: c, setupId: setup }))),
    onSuccess: (n) => {
      toast.success(`${n} triptych shots queued — they keep rendering even if you leave`);
      qc.invalidateQueries({ queryKey: ["color-gens"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const allSetupsMut = useMutation({
    mutationFn: () => enqueueBatch(filteredSetups.map((s) => ({ colorId: color, setupId: s.id }))),
    onSuccess: (n) => {
      toast.success(`${n} setups queued — they keep rendering even if you leave`);
      qc.invalidateQueries({ queryKey: ["color-gens"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const lipMut = useMutation({
    mutationFn: (videoUrl: string) =>
      lipFn({ data: { videoUrl, audioUrl: audioUrl!, model: "fal-ai/sync-lipsync/v2" } }),
    onSuccess: (res, videoUrl) => {
      setLipSyncResults((prev) => ({ ...prev, [videoUrl]: res.videoUrl }));
      toast.success("Lipsync done — scroll down to see the result");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Lipsync failed"),
  });

  // Two-step preview→confirm flow (task #153 cost guardrail): the first click
  // renders a cheap 480p preview; the server returns its generation id, which
  // unlocks the full-quality render for that shot.
  const animatePreviewCost = computeCost({
    features: ["video"],
    model: "seedance-2.0-fast",
    durationSeconds: 5,
    resolution: "480p",
  }).total;
  const animateFullCost = computeCost({
    features: ["video"],
    model: "seedance-2.0-fast",
    durationSeconds: 5,
    resolution: "720p",
  }).total;
  // imageUrl → succeeded preview generation id (the full-quality ticket).
  const [animatePreviews, setAnimatePreviews] = useState<Record<string, string>>({});
  const animateMut = useMutation({
    mutationFn: (vars: { imageUrl: string; confirmPreviewId?: string }) =>
      videoFn({
        data: {
          imageUrl: vars.imageUrl,
          prompt: ANIMATE_LOOP_PROMPT,
          duration: 5,
          resolution: "720p",
          modelKey: "seedance-2.0-fast",
          cameraMovement: cameraMovement,
          confirmPreviewId: vars.confirmPreviewId,
        },
      }),
    onSuccess: (res, vars) => {
      if (res.preview) {
        setAnimatePreviews((prev) => ({ ...prev, [vars.imageUrl]: res.id }));
        toast.success("Preview ready — check the clip, then render full quality");
      } else {
        setAnimatePreviews((prev) => {
          const next = { ...prev };
          delete next[vars.imageUrl];
          return next;
        });
        toast.success("Performance clip ready");
      }
      qc.invalidateQueries({ queryKey: ["color-gens"] });
      qc.invalidateQueries({ queryKey: ["gens"] });
    },
    onError: (e, vars) => {
      const msg = e instanceof Error ? e.message : "Animate failed";
      // A rejected/expired ticket is terminal — drop it so the next click
      // starts a fresh preview instead of re-failing forever.
      if (msg.includes("Unsupported preview confirmation")) {
        setAnimatePreviews((prev) => {
          const next = { ...prev };
          delete next[vars.imageUrl];
          return next;
        });
      }
      toast.error(msg);
    },
  });

  /** Cross-origin fetch → Blob → objectURL anchor download (plain <a download>
   *  silently fails for cross-origin studio-bucket URLs). */
  const downloadShot = async (url: string) => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const ext = blob.type.includes("video") ? "mp4" : "jpg";
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `colors-shot.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    }
  };

  // Every shot is queued upfront (no client-side batching) — the server jobs
  // worker throttles concurrency itself, and nothing is lost if the tab closes.
  const allColorsMut = useMutation({
    mutationFn: () =>
      enqueueBatch(COLOR_PRESETS.map((c) => ({ colorId: c.id, setupId: setup }))),
    onSuccess: (n) => {
      toast.success(`${n} color shots queued — they keep rendering even if you leave`);
      qc.invalidateQueries({ queryKey: ["color-gens"] });
      qc.invalidateQueries({ queryKey: ["gens"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Bulk queue failed"),
  });

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  const selectedColor = COLOR_PRESETS.find((c) => c.id === color)!;
  const selectedSetup = SETUPS.find((s) => s.id === setup) ?? filteredSetups[0];

  return (
    <main className="aurora-page-shell text-foreground">
      <span aria-hidden className="aurora-ambient" />
      <header className="relative z-10 flex items-center justify-between pl-24 pr-6 md:pr-10 py-4 border-b border-border bg-card/40 backdrop-blur-xl">
        <Link to="/canvas" className="flex items-center gap-2 font-semibold tracking-tight">
          <ArrowLeft className="size-4 text-muted-foreground" />
          <span className="size-8 rounded-xl flex items-center justify-center shadow-[var(--shadow-glow-soft)]" style={{ background: "var(--gradient-hero)" }}>
            <Palette className="size-4 text-primary-foreground" />
          </span>
          Colors Studio
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <Link to="/gallery" className="text-muted-foreground hover:text-foreground">Gallery</Link>
          <Link to="/studio" className="text-muted-foreground hover:text-foreground">Full Studio</Link>
        </div>
      </header>

      <PageHeroBanner
        compact
        kicker="Colors Studio"
        headline="See the world before you step into it."
        sub="Test a palette against real performance imagery, then render the grade you want."
        media={DEMO_ASSETS.colors.hero}
        className="relative z-10 mx-5 mt-5 rounded-3xl border border-white/10"
      />

      <div className="relative z-10 max-w-7xl mx-auto p-5 md:p-10 grid lg:grid-cols-[1fr_380px] gap-8">
        {/* LEFT — pickers */}
        <section className="space-y-7">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              Pick a color. <span className="aurora-gradient-text">Show up in that world.</span>
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              12 real seamless-cyclorama studio sets, each lit in its own bold color. Pick a swatch — the
              studio switches live. Upload a selfie and Aurora places you inside it.
            </p>
          </div>

          {/* Quick launches for the guided Colors workflows. */}
          <div className="grid grid-cols-2 gap-3">
            <Link
              to="/colors-show"
              className="group overflow-hidden aurora-glass rounded-2xl border border-white/10 transition-all hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <img src="/gallery/josh-pink-mic.png" alt="Cinematic performance portrait with a pink microphone" loading="lazy" className="h-24 w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
              <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <Film className="size-5" />
                </span>
                <ArrowRight className="mt-1 size-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
              </div>
              <h2 className="mt-4 text-sm font-semibold text-foreground">Colors Show Creator</h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Turn your look into a cinematic performance show.
              </p>
              </div>
            </Link>
            <Link
              to="/scene-builder"
              className="group overflow-hidden aurora-glass rounded-2xl border border-white/10 transition-all hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <img src="/gallery/violet-haze.webp" alt="Violet-haze scene reference for a custom set" loading="lazy" className="h-24 w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
              <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <Layers className="size-5" />
                </span>
                <ArrowRight className="mt-1 size-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
              </div>
              <h2 className="mt-4 text-sm font-semibold text-foreground">Scene Builder</h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Compose your set, wardrobe, props, and camera angles.
              </p>
              </div>
            </Link>
          </div>

          {/* Real output proof — 9 shots from one session */}
          <div className="relative rounded-2xl overflow-hidden ring-1 ring-white/10">
            <img
              src="/spin-demo.jpg"
              alt="9 cinematic shots generated from one Colors Studio session"
              className="w-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
            <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Real output</p>
                <p className="text-xs font-semibold text-white mt-0.5">9 cinematic shots · one 30-second recording</p>
                <p className="text-[10px] text-white/60 mt-0.5">Pick a color → pick an outfit → unlimited content</p>
              </div>
              <span className="shrink-0 rounded-full bg-primary/20 border border-primary/40 px-2.5 py-1 text-[10px] font-bold text-primary">
                Colors Studio
              </span>
            </div>
          </div>

          <ColorsStudioGuide />

          {/* Featured live studio set — switches with the selected swatch */}
          <div className="relative w-full aspect-video rounded-3xl overflow-hidden border border-border shadow-2xl shadow-black/60">
            <ColorStudioBackdrop
              colorId={selectedColor.id}
              label={`${selectedColor.name} studio set`}
              preload="auto"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20 pointer-events-none" />
            <div className="absolute top-3 left-3 flex items-center gap-2 aurora-glass px-3 py-1.5 rounded-full text-xs font-medium text-white/90">
              <span className="size-2.5 rounded-full shadow-md shrink-0" style={{ background: selectedColor.swatch }} />
              {selectedColor.name} · COLORS Studio
            </div>
            <div className="absolute bottom-0 inset-x-0 p-4 md:p-6">
              <p className="text-[10px] text-white/55 mb-0.5 uppercase tracking-widest">
                12 colors · 5 scene types · your face
              </p>
              <p className="text-base md:text-xl font-semibold text-white">
                {selectedColor.name} — seamless cyclorama studio set
              </p>
            </div>
          </div>

          {/* Color swatch picker */}
          <div>
            <h2 className="aurora-kicker mb-3">Color</h2>
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setColor(c.id)}
                  aria-label={`Select ${c.name} color`}
                  aria-pressed={color === c.id}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200",
                    color === c.id
                      ? "border-primary/60 text-foreground shadow-md scale-105"
                      : "border-border bg-card/40 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                  )}
                  style={
                    color === c.id
                      ? { background: `${c.swatch}33`, boxShadow: `0 0 16px ${c.swatch}55` }
                      : undefined
                  }
                >
                  <span className="size-3 rounded-full shrink-0 shadow-sm" style={{ background: c.swatch }} />
                  {c.name}
                </button>
              ))}
            </div>
            {kind === "performance" && (
              <div className="mt-2.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-[11px] text-foreground/85">
                <span className="uppercase tracking-wider text-[9px] text-primary mr-1.5">Staging</span>
                {describePerformance(color)}
              </div>
            )}
          </div>

          {/* COMPACT references */}
          <div className="grid grid-cols-3 gap-3">
            <MiniUpload userId={user.id} label="Selfie · required" value={selfieUrl} onChange={setSelfieUrl} />
            <MiniUpload userId={user.id} label="Outfit · optional" value={outfitUrl} onChange={setOutfitUrl} />
            <MiniUpload userId={user.id} label="Audio · lipsync" value={audioUrl} onChange={setAudioUrl} accept="audio/*,video/mp4" icon={Music2} />
          </div>

          {/* Real shoots gallery — at the top for immediate inspiration */}
          <ColorsShotsGallery />
          <OutputGallery
            items={DEMO_ASSETS.colors.gallery}
            kicker="Grade proof"
            title="Look at the color, not just the swatch."
            subtitle="Finished Aurora stills reveal what each atmosphere does to the performance."
            showGalleryLink
          />

          <TriedTestedShowcase
            accent="cyan"
            title="Blue performance studio — tried & tested"
            subtitle="One selfie + the royal-blue performance preset = this finished shot."
            refsImage={tutorialStudioRefs.url}
            refsCaption="Selfie · Outfit · Pose reference"
            finalImage={tutorialColorsBlueFinal.url}
            finalCaption="Royal-blue cyclorama · hanging vintage mic · red jersey + black puffer vest · ARRI rim light"
            prompt="Editorial music-video performance shot of the subject on a seamless deep royal-blue cyclorama studio — background and floor are one continuous royal-blue surface, no visible seams. Full-body side profile, leaning into an exact suspended vintage silver microphone hanging from a thin cable at chest level. Outfit: bright red performance jersey with graphic print under a black hooded puffer vest, distressed black stacked jeans, white chunky sneakers. ARRI softbox key from camera-left + softbox fill from camera-right, professional dual softbox stands visible at far frame edges, gentle floor shadow, clean cinematic rim light separating the subject from the cyclorama. Preserve exact facial likeness, red dreadlocks, sunglasses, skin tone, body proportions. ARRI Alexa look, 50mm, 8K ultra-HD photoreal, no text or logos."
          />


          {/* Scene source — preset setups vs the Scene Builder */}
          <div>
            <h2 className="aurora-kicker mb-3">Scene</h2>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setSceneMode("presets")}
                className={cn(
                  "rounded-xl border p-3 text-left transition-colors",
                  !usingBuilder ? "border-primary/60 bg-primary/10" : "border-border bg-card/40 hover:border-primary/30",
                )}
              >
                <div className="text-xs font-medium">Preset scenes</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {SETUPS.length} tried &amp; tested sets — studio, indoor, rooftop, street.
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSceneMode("builder");
                  if (workflow === "all-setups") setWorkflow("single");
                }}
                className={cn(
                  "rounded-xl border p-3 text-left transition-colors",
                  usingBuilder ? "border-primary/60 bg-primary/10" : "border-border bg-card/40 hover:border-primary/30",
                )}
              >
                <div className="text-xs font-medium">Scene Builder</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Compose your own set — environment, mic, pose, lighting, props.
                </div>
              </button>
            </div>
          </div>

          {/* Scene Builder form */}
          {usingBuilder && (
            <div className="rounded-2xl border border-border bg-card/40 p-4 space-y-3.5">
              <div>
                <label htmlFor="sb-environment" className="aurora-kicker block mb-1.5">
                  Environment · required
                </label>
                <textarea
                  id="sb-environment"
                  value={customScene.environment}
                  maxLength={CUSTOM_SCENE_FIELD_MAX}
                  onChange={(e) => setCustomScene({ ...customScene, environment: e.target.value })}
                  placeholder="e.g. Rain-soaked rooftop helipad at night, city lights below, a single spotlight cutting through the mist…"
                  rows={3}
                  className="w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 resize-none"
                />
                <div className="text-[10px] text-muted-foreground mt-1 text-right">
                  {customScene.environment.length}/{CUSTOM_SCENE_FIELD_MAX}
                </div>
              </div>
              <div>
                <div className="aurora-kicker mb-1.5">Microphone</div>
                <div className="flex flex-wrap gap-2">
                  {CUSTOM_MIC_OPTIONS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setCustomScene({ ...customScene, mic: m.id })}
                      aria-pressed={customScene.mic === m.id}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                        customScene.mic === m.id
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border bg-card/40 text-muted-foreground hover:text-foreground hover:border-primary/40",
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="sb-pose" className="aurora-kicker block mb-1.5">Pose · optional</label>
                  <input
                    id="sb-pose"
                    value={customScene.pose}
                    maxLength={CUSTOM_SCENE_FIELD_MAX}
                    onChange={(e) => setCustomScene({ ...customScene, pose: e.target.value })}
                    placeholder="e.g. leaning on the railing, looking over shoulder"
                    className="w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50"
                  />
                </div>
                <div>
                  <label htmlFor="sb-energy" className="aurora-kicker block mb-1.5">Energy · optional</label>
                  <input
                    id="sb-energy"
                    value={customScene.energy}
                    maxLength={CUSTOM_SCENE_FIELD_MAX}
                    onChange={(e) => setCustomScene({ ...customScene, energy: e.target.value })}
                    placeholder="e.g. calm, brooding, mid-verse hype"
                    className="w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50"
                  />
                </div>
                <div>
                  <label htmlFor="sb-lighting" className="aurora-kicker block mb-1.5">Lighting · optional</label>
                  <input
                    id="sb-lighting"
                    value={customScene.lighting}
                    maxLength={CUSTOM_SCENE_FIELD_MAX}
                    onChange={(e) => setCustomScene({ ...customScene, lighting: e.target.value })}
                    placeholder="e.g. hard key from above, soft neon fill"
                    className="w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50"
                  />
                </div>
                <div>
                  <label htmlFor="sb-props" className="aurora-kicker block mb-1.5">Props · optional</label>
                  <input
                    id="sb-props"
                    value={customScene.props}
                    maxLength={CUSTOM_SCENE_FIELD_MAX}
                    onChange={(e) => setCustomScene({ ...customScene, props: e.target.value })}
                    placeholder="e.g. vintage stool, haze machine, road cases"
                    className="w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50"
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Your scene is rendered in the selected color's grade — switch swatches to restyle the same set.
              </p>
            </div>
          )}

          {/* Scene kind tabs */}
          {!usingBuilder && (
          <>
          <div>
            <h2 className="aurora-kicker mb-3">Scene type</h2>
            <div className="flex gap-2 flex-wrap">
              {SETUP_KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setKind(k.id)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors",
                    kind === k.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border bg-card/40 text-muted-foreground hover:text-foreground hover:border-primary/40",
                  )}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </div>

          {/* Setup visual cards */}
          <div>
            <h2 className="aurora-kicker mb-3">Setup preview</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {filteredSetups.map((s) => {
                const active = setup === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSetup(s.id)}
                    className={cn(
                      "group relative aspect-[4/3] rounded-2xl overflow-hidden text-left transition-all",
                      active ? "ring-2 ring-primary shadow-[0_0_28px_oklch(0.78_0.18_25/0.45)]" : "ring-1 ring-white/10 hover:ring-primary/50",
                    )}
                    style={{ background: s.preview(selectedColor.swatch) }}
                  >
                    {STUDIO_BACKDROP_KINDS.has(s.kind) ? (
                      <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-[1.04]">
                        <ColorStudioBackdrop
                          colorId={selectedColor.id}
                          label={`${selectedColor.name} ${s.name} studio`}
                          preload={active ? "auto" : "metadata"}
                        />
                      </div>
                    ) : (
                      <>
                        <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-[1.04]">
                          <img
                            src={getSetupScene(s.id)}
                            alt={`${s.name} scene set`}
                            loading="lazy"
                            className="absolute inset-0 size-full object-cover"
                          />
                        </div>
                        <div
                          aria-hidden
                          className="absolute inset-0 mix-blend-overlay pointer-events-none"
                          style={{ background: `radial-gradient(ellipse at 50% 85%, ${selectedColor.swatch}dd 0%, transparent 65%)` }}
                        />
                      </>
                    )}

                    {/* Dark gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                    {/* Selected badge */}
                    {active && (
                      <div className="absolute top-2.5 right-2.5 size-6 rounded-full bg-primary flex items-center justify-center z-10">
                        <Check className="size-3 text-white" />
                      </div>
                    )}

                    {/* Text overlay */}
                    <div className="absolute bottom-0 inset-x-0 p-3 z-10">
                      <div className="font-bold text-white text-sm leading-snug mb-0.5">{s.name}</div>
                      <div className="text-[10px] text-white/55 line-clamp-1">{s.description} →</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          </>
          )}

          {/* Workflows — "all setups" only applies to preset scenes */}
          <div>
            <h2 className="aurora-kicker mb-3">Workflow</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {WORKFLOWS.filter((w) => !usingBuilder || w.id !== "all-setups").map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setWorkflow(w.id)}
                  className={`rounded-xl border p-2.5 text-left transition-colors ${workflow === w.id ? "border-primary/60 bg-primary/10" : "border-border bg-card/40 hover:border-primary/30"}`}
                >
                  <div className="text-xs font-medium">{w.name}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{w.steps.join(" → ")}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Triplet picker */}
          {workflow === "triptych" && (
            <div className="rounded-xl border border-border bg-card/40 p-3 space-y-2.5">
              <div className="aurora-kicker">Triptych colors (pick 3)</div>
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map((c) => {
                  const selected = tripletColors.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        if (selected) setTripletColors(tripletColors.filter((x) => x !== c.id));
                        else if (tripletColors.length < 3) setTripletColors([...tripletColors, c.id]);
                      }}
                      className={`size-8 rounded-full border-2 transition-transform ${selected ? "border-primary scale-110" : "border-border"}`}
                      style={{ background: c.swatch }}
                      aria-label={`${selected ? "Remove" : "Add"} ${c.name} to triptych`}
                      aria-pressed={selected}
                      title={c.name}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Render details — structured AI Performance Compositor spec for the current pick */}
          <Collapsible className="rounded-xl border border-border bg-card/40">
            <CollapsibleTrigger className="w-full flex items-center justify-between gap-2 px-3 py-2 text-[11px] text-muted-foreground hover:text-foreground group">
              <span className="uppercase tracking-wider">Render details</span>
              <ChevronDown className="size-3.5 transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="px-3 pb-3 space-y-1.5 text-[11px] text-foreground/80">
              {(() => {
                const spec = usingBuilder
                  ? buildCustomCompositorSpec(color, customScene, { hasOutfitRef: !!outfitUrl })
                  : buildCompositorSpec(color, setup, { hasOutfitRef: !!outfitUrl });
                return (
                  <>
                    <div><span className="text-muted-foreground">Scene: </span>{spec.scene}</div>
                    <div><span className="text-muted-foreground">Color: </span>{spec.color}</div>
                    <div><span className="text-muted-foreground">Lighting: </span>{spec.lighting}</div>
                    <div><span className="text-muted-foreground">Motion: </span>{spec.motion_description}</div>
                  </>
                );
              })()}
            </CollapsibleContent>
          </Collapsible>

          {/* Action */}
          <div className="rounded-2xl border border-border bg-card/60 p-4 space-y-3 sticky bottom-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="size-3 rounded-full" style={{ background: selectedColor.swatch }} />
              <span>{selectedColor.name} · {usingBuilder ? "Custom scene" : selectedSetup?.name}</span>
            </div>
            {/* Motion control — applies when animating a generated shot */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <Mic2 className="size-3" /> Motion control
              </p>
              <Select value={cameraMovement} onValueChange={setCameraMovement}>
                <SelectTrigger className="h-8 text-xs bg-black/30 border-white/10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLORS_CAMERA_OPTIONS.map(([v, l]) => (
                    <SelectItem key={v} value={v} className="text-xs">{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {audioUrl && (
                <p className="text-[10px] text-primary mt-1 flex items-center gap-1">
                  <Music2 className="size-3" /> Audio loaded — hover an animated clip to add lipsync
                </p>
              )}
            </div>
            {workflow === "single" && (
              <Button disabled={singleMut.isPending || refs.length === 0 || (usingBuilder && !builderReady)} onClick={() => singleMut.mutate()} variant="premium" className="w-full h-11">
                {singleMut.isPending ? <><Loader2 className="size-4 mr-2 animate-spin" /> Shooting…</> : <><Wand2 className="size-4 mr-2" /> Generate · 10 Aura · ~15s</>}
              </Button>
            )}
            {workflow === "triptych" && (
              <Button disabled={tripletMut.isPending || refs.length === 0 || tripletColors.length !== 3 || (usingBuilder && !builderReady)} onClick={() => tripletMut.mutate()} variant="premium" className="w-full h-11">
                {tripletMut.isPending ? <><Loader2 className="size-4 mr-2 animate-spin" /> Queueing 3×…</> : <><Wand2 className="size-4 mr-2" /> Generate triptych · 30 Aura</>}
              </Button>
            )}
            {workflow === "all-setups" && !usingBuilder && (
              <Button disabled={allSetupsMut.isPending || refs.length === 0} onClick={() => allSetupsMut.mutate()} variant="premium" className="w-full h-11">
                {allSetupsMut.isPending ? <><Loader2 className="size-4 mr-2 animate-spin" /> Queueing all…</> : <><Wand2 className="size-4 mr-2" /> Generate all {filteredSetups.length} setups</>}
              </Button>
            )}
            <Button
              disabled={allColorsMut.isPending || refs.length === 0 || (usingBuilder && !builderReady)}
              onClick={() => allColorsMut.mutate()}
              variant="outline"
              className="w-full h-9 text-xs"
            >
              {allColorsMut.isPending ? (
                <><Loader2 className="size-3.5 mr-2 animate-spin" /> Queueing {COLOR_PRESETS.length} colors…</>
              ) : (
                <>Queue all {COLOR_PRESETS.length} colors · {COLOR_PRESETS.length} Aura</>
              )}
            </Button>
            {usingBuilder && !builderReady && (
              <p className="text-[11px] text-muted-foreground">Describe your scene above to enable rendering.</p>
            )}
            <p className="text-[11px] text-muted-foreground">
              Queued shots keep rendering on our servers even if you close this page — results land in your Gallery.
            </p>
          </div>
        </section>

        {/* RIGHT — gallery */}
        <aside className="space-y-4">
          {inFlight.length > 0 && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5 flex items-center gap-2.5 text-xs text-foreground/85">
              <Loader2 className="size-3.5 animate-spin text-primary shrink-0" />
              <span>
                {inFlight.length} shot{inFlight.length === 1 ? "" : "s"} rendering — safe to leave, they'll finish on their own.
              </span>
            </div>
          )}
          <Link
            to="/gallery"
            className="flex items-center gap-2 rounded-xl border border-border bg-card/60 px-4 py-3 text-sm font-medium no-underline hover:border-primary/40 hover:bg-card/80 transition-colors"
          >
            <Sparkles className="size-4 text-primary" />
            <span>View your shots in Gallery</span>
            <span className="ml-auto text-muted-foreground text-xs">→</span>
          </Link>
        </aside>
      </div>
    </main>
  );
}
