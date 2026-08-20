import { authNextSearch } from "@/lib/auth-return-path";
import { createLazyFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Clapperboard,
  Download,
  ExternalLink,
  Image as ImageIcon,
  LayoutTemplate,
  Loader2,
  Megaphone,
  Play,
  ShieldCheck,
  Sparkles,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { listGallery } from "@/lib/studio.functions";
import {
  createSparkAuthorizationCode,
  getSparkAuthorizationAvailability,
  initTiktokConnect,
} from "@/lib/tiktok-posting.functions";
import { exportAdCreativeZip, META_PLACEMENTS, type AdAssetKind } from "@/lib/ads-export";
import { PageSpinner } from "@/components/PageSpinner";
import { AuthRedirect } from "@/components/AuthRedirect";

export const Route = createLazyFileRoute("/ads")({ component: AdsStudioPage });

const CTAS = ["Learn more", "Shop now", "Sign up", "Get offer", "Contact us"] as const;
const FLOW = {
  meta: { label: "Meta Ads", description: "Feed, portrait, Stories and Reels creative", icon: Megaphone },
  tiktok: { label: "TikTok Spark Ads", description: "Authorize a post or export In-Feed fallback", icon: Clapperboard },
} as const;

type GalleryAdAsset = {
  id: string;
  prompt: string | null;
  result_image_url: string | null;
  result_video_url: string | null;
  created_at: string;
  model: string | null;
  is_watermarked: boolean | null;
};

function AssetVisual({
  asset,
  className,
  showSafeZone = false,
}: {
  asset: GalleryAdAsset;
  className?: string;
  showSafeZone?: boolean;
}) {
  const isVideo = !!asset.result_video_url;
  const url = asset.result_video_url ?? asset.result_image_url;
  if (!url) return null;
  return (
    <div className={`relative overflow-hidden bg-black ${className ?? ""}`}>
      {isVideo ? (
        <video src={url} muted autoPlay loop playsInline preload="metadata" className="size-full object-cover" aria-label="Selected video creative preview" />
      ) : (
        <img src={url} alt={asset.prompt || "Selected Aurora creative"} className="size-full object-cover" loading="eager" />
      )}
      {showSafeZone && isVideo ? (
        <>
          <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[13%] border-b border-dashed border-fuchsia-200/90 bg-fuchsia-500/20" />
          <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[22%] border-t border-dashed border-fuchsia-200/90 bg-fuchsia-500/20" />
          <span className="pointer-events-none absolute left-2 top-[14%] rounded-md bg-black/60 px-1.5 py-1 text-[9px] font-medium text-white">UI safe zone</span>
        </>
      ) : null}
    </div>
  );
}

function PlacementPreview({
  placement,
  asset,
  headline,
  primaryText,
  cta,
}: {
  placement: (typeof META_PLACEMENTS)[number];
  asset: GalleryAdAsset;
  headline: string;
  primaryText: string;
  cta: string;
}) {
  const vertical = placement.id === "stories";
  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
      <div className={vertical ? "aspect-[9/16]" : placement.id === "square" ? "aspect-square" : "aspect-[4/5]"}>
        <AssetVisual asset={asset} showSafeZone={vertical} />
      </div>
      <div className="space-y-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold">{placement.label}</p>
          <span className="text-[10px] text-muted-foreground">{placement.width}×{placement.height}</span>
        </div>
        <p className="line-clamp-2 text-xs text-muted-foreground">{primaryText || "Primary text appears here."}</p>
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold">{headline || "Your headline"}</p>
          <span className="shrink-0 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">{cta}</span>
        </div>
      </div>
    </article>
  );
}

function AdsStudioPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ from: "/ads" });
  const galleryFn = useServerFn(listGallery);
  const sparkAvailabilityFn = useServerFn(getSparkAuthorizationAvailability);
  const connectTikTokFn = useServerFn(initTiktokConnect);
  const sparkFn = useServerFn(createSparkAuthorizationCode);

  const [flow, setFlow] = useState<keyof typeof FLOW>("meta");
  const [selectedId, setSelectedId] = useState<string | null>(search.generationId ?? null);
  const [headline, setHeadline] = useState("");
  const [primaryText, setPrimaryText] = useState("");
  const [cta, setCta] = useState<(typeof CTAS)[number]>("Learn more");
  const [sparkPostUrl, setSparkPostUrl] = useState("");
  const [sparkCaption, setSparkCaption] = useState("");
  const [sparkCode, setSparkCode] = useState<{ code: string; expiresIn: number | null } | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth", search: authNextSearch() });
  }, [authLoading, user, navigate]);

  const gallery = useQuery({
    queryKey: ["gallery", false],
    queryFn: () => galleryFn({ data: { showHidden: false } }),
    enabled: !!user,
  });
  const sparkAvailability = useQuery({
    queryKey: ["tiktok-spark-availability"],
    queryFn: () => sparkAvailabilityFn(),
    enabled: !!user && flow === "tiktok",
  });

  // listGallery deliberately returns masked video URLs for watermarked work.
  // Ads must never offer those to direct /ads visitors, even though the
  // Gallery Share-menu entry already excludes them.
  const assets = ((gallery.data?.items ?? []) as GalleryAdAsset[]).filter((item) =>
    !item.is_watermarked && Boolean(item.result_image_url || item.result_video_url),
  );
  const selected = assets.find((item) => item.id === selectedId) ?? assets[0] ?? null;
  const selectedUrl = selected?.result_video_url ?? selected?.result_image_url ?? null;
  const selectedKind: AdAssetKind | null = selected?.result_video_url ? "video" : selected?.result_image_url ? "image" : null;
  const reelTextTooLong = primaryText.length > 72;
  const feedTextTooLong = primaryText.length > 125;

  useEffect(() => {
    if (search.generationId && assets.some((asset) => asset.id === search.generationId)) {
      setSelectedId(search.generationId);
    } else if (!selectedId && assets[0]) {
      setSelectedId(assets[0].id);
    }
  }, [search.generationId, selectedId, assets]);

  const sparkMutation = useMutation({
    mutationFn: () => sparkFn({ data: { postUrl: sparkPostUrl.trim() } }),
    onSuccess: (data) => {
      setSparkCode({ code: data.authorizationCode, expiresIn: data.expiresIn });
      toast.success("Spark authorization code ready");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Couldn’t create a Spark authorization code."),
  });
  const connectMutation = useMutation({
    mutationFn: () => connectTikTokFn(),
    onSuccess: ({ authUrl }) => { window.location.assign(authUrl); },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Couldn’t connect TikTok."),
  });

  const exportPack = async (platform: "meta" | "tiktok") => {
    if (!selected || !selectedUrl || !selectedKind) {
      toast.error("Pick a finished gallery image or video first.");
      return;
    }
    if (platform === "meta" && (headline.length > 40 || feedTextTooLong)) {
      toast.error("Shorten your Meta copy before exporting.");
      return;
    }
    if (platform === "tiktok" && sparkCaption.length > 100) {
      toast.error("TikTok captions are limited to 100 characters.");
      return;
    }
    setExporting(true);
    try {
      const result = await exportAdCreativeZip({
        assetUrl: selectedUrl,
        assetKind: selectedKind,
        headline,
        primaryText,
        cta,
        caption: platform === "tiktok" ? sparkCaption : undefined,
        platform,
      });
      if (result.missing.length) {
        toast.warning("Creative pack downloaded with notes", { description: result.missing.join(" ") });
      } else {
        toast.success("Creative pack downloaded");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn’t export this creative pack.");
    } finally {
      setExporting(false);
    }
  };

  if (authLoading) return <PageSpinner />;
  if (!user) return <AuthRedirect />;

  return (
    <main className="aurora-page-shell text-foreground">
      <span aria-hidden className="aurora-ambient" />
      <header className="relative z-10 border-b border-border bg-background/80 px-5 py-5 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-4">
          <Link to="/gallery" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="size-4" /> Gallery
          </Link>
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <ShieldCheck className="size-3.5" /> No Aura spent
          </span>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-[1480px] px-5 py-8">
        <section className="mb-8 max-w-3xl">
          <div className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            <Megaphone className="size-3.5" /> Finished work, campaign-ready
          </div>
          <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-5xl">Ads Studio</h1>
          <p className="mt-3 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground">
            Turn a finished Aurora image or video into placement previews, ad copy, safe-zone guides, and a shareable creative pack—without starting a new generation.
          </p>
        </section>

        <div className="mb-7 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))" }}>
          {(Object.entries(FLOW) as [keyof typeof FLOW, (typeof FLOW)[keyof typeof FLOW]][]).map(([id, item]) => {
            const Icon = item.icon;
            const active = flow === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setFlow(id)}
                aria-pressed={active}
                className={`flex min-h-24 items-center gap-4 rounded-2xl border p-4 text-left transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                  active ? "border-primary/50 bg-primary/10 shadow-[var(--shadow-glow-soft)]" : "border-border bg-card hover:border-primary/30"
                }`}
              >
                <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  <Icon className="size-5" />
                </span>
                <span>
                  <span className="block font-semibold">{item.label}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{item.description}</span>
                </span>
                {active ? <Check className="ml-auto size-4 text-primary" /> : <ChevronRight className="ml-auto size-4 text-muted-foreground" />}
              </button>
            );
          })}
        </div>

        {gallery.isLoading ? (
          <div className="flex min-h-80 items-center justify-center rounded-3xl border border-border bg-card"><Loader2 className="size-7 animate-spin text-primary" /></div>
        ) : gallery.isError ? (
          <div role="alert" className="rounded-3xl border border-destructive/40 bg-destructive/10 p-8 text-sm text-destructive">Your gallery could not be loaded. Refresh the page and try again.</div>
        ) : !assets.length ? (
          <section className="rounded-3xl border border-border bg-card p-8">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Sparkles className="size-6" /></div>
            <h2 className="mt-5 text-xl font-semibold">Choose a finished creative first</h2>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">Ads Studio only works with your completed gallery images and videos. Create or finish a shot, then return here from its Share menu.</p>
            <Link to="/studio" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Open Studio <ChevronRight className="size-4" /></Link>
          </section>
        ) : (
          <div className="grid gap-6" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
            <section className="rounded-3xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">1. Pick a finished creative</h2>
                  <p className="mt-1 text-xs text-muted-foreground">Only completed, unwatermarked gallery work is available.</p>
                </div>
                <Link to="/gallery" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">Open gallery <ExternalLink className="size-3" /></Link>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {assets.slice(0, 18).map((asset) => {
                  const active = selected?.id === asset.id;
                  return (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => setSelectedId(asset.id)}
                      aria-pressed={active}
                      className={`relative w-28 shrink-0 overflow-hidden rounded-xl border text-left transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${active ? "border-primary ring-2 ring-primary/25" : "border-border hover:border-primary/40"}`}
                    >
                      <AssetVisual asset={asset} className="aspect-square" />
                      <span className="absolute bottom-1 left-1 inline-flex items-center gap-1 rounded-md bg-black/65 px-1.5 py-1 text-[9px] font-medium text-white">
                        {asset.result_video_url ? <Video className="size-2.5" /> : <ImageIcon className="size-2.5" />} {asset.result_video_url ? "Video" : "Image"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {selected ? (
              flow === "meta" ? (
                <section className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))" }}>
                  <div className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
                    <div className="mb-5 flex items-center gap-3">
                      <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><LayoutTemplate className="size-5" /></span>
                      <div><h2 className="font-semibold">2. Write Meta-ready copy</h2><p className="text-xs text-muted-foreground">One creative, placement-aware limits.</p></div>
                    </div>
                    <label className="block text-sm font-medium" htmlFor="ad-headline">Headline <span className={headline.length > 40 ? "text-destructive" : "text-muted-foreground"}>({headline.length}/40)</span></label>
                    <input id="ad-headline" value={headline} onChange={(event) => setHeadline(event.target.value.slice(0, 40))} maxLength={40} placeholder="A concise campaign headline" className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" />
                    <label className="mt-5 block text-sm font-medium" htmlFor="ad-primary-text">Primary text <span className={feedTextTooLong ? "text-destructive" : "text-muted-foreground"}>({primaryText.length}/125)</span></label>
                    <textarea id="ad-primary-text" value={primaryText} onChange={(event) => setPrimaryText(event.target.value.slice(0, 125))} maxLength={125} placeholder="Explain the offer in one clear sentence." className="mt-2 min-h-28 w-full resize-y rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" />
                    <p className={`mt-2 text-xs ${reelTextTooLong ? "text-amber-600 dark:text-amber-300" : "text-muted-foreground"}`}>Reels supports up to 72 characters. Feed supports up to 125.</p>
                    <label className="mt-5 block text-sm font-medium" htmlFor="ad-cta">Call to action</label>
                    <select id="ad-cta" value={cta} onChange={(event) => setCta(event.target.value as (typeof CTAS)[number])} className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20">
                      {CTAS.map((item) => <option key={item}>{item}</option>)}
                    </select>
                    <button type="button" onClick={() => void exportPack("meta")} disabled={exporting || feedTextTooLong} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">
                      {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} {exporting ? "Building pack…" : "Export Meta creative ZIP"}
                    </button>
                    <p className="mt-3 text-center text-[11px] text-muted-foreground">Includes 1080×1080, 1080×1350, 1080×1920 assets when your browser supports local video encoding, plus guides and a copy sheet.</p>
                  </div>
                  <div className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
                    <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="font-semibold">3. Preview placements</h2><p className="text-xs text-muted-foreground">Video previews show the UI safety bands.</p></div><Play className="size-5 text-primary" /></div>
                    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
                      {META_PLACEMENTS.map((placement) => <PlacementPreview key={placement.id} placement={placement} asset={selected} headline={headline} primaryText={primaryText} cta={cta} />)}
                    </div>
                  </div>
                </section>
              ) : (
                <section className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))" }}>
                  <div className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
                    <div className="mb-5 flex items-center gap-3">
                      <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Clapperboard className="size-5" /></span>
                      <div><h2 className="font-semibold">TikTok Spark Ads handoff</h2><p className="text-xs text-muted-foreground">Authorize an existing post; no campaign is published from Aurora.</p></div>
                    </div>
                    {!selected.result_video_url ? <div role="alert" className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-200">Spark Ads requires a finished video. Choose a video from the creative rail above.</div> : null}
                    {sparkAvailability.isLoading ? <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Checking TikTok connection…</div> : null}
                    {!sparkAvailability.isLoading && !sparkAvailability.data?.connected ? (
                      <div className="mt-4 rounded-2xl border border-border bg-muted/40 p-4">
                        <p className="text-sm font-medium">TikTok is not connected</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{sparkAvailability.data?.reason ?? "Connect an account to request Spark authorization codes. You can still export the In-Feed fallback below."}</p>
                        <button type="button" onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">{connectMutation.isPending ? <Loader2 className="size-3 animate-spin" /> : <ExternalLink className="size-3" />} Connect TikTok</button>
                      </div>
                    ) : null}
                    {sparkAvailability.data?.connected && !sparkAvailability.data.available ? (
                      <div role="status" className="mt-4 rounded-2xl border border-amber-500/35 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-200">
                        {sparkAvailability.data.reason}
                      </div>
                    ) : null}
                    {sparkAvailability.data?.available ? (
                      <div className="mt-4">
                        <label className="block text-sm font-medium" htmlFor="spark-post-url">Existing TikTok post URL</label>
                        <input id="spark-post-url" value={sparkPostUrl} onChange={(event) => { setSparkPostUrl(event.target.value); setSparkCode(null); }} placeholder="https://www.tiktok.com/@creator/video/…" className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" />
                        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Use the full public post URL. Short links are blocked for safety. Connected content can be selected from your finished video rail, then paste its live TikTok post link here.</p>
                        <button type="button" onClick={() => sparkMutation.mutate()} disabled={!selected.result_video_url || !sparkPostUrl.trim() || sparkMutation.isPending} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">{sparkMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Generate Spark authorization code</button>
                      </div>
                    ) : null}
                    {sparkCode ? <div className="mt-4 rounded-2xl border border-primary/35 bg-primary/10 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-primary">Authorization code</p><code className="mt-2 block break-all rounded-lg bg-background/80 p-3 text-sm font-semibold">{sparkCode.code}</code><p className="mt-3 text-xs leading-relaxed text-muted-foreground">{sparkCode.expiresIn ? `Use within ${sparkCode.expiresIn} seconds. ` : ""}In TikTok Ads Manager, create a Spark Ad, choose “Use a post from another account,” and paste this code before it expires.</p></div> : null}
                  </div>

                  <div className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
                    <div className="mb-4 flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Video className="size-5" /></span><div><h2 className="font-semibold">In-Feed fallback pack</h2><p className="text-xs text-muted-foreground">1080×1920 guide plus a caption sheet.</p></div></div>
                    <div className="overflow-hidden rounded-2xl border border-border"><AssetVisual asset={selected} className="aspect-[9/16] max-h-[420px]" showSafeZone /></div>
                    <label className="mt-5 block text-sm font-medium" htmlFor="spark-caption">Caption <span className={sparkCaption.length > 100 ? "text-destructive" : "text-muted-foreground"}>({sparkCaption.length}/100)</span></label>
                    <textarea id="spark-caption" value={sparkCaption} onChange={(event) => setSparkCaption(event.target.value.slice(0, 100))} maxLength={100} placeholder="Write the In-Feed caption." className="mt-2 min-h-24 w-full resize-y rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" />
                    <button type="button" onClick={() => void exportPack("tiktok")} disabled={!selected.result_video_url || exporting} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary/35 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary transition hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-50">{exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Export TikTok In-Feed ZIP</button>
                    <p className="mt-3 text-center text-[11px] text-muted-foreground">Includes the original finished video, 1080×1920 safe-zone guide, caption sheet, and upload notes.</p>
                  </div>
                </section>
              )
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}