import { createLazyFileRoute, useNavigate, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { UploadSlot } from "@/components/studio/UploadSlot";
import { WardrobePicker } from "@/components/studio/WardrobePicker";
import { AUDIO_ACCEPT } from "@/lib/utils";
import { BringItToLifePreview } from "@/components/studio/BringItToLifePreview";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Wand2, LogOut, Loader2, Download, Camera, Film, Mic2, Coins, Zap, Shield, Server, Captions, Crown, Flame, Settings2, Check } from "lucide-react";
import { PageSpinner } from "@/components/PageSpinner";
import { AuthRedirect } from "@/components/AuthRedirect";
import { CaptionDialog } from "@/components/gallery/CaptionDialog";
import { toast } from "sonner";
import { listGenerations } from "@/lib/studio.functions";
import { usePerformanceShotJobFn, useVideoFromImageJobFn, useLipSyncJobFn } from "@/lib/use-job-polling";
import { handleGenerationError, friendlyGenerationMessage } from "@/lib/error-toasts";
import { useGenerationProgress } from "@/hooks/use-generation-progress";
import { GenerationProgress } from "@/components/ui/GenerationProgress";
import { BlurredPreview } from "@/components/ui/BlurredPreview";
import { getMyProfile, createPaystackCheckout, getPaymentByReference, getPaymentStatusByReference } from "@/lib/billing.functions";
import { trackPurchase, trackGenerationCompleted } from "@/lib/gtm";
import { PLANS } from "@/lib/billing.plans";
import { computeCost, type Resolution } from "@/lib/pricing";
import { ResolutionPicker } from "@/components/ResolutionPicker";
import { detectCurrency } from "@/lib/geo.functions";
import demoSelfie from "@/assets/demo-selfie.jpg";
import { RECIPES } from "@/lib/tutorials";
import { MODEL_LIST, VIDEO_MODEL_LIST, getModelMeta } from "@/lib/models";
import { ModelBadge } from "@/components/ModelBadge";
import { OnboardingModal, shouldShowOnboarding } from "@/components/studio/OnboardingModal";
import { LowCreditBanner } from "@/components/studio/LowCreditBanner";
import { useAutoReloadPrompt } from "@/hooks/use-auto-reload";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HfAudioPanel } from "@/components/studio/HfAudioPanel";
import { publishGeneration } from "@/lib/share.functions";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { saveAssetToDisk } from "@/lib/save";
import { ShareMenu } from "@/components/share/ShareMenu";
import { ConnectReplicateBanner } from "@/components/ConnectReplicateBanner";
import { ExampleChips } from "@/components/onboarding/ExampleChips";
import { WelcomeTour } from "@/components/onboarding/WelcomeTour";
import { STUDIO_EXAMPLE_PRESETS } from "@/lib/example-presets";
import { MEDIA_ASSETS } from "@/lib/mediaAssets";
import { useSiteImage } from "@/components/landing/SiteImagesProvider";
import { hasDismissedTour, markFirstGenComplete, hasCompletedFirstGen, isFirstPageVisit, markPageVisited, markFirstPurchaseComplete } from "@/lib/first-run";
import { loadStudioSession, saveStudioSession } from "@/lib/studio-session";
import { HiggsHero, StepGuide, HiggsDivider, type GuideStep } from "@/components/studio/HiggsLayout";
import { StudioHeroComposer, type ComposerMode } from "@/components/studio/StudioHeroComposer";
import { EditableCopy } from "@/components/EditableCopy";
import { ExampleOutputGrid } from "@/components/studio/ExampleOutputGrid";

export const Route = createLazyFileRoute("/studio")({ component: StudioPage });

const MODELS = MODEL_LIST;

const colorsWide = (color: string) =>
  `Place the subject into a minimalist studio performance scene. Full-body side profile pose, arms slightly extended forward as if performing. Use an exact suspended vintage studio microphone — photoreal shape, size, material, cable — hanging from ceiling at chest level. Environment is a seamless ${color} cyclorama studio — background and floor are one continuous ${color} color, no visible edges or corners. Soft even glossy lighting with smooth gradient. Subject stands on a circular performance platform matching the ${color} tone, slightly elevated with subtle shadow and faint reflective sheen. Preserve exact facial likeness, beard, skin tone, hairstyle, body proportions. Outfit identical to the outfit reference. Cinematic studio lighting, gentle floor shadow, rim light separation, ultra-realistic skin texture, natural pores, sharp clothing detail, high-end music video aesthetic, 4K photoreal quality.`;

const colorsCloseUp = (color: string) =>
  `Place the subject into a studio performance scene. Medium close-up from chest up. Subject turned slightly to side but mostly facing camera — approximately 30-45° angled pose, majority of face visible. Use an exact suspended vintage studio microphone — identical design, metallic finish, hanging cable — positioned in front at mouth level. Environment is a seamless continuous ${color} cyclorama background filling entire frame top to bottom, no visible floor line, corners, or edges. Preserve exact facial likeness, beard, hairstyle, skin tone, proportions. Outfit identical to the outfit reference. Pose natural and expressive as if mid-performance, hands slightly raised or gesturing. Soft even studio lighting, gentle shadows, subtle rim light separation, ultra-realistic skin texture with natural pores, sharp clothing detail, shallow depth of field but subject fully crisp, high-end music video aesthetic, 4K photoreal quality.`;

const musicVideoScene =
  `Create a hyper-realistic composite using the provided reference images. Use the close-up selfie as the primary identity source, preserving exact facial features, skin tone, complexion, beard texture, hairstyle, eye detail, and overall likeness with absolute accuracy. Dress the subject in the exact outfit from the outfit reference — accurate colors, fabric textures, proportions, and fit. Place the subject outdoors in the location reference as the main background environment, and incorporate the prop/vehicle from the prop reference behind the subject — naturally placed, correct scale and angle. Match the pose reference exactly: same body positioning, framing, perspective, and camera angle. Include a vintage hanging microphone suspended directly in front of the subject at mouth level. Apply true cinematic shallow depth of field — subject and microphone razor-sharp, background softly blurred with natural optical bokeh and realistic lens falloff. Visual style of ARRI Alexa cinema camera with high-quality prime lens: filmic color science, natural highlight roll-off, accurate dynamic range, professional golden-hour outdoor lighting. Advanced skin realism — authentic pores, micro-texture, fine lines, natural asymmetry, freckles, vellus hairs, real matte vs oily zones, no smoothing or plastic artifacts. High-fidelity eye detail with crisp iris texture, accurate subsurface light, refined eyelids and lashes. Ultra-photorealistic, seamless blending, accurate proportions, true optical depth, 4K, no text or logos.`;

const PRESETS = [
  { label: "Editorial Cover", prompt: "Cinematic editorial portrait of the subject — razor-sharp 85mm f/1.8 lens, warm split key light at 2700K from 45° left with a cool blue rim at 5600K creating vivid tonal separation, seamless charcoal studio backdrop with a deep violet gradient glow behind. Subject at 30° angle to camera with direct confident eye contact. Ultra-photorealistic: natural skin pores, micro-texture, individual hair strands, precise fabric weave. Perfect anatomy and natural proportions — no distortion, no warping, no artifacts. 4K hyperrealistic photography, crisp in-focus subject, soft creamy bokeh background. Preserve exact facial likeness, skin tone, hairstyle, and outfit from the reference." },
  { label: "Neon Street", prompt: "Cinematic night street performance, neon purple and pink reflections, rain-soaked pavement, motion blur background, professional cinematic still" },
  { label: "Urban Rooftop", prompt: "Cinematic editorial photograph of the subject on a downtown rooftop at golden hour, skyline of glass towers behind, low sun rim-lighting the subject from the side, warm cinematic color grade, anamorphic 50mm look, sharp focus on the subject, shallow depth of field, 4K. Preserve exact facial likeness and outfit." },
  { label: "Urban Alley", prompt: "Gritty urban alleyway portrait of the subject at night, wet pavement reflecting overhead street lamps, brick walls and graffiti softly out of focus, single hard key light from above, deep shadows, ARRI cinema look, anamorphic flares, 35mm lens, 4K. Preserve exact facial likeness and outfit." },
  { label: "Urban Subway", prompt: "Cinematic underground subway platform shot — subject standing on the platform with a blurred train streaking past behind them creating long motion-blur light streaks, fluorescent overhead lighting mixed with warm tungsten, hyper-real grain, 4K editorial still. Preserve exact facial likeness and outfit." },
  { label: "Urban Crosswalk", prompt: "Aerial-angle street photograph of the subject mid-stride on a busy downtown crosswalk surrounded by motion-blurred pedestrians, taxis with bokeh tail lights, overcast cinematic color grade, ARRI Alexa film look, 4K. Preserve exact facial likeness and outfit." },
  { label: "Colors — Wide (Hot Pink)", prompt: colorsWide("hot pink") },
  { label: "Colors — Close-up (Hot Pink)", prompt: colorsCloseUp("hot pink") },
  { label: "Colors — Wide (Royal Blue)", prompt: colorsWide("royal blue") },
  { label: "Colors — Close-up (Sunset Orange)", prompt: colorsCloseUp("sunset orange") },
  { label: "Music Video Scene", prompt: musicVideoScene },
  { label: "Urban Cut", prompt: "Cinematic luxury fashion showcase of the subject styled like a runway model — but anywhere: a sleek modern interior or a moody downtown street. Full-body editorial pose with confident runway energy, the designer outfit as the hero of the frame. Dramatic directional key light with soft rim separation, polished reflective floor, anamorphic 50mm look, shallow depth of field, high-fashion color grade, ultra-realistic skin texture with natural pores, sharp clothing detail, 4K photoreal quality. Preserve exact facial likeness, beard, hairstyle, skin tone, and the outfit from the reference." },
  { label: "Get Ready With Me", prompt: "Intimate 'get ready with me' scene of the subject in front of a large vanity mirror mid-styling — outfit selection and finishing touches, building to the finished look. Warm soft vanity lighting with natural window fill, cozy bedroom / dressing-room setting, candid handheld editorial feel, shallow depth of field, ultra-realistic skin texture with natural pores, sharp clothing detail, 4K photoreal quality. Preserve exact facial likeness, beard, hairstyle, skin tone, and the outfit from the reference." },
];

// Higgsfield-style card art for each preset — real photography from the shared
// MEDIA_ASSETS catalogue (same source as home/gallery cards; no new assets).
const PRESET_IMAGES: Record<string, string> = {
  "Editorial Cover": MEDIA_ASSETS.editorial,
  "Neon Street": MEDIA_ASSETS["music-video"],
  "Urban Rooftop": MEDIA_ASSETS.performance,
  "Urban Alley": MEDIA_ASSETS.motion,
  "Urban Subway": MEDIA_ASSETS.scene,
  "Urban Crosswalk": MEDIA_ASSETS.tiktok,
  "Colors — Wide (Hot Pink)": MEDIA_ASSETS.colors,
  "Colors — Close-up (Hot Pink)": MEDIA_ASSETS.colors,
  "Colors — Wide (Royal Blue)": MEDIA_ASSETS.colors,
  "Colors — Close-up (Sunset Orange)": MEDIA_ASSETS.colors,
  "Music Video Scene": MEDIA_ASSETS["music-video"],
  "Urban Cut": MEDIA_ASSETS.photo,
  "Get Ready With Me": MEDIA_ASSETS.grwm,
};

const REANGLES = [
  { label: "Side profile", prompt: "super close up, from the side front angle of the subject, keep bokeh depth of field, preserve identity, outfit, and environment exactly" },
  { label: "Wide shot", prompt: "wide shot from behind the subject, showing full environment, keep cinematic depth of field, preserve identity, outfit, and environment exactly" },
  { label: "Low angle", prompt: "low angle looking up at the subject, dramatic perspective, keep bokeh depth of field, preserve identity, outfit, and environment exactly" },
  { label: "Extreme close-up", prompt: "extreme close-up on the face, eyes looking into camera, shallow depth of field, preserve identity and environment exactly" },
  { label: "Over the shoulder", prompt: "over the shoulder shot from behind, looking at the scene ahead, cinematic bokeh, preserve identity, outfit, and environment exactly" },
  { label: "Dutch angle", prompt: "tilted dutch angle, dynamic composition, dramatic cinematic lighting, preserve identity, outfit, and environment exactly" },
];


function StudioPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [outfit, setOutfit] = useState<string | null>(null);
  const [scene, setScene] = useState<string | null>(null);
  const [prop, setProp] = useState<string | null>(null);
  const [motion, setMotion] = useState<string | null>(null);
  const { q: incomingIdea } = useSearch({ from: "/studio" });
  const [prompt, setPrompt] = useState(incomingIdea ?? PRESETS[0].prompt);
  const [model, setModel] = useState(MODELS[0].value);
  const [videoModel, setVideoModel] = useState(VIDEO_MODEL_LIST[0].value);
  const [cameraMovement, setCameraMovement] = useState<string>("static");
  const [endFrameUrl, setEndFrameUrl] = useState<string | null>(null);
  const [videoPrompt, setVideoPrompt] = useState("subject performing and singing expressively, natural body movement, camera locked");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [lipsyncModel, setLipsyncModel] = useState<"fal-ai/sync-lipsync/v2" | "fal-ai/wav2lip" | "latentsync">("fal-ai/sync-lipsync/v2");
  const [studioLipsyncConsent, setStudioLipsyncConsent] = useState(false);
  const [captionOpen, setCaptionOpen] = useState(false);
  const [videoResolution, setVideoResolution] = useState<Resolution>("720p");
  const [videoPreviewId, setVideoPreviewId] = useState<string | null>(null);
  const [videoHdDialogOpen, setVideoHdDialogOpen] = useState(false);

  // Tiered cost previews — must mirror the server charge exactly.
  // Preview is always 480p (cheap first pass); confirmed full render uses selected resolution.
  const videoCost = useMemo(
    () => computeCost({ features: ["video"], model: videoModel, durationSeconds: 5, resolution: videoResolution }).total,
    [videoModel, videoResolution],
  );
  const videoPreviewCost = useMemo(
    () => computeCost({ features: ["video"], model: videoModel, durationSeconds: 5, resolution: "480p" }).total,
    [videoModel],
  );
  const lipsyncCost = useMemo(
    () => computeCost({ features: ["lipsync"], model: lipsyncModel }).total,
    [lipsyncModel],
  );

  const [settingsOpen, setSettingsOpen] = useState(false);
  // Hero composer — Image/Video entry surface at the top of the page.
  const [composerMode, setComposerMode] = useState<ComposerMode>("image");
  const [sessionRestored, setSessionRestored] = useState(false);
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const goldenHourExampleUrl = useSiteImage("studio-example-golden-hour-perf");
  const tokyoRainExampleUrl = useSiteImage("studio-example-tokyo-rain");
  const editorialExampleUrl = useSiteImage("studio-example-editorial-split");
  const concertStageExampleUrl = useSiteImage("studio-example-concert-stage");
  const goldLuxuryExampleUrl = useSiteImage("studio-example-gold-luxury");
  const studioExamplePresets = useMemo(() => {
    const urls = {
      "golden-hour-perf": goldenHourExampleUrl,
      "tokyo-rain": tokyoRainExampleUrl,
      "editorial-split": editorialExampleUrl,
      "concert-stage": concertStageExampleUrl,
      "gold-luxury": goldLuxuryExampleUrl,
    };
    return STUDIO_EXAMPLE_PRESETS.map((preset) => ({
      ...preset,
      imageUrl: urls[preset.id as keyof typeof urls] ?? preset.imageUrl,
    }));
  }, [goldenHourExampleUrl, tokyoRainExampleUrl, editorialExampleUrl, concertStageExampleUrl, goldLuxuryExampleUrl]);
  const [activeExampleId, setActiveExampleId] = useState(studioExamplePresets[0].id);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  // Paystack redirects back here with ?paid=1 after a credit-pack checkout —
  // both on success AND on failure (e.g. 3D Secure decline). Fire the GTM
  // purchase event on success; show a helpful message on failure so the user
  // knows exactly why their credits didn't appear.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("paid") !== "1") return;
    markFirstPurchaseComplete();
    // Paystack appends its own `reference` (and `trxref`) to the callback
    // URL — look the payment up server-side rather than trusting any
    // client-supplied amount, so the dataLayer value always matches what
    // was actually charged. The webhook that flips the row to "succeeded"
    // can lag slightly behind this redirect, so retry a few times before
    // giving up on the event.
    const reference = params.get("reference") ?? params.get("trxref");
    if (!reference) return;
    let cancelled = false;
    const attempt = async (retriesLeft: number): Promise<void> => {
      if (cancelled) return;
      try {
        const payment = await paymentByRefFn({ data: { reference } });
        if (payment) {
          trackPurchase({ transactionId: payment.reference, value: payment.amount, currency: payment.currency });
          toast.success("Payment successful! Your Aura has been added.");
          return;
        }
      } catch {
        // fall through to retry/give-up below
      }
      if (retriesLeft > 0 && !cancelled) {
        await new Promise((r) => setTimeout(r, 2000));
        return attempt(retriesLeft - 1);
      }
      // All retries exhausted — check the raw status so we can show a
      // meaningful message instead of silently doing nothing.
      if (cancelled) return;
      try {
        const statusResult = await paymentStatusFn({ data: { reference } });
        if (!statusResult) {
          // Reference not found at all — very unusual
          toast.error("We couldn't find your payment. If you were charged, contact support.", { duration: 8000 });
        } else if (statusResult.status === "failed" || statusResult.status === "abandoned") {
          toast.error(
            "Your payment wasn't completed — your bank may have declined the 3D Secure authentication. Please try again.",
            { duration: 8000 },
          );
        } else if (statusResult.status === "pending") {
          toast.info("Your payment is still processing. Refresh the page in a moment and your Aura should appear.", {
            duration: 8000,
          });
        }
        // status === "succeeded" means the webhook just hadn't fired by the
        // time all retries ran — treat this as success without a GTM event.
      } catch {
        // Best-effort — never block the page on a status lookup failure.
      }
    };
    void attempt(4);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only: loads initial studio state once; re-running on dep changes would reset the user's in-progress session
  }, []);

  useEffect(() => {
    if (!user) return;
    if (shouldShowOnboarding()) {
      const t = setTimeout(() => setOnboardOpen(true), 400);
      return () => clearTimeout(t);
    } else if (!hasDismissedTour()) {
      const t = setTimeout(() => setShowTour(true), 800);
      return () => clearTimeout(t);
    }
  }, [user]);

  // First-visit auto-prefill — new users get the first example loaded automatically
  useEffect(() => {
    if (hasCompletedFirstGen()) return;
    if (!isFirstPageVisit("studio")) return;
    markPageVisited("studio");
    const p = studioExamplePresets[0];
    if (!incomingIdea && p.prompt) setPrompt(p.prompt);
    setActiveExampleId(p.id);
  }, [incomingIdea, studioExamplePresets]);

  // ── Session restore ────────────────────────────────────────────────────────
  // On mount, restore the last saved session for returning users.
  // incomingIdea from the URL always takes precedence over the saved prompt.
  // This runs AFTER the first-visit auto-prefill so it wins for returning users.
  useEffect(() => {
    if (!user) return;
    const saved = loadStudioSession(user.id);
    if (!saved) return;
    if (!incomingIdea && saved.prompt) setPrompt(saved.prompt);
    if (saved.model && MODELS.some((candidate) => candidate.value === saved.model)) setModel(saved.model);
    if (saved.videoModel && VIDEO_MODEL_LIST.some((candidate) => candidate.value === saved.videoModel)) setVideoModel(saved.videoModel);
    if (saved.cameraMovement) setCameraMovement(saved.cameraMovement);
    if (saved.videoPrompt) setVideoPrompt(saved.videoPrompt);
    if (saved.lipsyncModel === "fal-ai/sync-lipsync/v2" || saved.lipsyncModel === "fal-ai/wav2lip" || saved.lipsyncModel === "latentsync") setLipsyncModel(saved.lipsyncModel);
    if (saved.videoResolution === "480p" || saved.videoResolution === "720p" || saved.videoResolution === "1080p" || saved.videoResolution === "2160p") setVideoResolution(saved.videoResolution);
    if (saved.activePreset !== undefined) setActivePreset(saved.activePreset ?? null);
    if (saved.selfie !== undefined) setSelfie(saved.selfie ?? null);
    if (saved.outfit !== undefined) setOutfit(saved.outfit ?? null);
    if (saved.scene !== undefined) setScene(saved.scene ?? null);
    if (saved.prop !== undefined) setProp(saved.prop ?? null);
    if (saved.motion !== undefined) setMotion(saved.motion ?? null);
    if (saved.endFrameUrl !== undefined) setEndFrameUrl(saved.endFrameUrl ?? null);
    if (saved.audioUrl !== undefined) setAudioUrl(saved.audioUrl ?? null);
    setSessionRestored(true);
    toast.info("Session restored", { duration: 2500, id: "studio-session-restore" });
  }, [user, incomingIdea]);

  // ── Session save (debounced 600 ms) ───────────────────────────────────────
  // Persists the user's current settings to localStorage so they can resume
  // exactly where they left off after a page reload or browser restart.
  useEffect(() => {
    if (!user) return;
    const t = setTimeout(() => {
      saveStudioSession(user.id, {
        prompt, model, videoModel, cameraMovement, videoPrompt,
        lipsyncModel, videoResolution, activePreset,
        selfie, outfit, scene, prop, motion, endFrameUrl, audioUrl,
      });
    }, 600);
    return () => clearTimeout(t);
  }, [user, prompt, model, videoModel, cameraMovement, videoPrompt, lipsyncModel, videoResolution, activePreset, selfie, outfit, scene, prop, motion, endFrameUrl, audioUrl]);

  const genFn = usePerformanceShotJobFn();
  const listFn = useServerFn(listGenerations);
  const videoFn = useVideoFromImageJobFn();
  const lipSyncFn = useLipSyncJobFn();
  const profileFn = useServerFn(getMyProfile);
  const checkoutFn = useServerFn(createPaystackCheckout);
  const paymentByRefFn = useServerFn(getPaymentByReference);
  const paymentStatusFn = useServerFn(getPaymentStatusByReference);
  const publishFn = useServerFn(publishGeneration);
  const detectCurrencyFn = useServerFn(detectCurrency);
  const { data: geo } = useQuery({ queryKey: ["geo-currency"], queryFn: () => detectCurrencyFn(), staleTime: 60 * 60 * 1000 });
  const currency = geo?.currency ?? "USD";

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => profileFn(),
    enabled: !!user,
    refetchInterval: 15_000,
  });

  useAutoReloadPrompt(profile?.credits);

  const { data: history } = useQuery({
    queryKey: ["gens", user?.id],
    queryFn: () => listFn(),
    enabled: !!user,
  });

  const latest = useMemo(() => {
    const items = history?.items ?? [];
    return items.find((i) => i.status === "complete" && i.result_image_url);
  }, [history]);

  const latestVideo = useMemo(() => {
    const items = history?.items ?? [];
    return items.find((i) => i.status === "complete" && i.result_video_url);
  }, [history]);

  const mut = useMutation({
    mutationFn: async (args?: { promptOverride?: string }) => {
      // Build labeled reference list so Gemini knows which slot each image is.
      // When a pose is provided we strip outfit/lighting cues from the pose ref
      // via the prompt; ordering doesn't matter as long as labels are clear.
      const effectivePrompt = args?.promptOverride ?? prompt;
      const refs: { url: string; label: string }[] = [];
      if (selfie) refs.push({ url: selfie, label: "Identity (face / skin / hair)" });
      if (outfit) refs.push({ url: outfit, label: "Outfit (wardrobe only)" });
      if (scene) refs.push({ url: scene, label: "Scene / environment" });
      if (prop) refs.push({ url: prop, label: "Prop (mic / vehicle / object)" });
      if (motion) refs.push({ url: motion, label: "POSE reference — copy stance, gesture, camera angle ONLY. Ignore its outfit, face and background." });
      if (refs.length === 0) {
        // Text-only generation — example chip pressed before uploading references
        return genFn({ data: { prompt: effectivePrompt, imageUrls: [], motionVideoUrl: null, model } });
      }
      const labelBlock = refs
        .map((r, i) => `Image ${i + 1}: ${r.label}`)
        .join("\n");
      const fullPrompt = `${effectivePrompt}\n\nReference images (in order):\n${labelBlock}`;
      return genFn({ data: { prompt: fullPrompt, imageUrls: refs.map((r) => r.url), motionVideoUrl: null, model } });
    },
    onSuccess: () => {
      markFirstGenComplete();
      trackGenerationCompleted("image");
      toast.success("Shot ready");
      qc.invalidateQueries({ queryKey: ["gens"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e) => handleGenerationError(e),
  });



  const reangleMut = useMutation({
    mutationFn: async (anglePrompt: string) => {
      if (!latest?.result_image_url) throw new Error("Generate a base shot first");
      return genFn({ data: { prompt: anglePrompt, imageUrls: [latest.result_image_url], motionVideoUrl: null, model } });
    },
    onSuccess: () => {
      toast.success("New angle ready");
      qc.invalidateQueries({ queryKey: ["gens"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e) => handleGenerationError(e),
  });

  const videoMut = useMutation({
    mutationFn: async () => {
      if (!latest?.result_image_url) throw new Error("Generate a base shot first");
      return videoFn({
        data: {
          imageUrl: latest.result_image_url,
          prompt: videoPrompt,
          duration: 5,
          resolution: videoResolution,
          modelKey: videoModel,
          cameraMovement,
          endFrameUrl: endFrameUrl ?? null,
          confirmPreviewId: videoPreviewId ?? undefined,
        },
      });
    },
    onSuccess: (out) => {
      const res = out as { id?: string; videoUrl?: string; preview?: boolean } | null;
      if (res?.preview) {
        setVideoPreviewId(res?.id ?? null);
        toast.success("Preview ready — click again to render in full quality");
      } else {
        setVideoPreviewId(null);
        // Previews are low-res drafts, not the final deliverable — only the
        // full-quality render counts as a completed generation.
        trackGenerationCompleted("video");
        toast.success("Video ready");
      }
      qc.invalidateQueries({ queryKey: ["gens"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e) => handleGenerationError(e),
  });

  const lipSyncMut = useMutation({
    mutationFn: async () => {
      if (!audioUrl) throw new Error("Upload your audio first");
      let videoUrl = latestVideo?.result_video_url ?? null;
      if (!videoUrl) {
        const baseImg = latest?.result_image_url;
        if (!baseImg) throw new Error("Generate or upload a base image/video first");
        toast.message("Animating image first…", { description: "Turning your still into a talking-head clip." });
        const v = await videoFn({
          data: {
            imageUrl: baseImg,
            prompt: "subtle talking-head movement, natural micro-expressions, locked camera",
            duration: 5,
            resolution: "720p",
            modelKey: videoModel,
            cameraMovement: "static",
            endFrameUrl: null,
          },
        });
        videoUrl = v.videoUrl;
      }
      return lipSyncFn({ data: { videoUrl, audioUrl, model: lipsyncModel } });
    },
    onSuccess: () => {
      trackGenerationCompleted("lipsync");
      toast.success("Lip-sync ready");
      qc.invalidateQueries({ queryKey: ["gens"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e) => handleGenerationError(e),
  });

  // Resolve a permanent public URL for the bundled demo selfie (uploads it
  // to the studio bucket once per user so the AI model can fetch it).
  const [demoUrl, setDemoUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!user) return;
    const path = `${user.id}/demo/selfie.jpg`;
    const existing = supabase.storage.from("studio").getPublicUrl(path).data.publicUrl;
    // try a HEAD-style fetch by image load
    const probe = new Image();
    probe.onload = () => setDemoUrl(existing);
    probe.onerror = async () => {
      try {
        const blob = await (await fetch(demoSelfie)).blob();
        await supabase.storage.from("studio").upload(path, blob, { contentType: "image/jpeg", upsert: true });
        setDemoUrl(supabase.storage.from("studio").getPublicUrl(path).data.publicUrl);
      } catch (e) {
        console.error("Demo seed failed", e);
      }
    };
    probe.src = existing;
  }, [user]);

  const demoMut = useMutation({
    mutationFn: async (args?: { promptOverride?: string }) => {
      if (!demoUrl) throw new Error("Demo selfie not ready yet — try again in a second");
      return genFn({ data: { prompt: args?.promptOverride ?? PRESETS[3].prompt, imageUrls: [demoUrl], motionVideoUrl: null, model } });
    },
    onSuccess: () => {
      markFirstGenComplete();
      toast.success("Demo shot ready — made with our sample face");
      qc.invalidateQueries({ queryKey: ["gens"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e) => handleGenerationError(e),
  });

  // Pending recipe from landing-page tutorial — pre-fill prompt + selfie and auto-fire.
  const [recipeFired, setRecipeFired] = useState(false);
  useEffect(() => {
    if (recipeFired) return;
    if (typeof window === "undefined") return;
    if (!user || !demoUrl) return;
    const pending = localStorage.getItem("aurora.pendingRecipe");
    if (!pending) return;
    const recipe = RECIPES.find((r) => r.id === pending);
    if (!recipe) {
      localStorage.removeItem("aurora.pendingRecipe");
      return;
    }
    localStorage.removeItem("aurora.pendingRecipe");
    setRecipeFired(true);
    setPrompt(recipe.prompt);
    setSelfie(demoUrl);
    toast.message(`Running "${recipe.title}" with our demo selfie…`);
    genFn({ data: { prompt: recipe.prompt, imageUrls: [demoUrl], motionVideoUrl: null, model } })
      .then(() => {
        qc.invalidateQueries({ queryKey: ["gens"] });
        qc.invalidateQueries({ queryKey: ["profile"] });
        toast.success("Demo shot ready");
      })
      .catch((e) => handleGenerationError(e));
  }, [user, demoUrl, recipeFired, genFn, model, qc]);

  const checkoutMut = useMutation({
    mutationFn: async (plan: keyof typeof PLANS) => checkoutFn({ data: { plan, currency } }),
    onSuccess: (res) => {
      window.location.href = res.authorizationUrl;
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Checkout failed"),
  });

  const imageProgress = useGenerationProgress({
    isPending: mut.isPending,
    isError: mut.isError,
    isSuccess: mut.isSuccess,
    estimatedMs: 18_000,
    persistKey: "aurora.progress.studio.image",
    labels: {
      queued: "Queued…",
      processing: "Lighting the stage…",
      finalizing: "Finishing the shot…",
      done: "Shot ready",
    },
  });

  const demoProgress = useGenerationProgress({
    isPending: demoMut.isPending,
    isError: demoMut.isError,
    isSuccess: demoMut.isSuccess,
    estimatedMs: 18_000,
    persistKey: "aurora.progress.studio.demo",
    labels: {
      queued: "Demo queued…",
      processing: "Demo shot — lighting the stage…",
      finalizing: "Demo shot — finishing up…",
      done: "Demo shot ready",
    },
  });

  // Progress state for whichever image generation (normal or demo) is active.
  const activeImageProgress = demoMut.isPending ? demoProgress : imageProgress;

  const videoProgress = useGenerationProgress({
    isPending: videoMut.isPending,
    isError: videoMut.isError,
    isSuccess: videoMut.isSuccess,
    estimatedMs: 45_000,
    persistKey: "aurora.progress.studio.video",
    labels: {
      queued: "Queued…",
      processing: "Rendering your video…",
      finalizing: "Finalising clip…",
      done: "Video ready",
    },
  });

  const lipsyncProgress = useGenerationProgress({
    isPending: lipSyncMut.isPending,
    isError: lipSyncMut.isError,
    isSuccess: lipSyncMut.isSuccess,
    estimatedMs: 50_000,
    persistKey: "aurora.progress.studio.lipsync",
    labels: {
      queued: "Queued…",
      processing: "Syncing lips to audio…",
      finalizing: "Almost there…",
      done: "Lip-sync ready",
    },
  });

  if (loading) return <PageSpinner />;
  if (!user) return <AuthRedirect />;

  return (
    <main className="flex flex-col min-h-screen lg:flex-row lg:h-[100dvh] lg:overflow-hidden bg-zinc-950 text-zinc-100">
      {/* Modals + global banners */}
      <ConnectReplicateBanner />
      {user && (
        <OnboardingModal
          userId={user.id}
          open={onboardOpen}
          onOpenChange={setOnboardOpen}
          onApply={({ selfieUrl, prompt: p }) => { setSelfie(selfieUrl); setPrompt(p); }}
          onBonusGranted={() => qc.invalidateQueries({ queryKey: ["profile"] })}
        />
      )}
      <WelcomeTour show={showTour} variant="studio" onDismiss={() => setShowTour(false)} />

      {/* ── Left sidebar ─────────────────────────────────────────── */}
      <div className="flex flex-col w-full lg:w-[300px] lg:shrink-0 lg:h-full lg:border-r lg:border-white/8">

      {/* ── Compact sticky header ─────────────────────────────────── */}
      <header className="sticky top-0 z-30 flex items-center justify-between h-12 px-4 border-b border-white/5 bg-zinc-950/90 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <span className="inline-block size-2 rounded-full bg-[#8b5cf6]" />
          <span className="text-sm font-semibold tracking-tight">Aurora Studio</span>
        </div>
        <div className="flex items-center gap-3">
          {sessionRestored && (
            <span role="status" className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-medium text-emerald-400/90">
              <Check className="size-3" /> Last session restored
            </span>
          )}
          <LowCreditBanner credits={profile?.credits} />
          <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs">
            <Coins className="size-3 text-[#8b5cf6]" />
            <span className="font-semibold tabular-nums">{profile?.credits ?? "—"}</span>
            <span className="text-zinc-500">Aura</span>
          </div>
          {profile?.isAdmin && (
            <Link to="/admin" className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-400 hover:bg-amber-500/20 transition-colors">
              <Shield className="size-3" /> Admin
            </Link>
          )}
          <Button variant="ghost" size="sm" className="h-7 px-2 text-zinc-400 hover:text-zinc-100"
            onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }}>
            <LogOut className="size-3.5" />
          </Button>
        </div>
      </header>

      {/* ── Main scroll area (leave room for sticky prompt bar) ──── */}
      <div className="flex-1 overflow-y-auto pb-36 lg:pb-24 space-y-0">

        {/* ── Hero composer — the signed-in front door ──────────── */}
        <StudioHeroComposer
          prompt={composerMode === "image" ? prompt : videoPrompt}
          onPromptChange={composerMode === "image" ? setPrompt : setVideoPrompt}
          mode={composerMode}
          onModeChange={setComposerMode}
          imageModels={MODELS.map((m) => ({ value: m.value, label: m.label }))}
          videoModels={VIDEO_MODEL_LIST.map((m) => ({ value: m.value, label: m.label }))}
          imageModel={model}
          onImageModelChange={setModel}
          videoModel={videoModel}
          onVideoModelChange={setVideoModel}
          costLabel={composerMode === "image" ? "10 Aura" : `${videoCost} Aura`}
          busy={composerMode === "image" ? mut.isPending || demoMut.isPending : videoMut.isPending}
          hasReferences={!!(selfie || outfit || scene || prop || motion)}
          onOpenReferences={() => setSettingsOpen(true)}
          onGenerate={() => {
            if (composerMode === "image") {
              if (!mut.isPending && !demoMut.isPending) mut.mutate(undefined);
            } else {
              // Video needs a base image; the mutation surfaces a clear error
              // ("Generate a base shot first") if none exists yet.
              if (!videoMut.isPending) videoMut.mutate();
            }
          }}
        />

        {/* Canvas — result at top */}
        <div className="relative bg-zinc-900">
          {mut.isPending || demoMut.isPending ? (
            <div className="flex flex-col items-center justify-center gap-6 px-8 py-16 min-h-[56vw]">
              <div className="size-14 rounded-full flex items-center justify-center bg-[#8b5cf6]/10 ring-1 ring-[#8b5cf6]/30">
                <Loader2 className="size-6 animate-spin text-[#8b5cf6]" />
              </div>
              <div className="w-full max-w-xs space-y-2 text-center">
                <p className="text-sm text-zinc-300">{activeImageProgress.label || (demoMut.isPending ? "Demo shot — lighting the stage…" : "Lighting the stage…")}</p>
                <GenerationProgress visible progress={activeImageProgress.progress} />
              </div>
            </div>
          ) : mut.isSuccess || demoMut.isSuccess ? (
            <div className="flex flex-col items-center justify-center min-h-[40vw] gap-3 px-4 text-center">
              <Link to="/gallery" className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-4 py-2.5 text-sm font-semibold text-emerald-400 no-underline hover:bg-emerald-500/20 transition-colors">
                <Check className="size-4" /> {demoMut.isSuccess && !mut.isSuccess ? "Demo shot ready — View in Gallery" : "Shot ready — View in Gallery"}
              </Link>
              <p className="text-xs text-zinc-600">
                {demoMut.isSuccess && !mut.isSuccess
                  ? "This demo used our sample face — upload your own selfie to star in the next one"
                  : "Your generation is saved to your gallery"}
              </p>
            </div>
          ) : (
            <div className="flex flex-col justify-center min-h-[40vw] gap-4 px-4 py-8">
              <EditableCopy
                as="p"
                copyKey="studio_empty_state"
                fallback="Upload your photo above, then hit Generate"
                className="text-xs text-zinc-600 text-center"
              />
              <ExampleOutputGrid
                title="Made in Studio"
                subtitle="Real Aurora renders — tap a style chip above to start with one of these looks."
                columns={2}
                items={STUDIO_EXAMPLE_PRESETS.filter((p) => p.imageUrl).slice(0, 4).map((p) => ({
                  src: p.imageUrl!,
                  label: p.label,
                  caption: p.hint,
                }))}
              />
              <Link
                to="/agent"
                className="group flex items-center gap-3 rounded-2xl border border-[#8b5cf6]/25 bg-[#8b5cf6]/8 px-4 py-3 no-underline transition hover:border-[#8b5cf6]/50 hover:bg-[#8b5cf6]/12"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#8b5cf6]/20 text-[#a78bfa]">
                  <Film className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-zinc-100">Want a full video instead?</span>
                  <span className="block text-xs text-zinc-500">The Video Agent plans, shoots, and cuts it for you.</span>
                </span>
                <Sparkles className="size-4 shrink-0 text-[#a78bfa] transition group-hover:scale-110" />
              </Link>
            </div>
          )}
        </div>

        {/* Pipeline status */}
        {(mut.isPending || mut.isError || videoMut.isPending || videoMut.isError || lipSyncMut.isPending || lipSyncMut.isError) && (
          <div className="px-4 py-3 space-y-2 border-b border-white/5">
            <p className="text-[10px] uppercase tracking-wider text-zinc-600 px-1">Pipeline</p>
            {[
              { label: "Image", state: mut.isPending ? "running" : mut.isError ? "error" : latest?.result_image_url ? "ok" : "idle", error: mut.isError ? friendlyGenerationMessage(mut.error) : null, canRetry: mut.isError, onRetry: () => mut.mutate(undefined), progress: imageProgress },
              { label: "Video", state: videoMut.isPending ? "running" : videoMut.isError ? "error" : latestVideo?.result_video_url ? "ok" : "idle", error: videoMut.isError ? friendlyGenerationMessage(videoMut.error) : null, canRetry: videoMut.isError && !!latest?.result_image_url, onRetry: () => videoMut.mutate(), progress: videoProgress },
              { label: "Lip sync", state: lipSyncMut.isPending ? "running" : lipSyncMut.isError ? "error" : "idle", error: lipSyncMut.isError ? friendlyGenerationMessage(lipSyncMut.error) : null, canRetry: lipSyncMut.isError && !!audioUrl, onRetry: () => lipSyncMut.mutate(), progress: lipsyncProgress },
            ].map((s) => (
              <div key={s.label} className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs ${s.state === "ok" ? "border-emerald-500/30 bg-emerald-500/8" : s.state === "running" ? "border-[#8b5cf6]/30 bg-[#8b5cf6]/8" : s.state === "error" ? "border-destructive/40 bg-destructive/8" : "border-white/5 bg-white/3"}`}>
                <span className={`mt-1 size-2 rounded-full shrink-0 ${s.state === "ok" ? "bg-emerald-400" : s.state === "running" ? "bg-[#8b5cf6] animate-pulse" : s.state === "error" ? "bg-destructive" : "bg-zinc-600"}`} />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="font-medium text-zinc-200 flex items-center gap-2">
                    {s.label}
                    <span className="text-[10px] text-zinc-500 uppercase">{s.state === "running" ? s.progress.label || "Running…" : s.state}</span>
                  </div>
                  {s.state === "running" && <GenerationProgress visible progress={s.progress.progress} gradient />}
                  {s.error && <div className="text-destructive/80 text-[11px] truncate">{s.error}</div>}
                </div>
                {s.canRetry && (
                  <button type="button" onClick={s.onRetry} className="shrink-0 text-[11px] px-2 py-1 rounded-md border border-white/10 bg-white/5 hover:border-white/20">Try again</button>
                )}
              </div>
            ))}
          </div>
        )}



        {/* Buy Aura */}
        <div className="relative overflow-hidden border-t border-[#8b5cf6]/15 bg-gradient-to-b from-zinc-950 to-zinc-900">
          <div aria-hidden className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 w-[400px] h-[180px] rounded-full bg-[#8b5cf6]/10 blur-[70px]" />
          <div className="relative px-4 py-6 space-y-5">
            <div>
              <p className="aurora-kicker mb-2 flex items-center gap-1.5"><Coins className="size-3" />Aura Credits</p>
              <h3 className="text-xl font-black tracking-tight text-white">Every tool. <span className="aurora-gradient-text">One balance.</span></h3>
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">Photos, videos, lip-syncs, 4K exports — all charged from the same Aura wallet. Never expires.</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {(["day1", "day2"] as const).map((k) => {
                const p = PLANS[k];
                return (
                  <button key={k} type="button" disabled={checkoutMut.isPending} onClick={() => checkoutMut.mutate(k)}
                    className="flex flex-col gap-0.5 rounded-xl border border-white/10 bg-white/4 hover:border-[#8b5cf6]/30 hover:bg-[#8b5cf6]/8 active:scale-[0.98] transition-all p-3 text-left disabled:opacity-50">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">{k === "day1" ? "1-Day Pass" : "2-Day Pass"}</span>
                    <span className="text-lg font-black text-white leading-none">{p.credits} <span className="text-xs font-normal text-zinc-500">Aura</span></span>
                    <span className="text-xs font-semibold text-zinc-400">{p.prices[currency].display}</span>
                  </button>
                );
              })}
            </div>

            <div className="space-y-2">
              {(["starter", "creator", "studio"] as const).map((k) => {
                const p = PLANS[k];
                const isPopular = k === "creator";
                const isBest = k === "studio";
                return (
                  <button key={k} type="button" disabled={checkoutMut.isPending} onClick={() => checkoutMut.mutate(k)}
                    className={`w-full rounded-2xl border p-4 text-left transition-all active:scale-[0.98] disabled:opacity-50 ${isPopular ? "border-[#8b5cf6]/50 bg-gradient-to-br from-[#8b5cf6]/12 to-[#8b5cf6]/4" : isBest ? "border-amber-400/30 bg-gradient-to-br from-amber-500/8 to-transparent" : "border-white/8 bg-white/4"}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-black capitalize ${isPopular ? "text-white" : isBest ? "text-amber-100" : "text-zinc-300"}`}>{k}</span>
                        {isPopular && <span className="text-[10px] font-bold text-[#8b5cf6] border border-[#8b5cf6]/40 rounded px-1.5 py-0.5 flex items-center gap-1"><Flame className="size-2.5" />Popular</span>}
                        {isBest && <span className="text-[10px] font-bold text-amber-400 border border-amber-400/30 rounded px-1.5 py-0.5">Best value</span>}
                      </div>
                      <span className={`text-lg font-black ${isPopular ? "text-[#8b5cf6]" : isBest ? "text-amber-300" : "text-zinc-300"}`}>{p.prices[currency].display}</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-3xl font-black tabular-nums ${isPopular ? "text-white" : isBest ? "text-amber-100" : "text-zinc-400"}`}>{p.credits}</span>
                      <span className="text-xs text-zinc-600">Aura</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-center gap-3 pt-1">
              {checkoutMut.isPending ? (
                <span className="text-[11px] text-zinc-500 flex items-center gap-1.5"><Loader2 className="size-3 animate-spin" />Opening checkout…</span>
              ) : (
                <>
                  <span className="text-[10px] text-zinc-600 flex items-center gap-1"><Shield className="size-3" />Paystack secured</span>
                  <span className="text-[10px] text-zinc-700">·</span>
                  <span className="text-[10px] text-zinc-600">Credits never expire</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Sticky bottom prompt bar ──────────────────────────────── */}
      <div className="fixed bottom-16 left-0 right-0 z-20 lg:right-auto lg:w-[300px] lg:bottom-0 border-t border-white/8 bg-zinc-950/95 backdrop-blur-xl px-3 py-3">
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="shrink-0 flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/6 hover:bg-white/12 transition-colors"
            aria-label="Open settings"
          >
            <Settings2 className="size-4.5 text-zinc-400" />
          </button>
          <Textarea
            rows={2}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the shot — rooftop at golden hour, hanging mic, anamorphic…"
            className="flex-1 min-h-[2.5rem] max-h-32 resize-none bg-zinc-900 border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-[#8b5cf6]/40 rounded-xl"
          />
          <button
            type="button"
            disabled={mut.isPending || demoMut.isPending}
            onClick={() => mut.mutate(undefined)}
            className="shrink-0 flex size-10 items-center justify-center rounded-xl bg-[#8b5cf6] hover:bg-[#8b5cf6]/80 disabled:opacity-50 transition-colors shadow-[0_0_20px_-4px_rgba(139,92,246,0.6)]"
            aria-label="Generate"
          >
            {mut.isPending ? <Loader2 className="size-4.5 animate-spin text-white" /> : <Wand2 className="size-4.5 text-white" />}
          </button>
        </div>
        <div className="flex items-center justify-between mt-1.5 px-1">
          <span className="text-[10px] text-zinc-600">{getModelMeta(model)?.label ?? model} · 10 Aura</span>
          <button type="button" onClick={() => setSettingsOpen(true)} className="text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors">
            {selfie || outfit ? "✓ refs set" : "Add references"}
          </button>
        </div>
      </div>
      </div>{/* ← end left sidebar */}

      {/* ── Right panel: hero / canvas — desktop only ───────────────── */}
      <div className="hidden lg:flex lg:flex-1 lg:flex-col lg:h-full lg:overflow-y-auto bg-zinc-900/40 scrollbar-none">
        {mut.isPending || demoMut.isPending ? (
          <div className="flex flex-1 h-full items-center justify-center p-8">
            <div className="flex flex-col items-center gap-6 text-center">
              <div className="size-16 rounded-full flex items-center justify-center bg-violet-500/10 ring-1 ring-violet-500/30">
                <Loader2 className="size-7 animate-spin text-violet-400" />
              </div>
              <p className="text-sm text-zinc-400">{activeImageProgress.label || (demoMut.isPending ? "Demo shot — lighting the stage…" : "Lighting the stage…")}</p>
              <div className="w-64"><GenerationProgress visible progress={activeImageProgress.progress} /></div>
            </div>
          </div>
        ) : mut.isSuccess || demoMut.isSuccess ? (
          <div className="flex flex-1 h-full items-center justify-center p-8">
            <div className="flex flex-col items-center gap-4 text-center">
              <Link to="/gallery" className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-4 py-2.5 text-sm font-semibold text-emerald-400 no-underline hover:bg-emerald-500/20 transition-colors">
                <Check className="size-4" /> {demoMut.isSuccess && !mut.isSuccess ? "Demo shot ready — View in Gallery" : "Shot ready — View in Gallery"}
              </Link>
              <p className="text-xs text-zinc-600">
                {demoMut.isSuccess && !mut.isSuccess
                  ? "This demo used our sample face — upload your own selfie to star in the next one"
                  : "Your generation is saved to your gallery"}
              </p>
            </div>
          </div>
        ) : (
          <>
            <HiggsHero
              kicker={
                <EditableCopy
                  copyKey="studio_hero_kicker"
                  fallback="Aurora Studio"
                  className="text-violet-400/70"
                />
              }
              lines={["MAKE VIDEOS IN", "ONE CLICK"]}
              bracketWord="ONE CLICK"
              description={
                <EditableCopy
                  copyKey="studio_hero_description"
                  fallback="From a selfie to a cinematic AI video. Upload your photo, describe your vision, and watch it come to life."
                  className="text-zinc-400"
                />
              }
              headline={
                <EditableCopy
                  as="span"
                  copyKey="studio_hero_headline"
                  fallback="MAKE VIDEOS IN ONE CLICK"
                  className="block"
                />
              }
            />
            <StepGuide
              steps={[
                { icon: <Camera className="size-4" />, title: "ADD YOUR PHOTO", description: "Upload a selfie and optional outfit, scene, or prop reference" },
                { icon: <Wand2 className="size-4" />, title: "DESCRIBE THE SHOT", description: "Tell Aurora the vibe — rooftop at golden hour, vintage mic, anamorphic" },
                { icon: <Film className="size-4" />, title: "GET YOUR VIDEO", description: "Photo → cinematic still → animated clip, all in one session" },
              ] as GuideStep[]}
            />
            <HiggsDivider
              label={
                <EditableCopy
                  copyKey="studio_gallery_label"
                  fallback="STYLE GALLERY"
                  className="text-zinc-600"
                />
              }
            />
            <div className="px-10 xl:px-14 pb-10">
              <div className="flex gap-3 overflow-x-auto scrollbar-none pb-2">
                {studioExamplePresets.filter((p) => !!p.imageUrl).slice(0, 8).map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => { if (preset.prompt) setPrompt(preset.prompt); setActiveExampleId(preset.id); }}
                    className={[
                      "relative shrink-0 w-32 rounded-2xl overflow-hidden border-2 transition-all focus-visible:outline-none",
                      activeExampleId === preset.id
                        ? "border-violet-500 shadow-[0_0_0_3px_rgba(139,92,246,0.20)]"
                        : "border-white/10 hover:border-white/30",
                    ].join(" ")}
                  >
                    <img src={preset.imageUrl} alt={preset.label} className="w-full aspect-[3/4] object-cover block" loading="lazy" draggable={false} />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-6 pb-2 px-2">
                      <p className="text-[10px] font-bold text-white leading-tight">{preset.label}</p>
                    </div>
                  </button>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={demoMut.isPending || mut.isPending || !demoUrl}
                  onClick={() => {
                    const preset = studioExamplePresets.find((p) => p.id === activeExampleId);
                    demoMut.mutate({ promptOverride: preset?.prompt });
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-violet-500/50 bg-violet-500/10 px-4 py-2 text-xs font-semibold text-violet-300 hover:bg-violet-500/20 transition-colors disabled:opacity-50"
                >
                  {demoMut.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
                  Try with demo selfie →
                </button>
                <span className="text-[11px] text-zinc-600">
                  Runs the selected style with our sample face — no upload needed
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Settings Sheet ─────────────────────────────────────────── */}
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-2xl bg-zinc-950 border-white/10 px-4 pb-10">
          <SheetHeader className="mb-5">
            <SheetTitle className="text-base font-semibold text-zinc-100">Studio Settings</SheetTitle>
          </SheetHeader>

          {/* References */}
          <div className="space-y-3 mb-6">
            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">References</p>
            <div className="grid grid-cols-5 gap-2">
              <UploadSlot userId={user.id} label="You" hint="Selfie" value={selfie} onChange={setSelfie} />
              <UploadSlot userId={user.id} label="Outfit" hint="Wear" value={outfit} onChange={setOutfit} />
              <UploadSlot userId={user.id} label="Scene" hint="Vibe" value={scene} onChange={setScene} />
              <UploadSlot userId={user.id} label="Prop" hint="Mic/car" value={prop} onChange={setProp} />
              <UploadSlot userId={user.id} label="Pose" hint="Ref photo" value={motion} onChange={setMotion} />
            </div>
          </div>

          {/* Virtual Wardrobe */}
          <div className="space-y-3 mb-6">
            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Virtual Wardrobe</p>
            <WardrobePicker userId={user.id} value={outfit} onChange={setOutfit} />
          </div>

          {/* Model */}
          <div className="space-y-2 mb-6">
            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Image model</p>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="bg-zinc-900 border-white/10">
                <div className="flex items-center gap-2"><ModelBadge model={model} /><span className="text-sm">{getModelMeta(model).label}</span></div>
              </SelectTrigger>
              <SelectContent>
                {MODELS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    <div className="flex items-center gap-2 py-0.5">
                      <ModelBadge model={m.value} />
                      <div className="flex flex-col"><span className="text-sm">{m.label}</span><span className="text-[10px] text-zinc-500">{m.tagline}</span></div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Presets */}
          <div className="space-y-2 mb-6">
            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Presets</p>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((p) => {
                const active = activePreset === p.label;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => { setPrompt(p.prompt); setActivePreset(p.label); setSettingsOpen(false); }}
                    className={`relative overflow-hidden rounded-xl border text-left transition-colors ${active ? "border-[#8b5cf6]/70 ring-1 ring-[#8b5cf6]/40" : "border-white/8 hover:border-white/25"}`}
                  >
                    <img
                      src={PRESET_IMAGES[p.label] ?? MEDIA_ASSETS.custom}
                      alt=""
                      aria-hidden
                      loading="lazy"
                      draggable={false}
                      className="block w-full aspect-[4/3] object-cover"
                    />
                    <span className="absolute inset-x-0 bottom-0 flex items-end bg-gradient-to-t from-black/85 via-black/40 to-transparent px-2 pb-1.5 pt-6">
                      <span className="text-[11px] font-bold leading-tight text-white">{p.label}</span>
                    </span>
                    {active && (
                      <span className="absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full bg-[#8b5cf6] text-white">
                        <Check className="size-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick-start examples */}
          <div className="mb-6">
            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-2">Quick start</p>
            <ExampleChips presets={studioExamplePresets} activeId={activeExampleId}
              onSelect={(preset) => { if (preset.prompt) setPrompt(preset.prompt); setActiveExampleId(preset.id); }}
              generateDisabled={mut.isPending || demoMut.isPending}
              onGenerate={() => { if (mut.isPending || demoMut.isPending) return; const preset = studioExamplePresets.find((p) => p.id === activeExampleId); mut.mutate({ promptOverride: preset?.prompt ?? prompt }); setSettingsOpen(false); }}
              label="Quick start:" />
          </div>

          {/* Demo shot */}
          <Button disabled={demoMut.isPending || mut.isPending || !demoUrl} onClick={() => { demoMut.mutate(undefined); setSettingsOpen(false); }} variant="outline" className="w-full mb-6">
            {demoMut.isPending ? <><Loader2 className="size-4 mr-2 animate-spin" />Running demo…</> : <><Zap className="size-4 mr-2" />Try a demo (no upload needed)</>}
          </Button>

          {/* Video section */}
          {latest?.result_image_url && (
            <div className="space-y-3 mb-6 pt-5 border-t border-white/5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Animate this shot</p>
              <BringItToLifePreview active={cameraMovement} onPick={setCameraMovement} />
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-zinc-600">Video model</label>
                  <Select value={videoModel} onValueChange={setVideoModel}>
                    <SelectTrigger className="bg-zinc-900 border-white/10 h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {VIDEO_MODEL_LIST.map((m) => (
                        <SelectItem key={m.value} value={m.value} className="text-sm">
                          <div className="flex flex-col"><span>{m.label}</span><span className="text-[10px] text-zinc-500">{m.tagline}</span></div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-zinc-600">Camera move</label>
                  <Select value={cameraMovement} onValueChange={setCameraMovement}>
                    <SelectTrigger className="bg-zinc-900 border-white/10 h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="static">Static</SelectItem>
                      <SelectItem value="push_in">Push in</SelectItem>
                      <SelectItem value="pull_out">Pull out</SelectItem>
                      <SelectItem value="zoom_in">Slow zoom in</SelectItem>
                      <SelectItem value="zoom_out">Slow zoom out</SelectItem>
                      <SelectItem value="pan_left">Pan left</SelectItem>
                      <SelectItem value="pan_right">Pan right</SelectItem>
                      <SelectItem value="tilt_up">Tilt up</SelectItem>
                      <SelectItem value="tilt_down">Tilt down</SelectItem>
                      <SelectItem value="orbit_cw">Orbit clockwise</SelectItem>
                      <SelectItem value="orbit_ccw">Orbit counter-clockwise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Textarea rows={2} value={videoPrompt} onChange={(e) => setVideoPrompt(e.target.value)} className="resize-none bg-zinc-900 border-white/10 text-sm" />
              {videoModel.startsWith("kling") && (
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-zinc-600">End frame (optional)</label>
                  <div className="w-28"><UploadSlot userId={user.id} label="" hint="Where it ends" value={endFrameUrl} onChange={setEndFrameUrl} /></div>
                </div>
              )}
              <ResolutionPicker resolution={videoResolution} onChange={setVideoResolution} isPro={!!(profile?.is_pro || profile?.isAdmin)} features={["video"]} durationSeconds={5} model={videoModel} />
              <div className="flex items-center justify-between text-xs text-zinc-500 rounded-xl border border-white/8 bg-white/3 px-3 py-2">
                <span className="inline-flex items-center gap-1.5"><Zap className="size-3.5 text-[#8b5cf6]" />Cost: <span className="text-zinc-200 font-medium">{videoCost} Aura</span><span className="opacity-40">·</span>ETA: ~60–180s</span>
                <span>{getModelMeta(videoModel).short}</span>
              </div>
              <Button disabled={videoMut.isPending} onClick={() => { const isHd = videoResolution === "1080p" || videoResolution === "2160p"; if (videoPreviewId && isHd) setVideoHdDialogOpen(true); else videoMut.mutate(); }} variant="secondary" className="w-full">
                {videoMut.isPending ? <><Loader2 className="size-4 mr-2 animate-spin" />{videoPreviewId ? "Rendering…" : "Rendering preview…"}</> : videoPreviewId ? <><Film className="size-4 mr-2" />Render full · {videoCost} Aura</> : <><Film className="size-4 mr-2" />Preview · {videoPreviewCost} Aura</>}
              </Button>
            </div>
          )}

          {/* Lip sync */}
          {latestVideo?.result_video_url && (
            <div className="space-y-3 mb-6 pt-5 border-t border-white/5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Lip sync</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { v: "fal-ai/sync-lipsync/v2" as const, label: "Sync 1.9", hint: "Premium", icon: Sparkles },
                  { v: "fal-ai/wav2lip" as const, label: "Wav2Lip", hint: "Fast", icon: Zap },
                  { v: "latentsync" as const, label: "Self-hosted", hint: "Your GPU", icon: Server },
                ]).map((opt) => (
                  <button key={opt.v} type="button" onClick={() => setLipsyncModel(opt.v)}
                    className={`text-left rounded-xl border p-2.5 transition-colors ${lipsyncModel === opt.v ? "border-[#8b5cf6]/50 bg-[#8b5cf6]/10" : "border-white/8 bg-white/4 hover:border-white/20"}`}>
                    <div className="text-xs font-medium flex items-center gap-1.5"><opt.icon className="size-3.5" />{opt.label}</div>
                    <div className="text-[10px] text-zinc-600 mt-0.5">{opt.hint}</div>
                  </button>
                ))}
              </div>
              <UploadSlot userId={user.id} label="Audio" hint="Upload mp3/wav" accept={AUDIO_ACCEPT} kind="video" value={audioUrl} onChange={setAudioUrl} />
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input type="checkbox" checked={studioLipsyncConsent} onChange={(e) => setStudioLipsyncConsent(e.target.checked)} className="mt-0.5 size-4 accent-[#8b5cf6] shrink-0" />
                <span className="text-xs text-zinc-500 leading-relaxed">I confirm I have the legal right to use this voice and likeness. <Link to="/legal/$slug" params={{ slug: "ai-policy" }} className="underline hover:text-zinc-200" target="_blank">AI Policy</Link></span>
              </label>
              <Button disabled={lipSyncMut.isPending || !audioUrl || !studioLipsyncConsent} onClick={() => lipSyncMut.mutate()} variant="secondary" className="w-full">
                {lipSyncMut.isPending ? <><Loader2 className="size-4 mr-2 animate-spin" />Syncing…</> : <><Mic2 className="size-4 mr-2" />Lip sync · {lipsyncCost} Aura</>}
              </Button>
            </div>
          )}

          {/* Captions */}
          {latestVideo?.result_video_url && (
            <div className="space-y-3 mb-6 pt-5 border-t border-white/5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Captions</p>
              <Button variant="secondary" className="w-full" onClick={() => { setCaptionOpen(true); setSettingsOpen(false); }}>
                <Captions className="size-4 mr-2" />Add Captions · 20 Aura
              </Button>
            </div>
          )}

          {/* Audio generator */}
          <div className="pt-5 border-t border-white/5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-3">Audio</p>
            <HfAudioPanel onAudioReady={(url) => setAudioUrl(url)} />
          </div>
        </SheetContent>
      </Sheet>

      {/* AlertDialog for HD video confirm */}
      <AlertDialog open={videoHdDialogOpen} onOpenChange={setVideoHdDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Render at {videoResolution === "2160p" ? "4K (2160p)" : "HD (1080p)"}?</AlertDialogTitle>
            <AlertDialogDescription>This will charge <strong>{videoCost} Aura</strong> to produce a full-quality {videoResolution === "2160p" ? "4K" : "HD"} render.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => videoMut.mutate()}>Confirm &amp; Render</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {latestVideo?.result_video_url && (
        <CaptionDialog open={captionOpen} onOpenChange={setCaptionOpen} videoUrl={latestVideo.result_video_url} generationId={latestVideo.id} credits={profile?.credits}
          onDone={() => { qc.invalidateQueries({ queryKey: ["gens"] }); qc.invalidateQueries({ queryKey: ["gallery"] }); }} />
      )}
    </main>
  );
}