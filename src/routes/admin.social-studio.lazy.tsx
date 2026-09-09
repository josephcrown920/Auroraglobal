import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronRight,
  Clipboard,
  Clock3,
  Download,
  Film,
  ImagePlus,
  Instagram,
  LayoutGrid,
  Loader2,
  Megaphone,
  PackageOpen,
  Play,
  RefreshCw,
  Send,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { handleGenerationError } from "@/lib/error-toasts";
import { saveAssetToDisk } from "@/lib/save";
import {
  AURORA_MARKETING_FEATURES,
  getAuroraMarketingFeature,
} from "@/lib/social-studio.catalog";
import {
  generateMarketingCampaign,
  type MarketingCampaignItem,
  type MarketingCampaignPlan,
} from "@/lib/social-studio.functions";
import {
  usePerformanceShotJobFn,
  useVideoFromImageJobFn,
} from "@/lib/use-job-polling";

export const Route = createLazyFileRoute("/admin/social-studio")({
  component: AuroraMarketingStudio,
});

type StudioView = "create" | "campaign" | "calendar" | "queue";
type PostStatus = "draft" | "approved" | "scheduled" | "published";
type Channel = "instagram_feed" | "instagram_carousel" | "instagram_reel" | "instagram_story";
type CampaignItem = MarketingCampaignItem & {
  /**
   * Slot-indexed visuals: for a carousel, index i is slide i's image (or null
   * when that slide's render failed); for feed/reel posts a single slot.
   * Indexed (not compacted) so a failed slide never shifts later slides'
   * numbering in the card, manifest or downloads.
   */
  assetUrls: Array<string | null>;
  videoUrl: string | null;
  status: PostStatus;
  scheduledDate: string;
};
type CampaignState = Omit<MarketingCampaignPlan, "items"> & {
  id: string;
  featureId: string;
  featureName: string;
  createdAt: string;
  provider: string;
  items: CampaignItem[];
};

const CAMPAIGN_KEY = "aurora.marketing_studio.campaign.v2";
const CHANNELS: Array<{ id: Channel; label: string }> = [
  { id: "instagram_feed", label: "Feed" },
  { id: "instagram_carousel", label: "Carousel" },
  { id: "instagram_reel", label: "Reels" },
  { id: "instagram_story", label: "Stories" },
];
const GOALS = [
  ["launch", "Feature launch"],
  ["feature_education", "Feature education"],
  ["announcement", "Announcement"],
  ["tutorial", "Tutorial"],
  ["community", "Community"],
  ["conversion", "Conversion"],
] as const;
const TONES = [
  ["cinematic", "Cinematic"],
  ["editorial", "Editorial"],
  ["artist_first", "Artist-first"],
  ["playful", "Playful"],
  ["technical", "Technical"],
] as const;
const STATUS_STYLES: Record<PostStatus, string> = {
  draft: "border-white/10 bg-white/5 text-white/55",
  approved: "border-violet-400/35 bg-violet-400/10 text-violet-200",
  scheduled: "border-cyan-400/35 bg-cyan-400/10 text-cyan-200",
  published: "border-emerald-400/35 bg-emerald-400/10 text-emerald-200",
};

function readCampaign(): CampaignState | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(CAMPAIGN_KEY) ?? "null") as unknown;
    if (!value || typeof value !== "object") return null;
    const candidate = value as Partial<CampaignState>;
    if (typeof candidate.id !== "string" || !Array.isArray(candidate.items)) return null;
    if (!candidate.items.every((item) => item && typeof item === "object" && typeof (item as CampaignItem).id === "string" && Array.isArray((item as CampaignItem).assetUrls))) return null;
    return candidate as CampaignState;
  } catch {
    return null;
  }
}

function safeFileName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "campaign";
}

/** First rendered visual of a post, skipping failed slots. */
function firstVisual(item: Pick<CampaignItem, "assetUrls">): string | null {
  return item.assetUrls.find((url): url is string => Boolean(url)) ?? null;
}

/** Rendered visuals with their original slot numbers preserved. */
function renderedVisuals(item: Pick<CampaignItem, "assetUrls">): Array<{ slot: number; url: string }> {
  return item.assetUrls.flatMap((url, index) => (url ? [{ slot: index + 1, url }] : []));
}

function failedSlots(item: Pick<CampaignItem, "assetUrls">): number[] {
  return item.assetUrls.flatMap((url, index) => (url ? [] : [index + 1]));
}

function AuroraMarketingStudio() {
  const campaignFn = useServerFn(generateMarketingCampaign);
  const generateImage = usePerformanceShotJobFn();
  const generateVideo = useVideoFromImageJobFn();
  const [view, setView] = useState<StudioView>(() => (readCampaign() ? "campaign" : "create"));
  const [campaign, setCampaign] = useState<CampaignState | null>(() => readCampaign());
  const [featureId, setFeatureId] = useState("video-agent");
  const [customCapability, setCustomCapability] = useState("");
  const [goal, setGoal] = useState<(typeof GOALS)[number][0]>("feature_education");
  const [tone, setTone] = useState<(typeof TONES)[number][0]>("artist_first");
  const [channels, setChannels] = useState<Channel[]>(["instagram_feed", "instagram_carousel", "instagram_reel"]);
  const [days, setDays] = useState(7);
  const [postCount, setPostCount] = useState(7);
  const [notes, setNotes] = useState("");
  const [planning, setPlanning] = useState(false);
  // Activity is keyed by `${campaignId}:${itemId}` and every async render
  // captures the campaign id it started under, so a render that completes
  // after "New campaign" can neither write into the replacement campaign
  // (model-generated item ids like "day-1-reel" repeat) nor clear its spinners.
  const [activity, setActivity] = useState<Record<string, "visuals" | "reel">>({});
  const campaignIdRef = useRef<string | null>(campaign?.id ?? null);
  campaignIdRef.current = campaign?.id ?? null;

  useEffect(() => {
    if (!campaign) return;
    try {
      window.localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(campaign));
    } catch (error) {
      console.warn("[marketing-studio] campaign could not be saved locally", error);
      toast.error("Campaign could not be saved in this browser — export the manifest before leaving");
    }
  }, [campaign]);

  const feature = getAuroraMarketingFeature(campaign?.featureId ?? featureId) ?? AURORA_MARKETING_FEATURES[0];
  const calendarDays = useMemo(() => {
    if (!campaign) return [];
    const maxDay = Math.max(days, ...campaign.items.map((item) => item.day));
    return Array.from({ length: maxDay }, (_, index) => ({
      day: index + 1,
      items: campaign.items.filter((item) => item.day === index + 1),
    }));
  }, [campaign, days]);

  function patchItem(id: string, patch: Partial<CampaignItem>, campaignId = campaignIdRef.current) {
    setCampaign((current) =>
      current && current.id === campaignId
        ? { ...current, items: current.items.map((item) => (item.id === id ? { ...item, ...patch } : item)) }
        : current,
    );
  }

  function activityKey(campaignId: string | null, itemId: string) {
    return `${campaignId ?? "none"}:${itemId}`;
  }

  function beginActivity(campaignId: string | null, itemId: string, kind: "visuals" | "reel") {
    setActivity((current) => ({ ...current, [activityKey(campaignId, itemId)]: kind }));
  }

  function endActivity(campaignId: string | null, itemId: string) {
    setActivity((current) => {
      const next = { ...current };
      delete next[activityKey(campaignId, itemId)];
      return next;
    });
  }

  async function createCampaign() {
    if (!channels.length) {
      toast.error("Choose at least one Instagram format");
      return;
    }
    setPlanning(true);
    try {
      const result = await campaignFn({
        data: { featureId, customCapability, goal, tone, channels, days, postCount, notes },
      });
      const next: CampaignState = {
        ...result.campaign,
        id: crypto.randomUUID(),
        featureId,
        featureName: result.feature.name,
        createdAt: result.generatedAt,
        provider: result.provider,
        items: result.campaign.items.map((item) => ({
          ...item,
          assetUrls: [],
          videoUrl: null,
          status: "draft",
          scheduledDate: "",
        })),
      };
      setCampaign(next);
      setView("campaign");
      toast.success(`${next.items.length}-post campaign ready`);
    } catch (error) {
      handleGenerationError(error);
    } finally {
      setPlanning(false);
    }
  }

  async function generateVisuals(item: CampaignItem) {
    const campaignId = campaignIdRef.current;
    beginActivity(campaignId, item.id, "visuals");
    try {
      const prompts =
        item.format === "carousel" && item.slides.length
          ? item.slides.map(
              (slide, index) =>
                `${slide.visualPrompt}. Instagram carousel slide ${index + 1} of ${item.slides.length}. ${slide.heading}: ${slide.body}. Keep typography areas clean and mobile readable.`,
            )
          : [item.visualPrompt];
      // Retry semantics: when a previous run left failed slots, render ONLY
      // those slots and keep every slide that already succeeded. A fresh run
      // (no slots yet, or a slot-count mismatch) renders everything.
      const previous = item.assetUrls.length === prompts.length ? item.assetUrls : prompts.map(() => null);
      const pending = prompts.map((prompt, index) => ({ prompt, index })).filter(({ index }) => !previous[index]);
      const targets = pending.length ? pending : prompts.map((prompt, index) => ({ prompt, index }));
      const settled = await Promise.allSettled(
        targets.map(({ prompt }) => generateImage({ data: { prompt, imageUrls: [], motionVideoUrl: null } })),
      );
      const next = pending.length ? [...previous] : prompts.map(() => null as string | null);
      let succeeded = 0;
      settled.forEach((result, position) => {
        if (result.status === "fulfilled") {
          next[targets[position].index] = result.value.resultUrl;
          succeeded++;
        }
      });
      const failures = settled.length - succeeded;
      if (succeeded) patchItem(item.id, { assetUrls: next }, campaignId);
      if (succeeded) toast.success(`${succeeded} visual${succeeded === 1 ? "" : "s"} ready`);
      if (failures) {
        const slots = targets.filter((_, position) => settled[position].status === "rejected").map(({ index }) => index + 1);
        toast.error(
          prompts.length > 1
            ? `Slide${slots.length === 1 ? "" : "s"} ${slots.join(", ")} failed — finished slides were kept; use Retry to render only the missing ones`
            : "Visual failed",
        );
      }
      if (!succeeded) {
        const first = settled.find((result) => result.status === "rejected") as PromiseRejectedResult | undefined;
        if (first) handleGenerationError(first.reason);
      }
    } finally {
      endActivity(campaignId, item.id);
    }
  }

  async function generateReel(item: CampaignItem) {
    const campaignId = campaignIdRef.current;
    beginActivity(campaignId, item.id, "reel");
    try {
      let imageUrl = firstVisual(item);
      if (!imageUrl) {
        const image = await generateImage({
          data: { prompt: item.visualPrompt, imageUrls: [], motionVideoUrl: null },
        });
        imageUrl = image.resultUrl;
        patchItem(item.id, { assetUrls: [imageUrl] }, campaignId);
      }
      if (campaignIdRef.current !== campaignId) {
        // The operator reset the campaign while the still was rendering: do
        // not spend on a Reel nobody can see.
        toast.error("Campaign was reset — Reel cancelled before rendering");
        return;
      }
      const video = await generateVideo({
        data: {
          imageUrl,
          prompt: item.reelPrompt || `${item.visualPrompt}. Subtle confident camera movement for a premium Instagram Reel.`,
          duration: 5,
          resolution: "720p",
          modelKey: "seedance-2.0-fast",
        },
      });
      patchItem(item.id, { videoUrl: video.videoUrl }, campaignId);
      toast.success(video.preview ? "Reel preview rendered (480p proof pass)" : "Reel rendered");
    } catch (error) {
      handleGenerationError(error);
    } finally {
      endActivity(campaignId, item.id);
    }
  }

  function toggleChannel(channel: Channel) {
    setChannels((current) =>
      current.includes(channel) ? current.filter((item) => item !== channel) : [...current, channel],
    );
  }

  async function copyPost(item: CampaignItem) {
    await navigator.clipboard.writeText(
      `${item.caption}\n\n${item.hashtags.map((tag) => `#${tag.replace(/^#/, "")}`).join(" ")}`,
    );
    toast.success("Caption and hashtags copied");
  }

  function exportManifest() {
    if (!campaign) return;
    const lines = campaign.items.map(
      (item) =>
        [
          `DAY ${item.day} · ${item.format.toUpperCase()} · ${item.status.toUpperCase()}`,
          item.scheduledDate ? `Scheduled: ${item.scheduledDate} ${item.recommendedTime}` : `Recommended: ${item.recommendedTime}`,
          item.title,
          item.caption,
          item.hashtags.map((tag) => `#${tag.replace(/^#/, "")}`).join(" "),
          `CTA: ${item.cta}`,
          item.videoUrl ? `Video: ${item.videoUrl}` : "",
          ...renderedVisuals(item).map(({ slot, url }) => `Visual ${slot}: ${url}`),
          ...(failedSlots(item).length && firstVisual(item) ? [`Missing visuals: slot ${failedSlots(item).join(", ")}`] : []),
        ]
          .filter(Boolean)
          .join("\n"),
    );
    const blob = new Blob(
      [`${campaign.name}\n${campaign.strategy}\n\n${lines.join(`\n\n${"─".repeat(64)}\n\n`)}`],
      { type: "text/plain;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${safeFileName(campaign.name)}-posting-manifest.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Posting manifest downloaded");
  }

  async function downloadCampaignAssets() {
    if (!campaign) return;
    const assets = campaign.items.flatMap((item) => [
      ...renderedVisuals(item).map(({ slot, url }) => ({ url, name: `${safeFileName(item.title)}-${slot}.png` })),
      ...(item.videoUrl ? [{ url: item.videoUrl, name: `${safeFileName(item.title)}-reel.mp4` }] : []),
    ]);
    if (!assets.length) {
      toast.error("Generate campaign visuals first");
      return;
    }
    for (const asset of assets) {
      await saveAssetToDisk(asset.url, asset.name);
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
    toast.success(`${assets.length} campaign asset${assets.length === 1 ? "" : "s"} downloaded`);
  }

  function startNewCampaign() {
    setCampaign(null);
    setActivity({});
    try {
      window.localStorage.removeItem(CAMPAIGN_KEY);
    } catch {
      toast.error("Could not clear the saved campaign from this browser — it may reappear after reload");
    }
    setView("create");
  }

  return (
    <main className="aurora-page-shell min-h-screen text-foreground">
      <span aria-hidden className="aurora-ambient" />
      <header className="relative z-20 border-b border-white/10 bg-black/55 px-4 py-2.5 backdrop-blur-xl md:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              to="/admin"
              aria-label="Back to admin"
              className="grid size-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/5 text-white/65 transition hover:text-white"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-300">
                <Instagram className="size-3" /> Operator tool
              </div>
              <h1 className="truncate text-lg font-semibold tracking-tight">Marketing Studio</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {campaign && (
              <Button variant="outline" size="sm" onClick={startNewCampaign} className="gap-1.5">
                <RefreshCw className="size-3.5" />
                <span className="sr-only">New campaign</span>
                <span aria-hidden>New</span>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={exportManifest} disabled={!campaign} className="gap-1.5">
              <Download className="size-3.5" /> Export
            </Button>
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-9">
        <section className="mb-7 overflow-hidden rounded-[28px] border border-violet-400/20 bg-[radial-gradient(circle_at_80%_0%,rgba(139,92,246,0.26),transparent_38%),linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02))] p-6 md:p-9">
          <div className="grid items-end gap-8 lg:grid-cols-[1fr_0.8fr]">
            <div>
              <p className="aurora-kicker mb-3">Aurora&apos;s social newsroom</p>
              <h2 className="max-w-3xl text-3xl font-semibold leading-[0.98] tracking-[-0.04em] md:text-5xl">
                Turn Aurora&apos;s features into a week of{" "}
                <span className="aurora-gradient-text">visual-first Instagram content.</span>
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-white/60 md:text-base">
                Plan the campaign, render feed and carousel visuals, create short Reels, approve the copy, and move every
                post through a review-first publish queue before it is posted by hand.
              </p>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {AURORA_MARKETING_FEATURES.slice(0, 4).map((item) => (
                <div key={item.id} className="overflow-hidden rounded-xl border border-white/10 bg-black/25">
                  <img src={item.preview} alt="" className="aspect-[3/4] w-full object-cover opacity-85" />
                </div>
              ))}
            </div>
          </div>
        </section>

        <nav aria-label="Marketing Studio sections" className="mb-6 flex gap-2 overflow-x-auto pb-1">
          {[
            ["create", "Brief", Sparkles],
            ["campaign", "Campaign", LayoutGrid],
            ["calendar", "Calendar", CalendarDays],
            ["queue", "Publish queue", Send],
          ].map(([id, label, Icon]) => (
            <button
              key={id as string}
              type="button"
              onClick={() => setView(id as StudioView)}
              disabled={!campaign && id !== "create"}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-35",
                view === id
                  ? "border-violet-400/50 bg-violet-400/15 text-white"
                  : "border-white/10 bg-white/[0.035] text-white/55 hover:text-white",
              )}
            >
              <Icon className="size-4" /> {label as string}
            </button>
          ))}
        </nav>

        {view === "create" && (
          <CampaignBrief
            featureId={featureId}
            setFeatureId={setFeatureId}
            customCapability={customCapability}
            setCustomCapability={setCustomCapability}
            goal={goal}
            setGoal={setGoal}
            tone={tone}
            setTone={setTone}
            channels={channels}
            toggleChannel={toggleChannel}
            days={days}
            setDays={setDays}
            postCount={postCount}
            setPostCount={setPostCount}
            notes={notes}
            setNotes={setNotes}
            planning={planning}
            createCampaign={createCampaign}
          />
        )}

        {view === "campaign" && campaign && (
          <section>
            <CampaignHeading campaign={campaign} />
            <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-5">
              {campaign.items.map((item) => (
                <PostCard
                  key={item.id}
                  item={item}
                  fallbackImage={feature.preview}
                  activity={activity[activityKey(campaign.id, item.id)]}
                  patchItem={patchItem}
                  generateVisuals={generateVisuals}
                  generateReel={generateReel}
                  copyPost={copyPost}
                />
              ))}
            </div>
          </section>
        )}

        {view === "calendar" && campaign && (
          <section className="space-y-4">
            <CampaignHeading campaign={campaign} />
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-3">
              {calendarDays.map(({ day, items }) => (
                <div key={day} className="min-h-44 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-semibold">Day {day}</h3>
                    <span className="text-xs text-white/35">{items.length} post{items.length === 1 ? "" : "s"}</span>
                  </div>
                  <div className="space-y-2">
                    {items.length ? (
                      items.map((item) => (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() => setView("campaign")}
                          className="flex w-full items-center gap-3 rounded-xl border border-white/8 bg-black/20 p-2.5 text-left transition hover:border-violet-400/30"
                        >
                          <img
                            src={firstVisual(item) || feature.preview}
                            alt=""
                            className="size-12 rounded-lg object-cover"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{item.title}</span>
                            <span className="text-xs capitalize text-white/40">{item.format} · {item.recommendedTime}</span>
                          </span>
                          <span className={cn("rounded-full border px-2 py-0.5 text-[10px] capitalize", STATUS_STYLES[item.status])}>
                            {item.status}
                          </span>
                        </button>
                      ))
                    ) : (
                      <p className="pt-8 text-center text-xs text-white/30">No post planned</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {view === "queue" && campaign && (
          <section className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <CampaignHeading campaign={campaign} />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => void downloadCampaignAssets()} className="gap-1.5">
                  <PackageOpen className="size-3.5" /> Download assets
                </Button>
                <Button size="sm" onClick={exportManifest} className="gap-1.5">
                  <Download className="size-3.5" /> Export posting manifest
                </Button>
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-white/10">
              {campaign.items.map((item) => (
                <div key={item.id} className="grid gap-3 border-b border-white/8 bg-white/[0.025] p-4 last:border-0 md:grid-cols-[72px_1fr_auto] md:items-center">
                  <img src={firstVisual(item) || feature.preview} alt="" className="aspect-square size-[72px] rounded-xl object-cover" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-medium">{item.title}</h3>
                      <span className="text-xs capitalize text-white/40">{item.format}</span>
                    </div>
                    <p className="mt-1 line-clamp-1 text-sm text-white/45">{item.caption}</p>
                    <p className="mt-1 text-xs text-white/30">
                      Day {item.day} · {item.scheduledDate || "Date not set"} · {item.recommendedTime}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => void copyPost(item)} className="rounded-lg border border-white/10 p-2 text-white/55 hover:text-white" aria-label={`Copy ${item.title}`}>
                      <Clipboard className="size-4" />
                    </button>
                    <select
                      aria-label={`Publishing status for ${item.title}`}
                      value={item.status}
                      onChange={(event) => patchItem(item.id, { status: event.target.value as PostStatus })}
                      className={cn("rounded-lg border px-3 py-2 text-xs capitalize outline-none", STATUS_STYLES[item.status])}
                    >
                      <option value="draft">Draft</option>
                      <option value="approved">Approved</option>
                      <option value="scheduled">Scheduled</option>
                      <option value="published">Published</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-white/35">
              Publishing is intentionally review-first. “Published” records the operator handoff; direct Instagram
              posting will only appear after an authenticated Meta publishing connection is added.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}

type BriefProps = {
  featureId: string;
  setFeatureId: (value: string) => void;
  customCapability: string;
  setCustomCapability: (value: string) => void;
  goal: (typeof GOALS)[number][0];
  setGoal: (value: (typeof GOALS)[number][0]) => void;
  tone: (typeof TONES)[number][0];
  setTone: (value: (typeof TONES)[number][0]) => void;
  channels: Channel[];
  toggleChannel: (channel: Channel) => void;
  days: number;
  setDays: (value: number) => void;
  postCount: number;
  setPostCount: (value: number) => void;
  notes: string;
  setNotes: (value: string) => void;
  planning: boolean;
  createCampaign: () => Promise<void>;
};

function CampaignBrief(props: BriefProps) {
  const selected = getAuroraMarketingFeature(props.featureId) ?? AURORA_MARKETING_FEATURES[0];
  return (
    <section className="grid gap-6 lg:grid-cols-[1.18fr_0.82fr]">
      <div className="space-y-5">
        <div>
          <p className="aurora-kicker mb-3">1 · Choose what Aurora is promoting</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {AURORA_MARKETING_FEATURES.map((feature) => (
              <button
                type="button"
                key={feature.id}
                onClick={() => props.setFeatureId(feature.id)}
                className={cn(
                  "group overflow-hidden rounded-2xl border text-left transition",
                  props.featureId === feature.id
                    ? "border-violet-400/70 bg-violet-400/10 shadow-[0_0_35px_-20px_rgba(167,139,250,0.9)]"
                    : "border-white/10 bg-white/[0.035] hover:border-white/25",
                )}
              >
                <img src={feature.preview} alt="" className="aspect-[4/3] w-full object-cover transition group-hover:scale-[1.02]" />
                <span className="block px-3 py-2.5 text-xs font-medium">{feature.name}</span>
              </button>
            ))}
          </div>
        </div>
        {props.featureId === "custom" && (
          <div>
            <label htmlFor="custom-capability" className="mb-2 block text-sm font-medium">Verified capability notes</label>
            <Textarea id="custom-capability" value={props.customCapability} onChange={(event) => props.setCustomCapability(event.target.value)} placeholder="Describe exactly what the new Aurora capability does and what visual proof exists. These notes are the only facts the planner is given — the claim audit flags known bad patterns, but you still fact-check every post before it is approved." rows={4} />
          </div>
        )}
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <p className="aurora-kicker mb-4">2 · Shape the campaign</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="text-white/65">Goal</span>
              <select value={props.goal} onChange={(event) => props.setGoal(event.target.value as BriefProps["goal"])} className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-white">
                {GOALS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-white/65">Voice</span>
              <select value={props.tone} onChange={(event) => props.setTone(event.target.value as BriefProps["tone"])} className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-white">
                {TONES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>
          </div>
          <fieldset className="mt-4">
            <legend className="mb-2 text-sm text-white/65">Instagram formats</legend>
            <div className="flex flex-wrap gap-2">
              {CHANNELS.map((channel) => {
                const active = props.channels.includes(channel.id);
                return (
                  <button type="button" key={channel.id} onClick={() => props.toggleChannel(channel.id)} aria-pressed={active} className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs", active ? "border-violet-400/45 bg-violet-400/15 text-white" : "border-white/10 text-white/45")}>
                    {active && <Check className="size-3" />} {channel.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="space-y-2 text-sm">
              <span className="text-white/65">Campaign days</span>
              <Input type="number" min={1} max={30} value={props.days} onChange={(event) => props.setDays(Math.max(1, Math.min(30, Number(event.target.value) || 1)))} />
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-white/65">Number of posts</span>
              <Input type="number" min={1} max={12} value={props.postCount} onChange={(event) => props.setPostCount(Math.max(1, Math.min(12, Number(event.target.value) || 1)))} />
            </label>
          </div>
          <label className="mt-4 block space-y-2 text-sm">
            <span className="text-white/65">Creative direction (optional)</span>
            <Textarea value={props.notes} onChange={(event) => props.setNotes(event.target.value)} placeholder="e.g. Lead with the reference-to-result transformation. Make the first Reel feel like a product reveal." rows={3} />
          </label>
        </div>
      </div>

      <aside className="self-start overflow-hidden rounded-[26px] border border-violet-400/20 bg-black/30 lg:sticky lg:top-6">
        <div className="relative">
          <img src={selected.preview} alt={`${selected.name} campaign reference`} className="aspect-[4/3] w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
          <span className="absolute bottom-4 left-4 rounded-full border border-white/15 bg-black/45 px-3 py-1 text-xs backdrop-blur">Real Aurora feature reference</span>
        </div>
        <div className="p-5">
          <h2 className="text-xl font-semibold">{selected.name}</h2>
          <p className="mt-2 text-sm leading-6 text-white/55">{selected.promise}</p>
          <div className="mt-4 rounded-xl border border-white/8 bg-white/[0.035] p-3 text-xs leading-5 text-white/45">
            <strong className="text-white/70">Approved proof:</strong> {selected.proof}
          </div>
          <Button onClick={() => void props.createCampaign()} disabled={props.planning || (props.featureId === "custom" && !props.customCapability.trim())} className="mt-5 w-full gap-2">
            {props.planning ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {props.planning ? "Directing the campaign…" : `Build ${props.postCount}-post campaign`}
          </Button>
        </div>
      </aside>
    </section>
  );
}

function CampaignHeading({ campaign }: { campaign: CampaignState }) {
  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-center gap-2 text-xs text-white/40">
        <span>{campaign.featureName}</span><ChevronRight className="size-3" /><span>{campaign.items.length} posts</span>
      </div>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">{campaign.name}</h2>
      <p className="mt-2 text-sm leading-6 text-white/50">{campaign.strategy}</p>
    </div>
  );
}

type PostCardProps = {
  item: CampaignItem;
  fallbackImage: string;
  activity?: "visuals" | "reel";
  patchItem: (id: string, patch: Partial<CampaignItem>) => void;
  generateVisuals: (item: CampaignItem) => Promise<void>;
  generateReel: (item: CampaignItem) => Promise<void>;
  copyPost: (item: CampaignItem) => Promise<void>;
};

function PostCard({ item, fallbackImage, activity, patchItem, generateVisuals, generateReel, copyPost }: PostCardProps) {
  const rendered = renderedVisuals(item);
  const missing = failedSlots(item);
  const hasVisuals = rendered.length > 0;
  const partialCarousel = hasVisuals && missing.length > 0;
  return (
    <article className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.035]">
      <div className="relative bg-black">
        {item.videoUrl ? (
          <video src={item.videoUrl} poster={firstVisual(item) || fallbackImage} autoPlay muted loop playsInline preload="metadata" className="aspect-[4/3] w-full object-cover" />
        ) : (
          <div className="flex snap-x gap-1 overflow-x-auto">
            {hasVisuals ? (
              rendered.map(({ slot, url }) => (
                <img key={`${url}-${slot}`} src={url} alt={`${item.title} visual ${slot}`} loading="lazy" className="aspect-[4/3] min-w-full snap-center object-cover" />
              ))
            ) : (
              <img src={fallbackImage} alt={`${item.title} Aurora reference`} loading="lazy" className="aspect-[4/3] min-w-full snap-center object-cover" />
            )}
          </div>
        )}
        <div className="absolute left-3 top-3 flex gap-2">
          <span className="rounded-full border border-white/15 bg-black/55 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider backdrop-blur">{item.format}</span>
          <span className="rounded-full border border-white/15 bg-black/55 px-2.5 py-1 text-[10px] backdrop-blur">Day {item.day}</span>
        </div>
        {!hasVisuals && (
          <span className="absolute bottom-3 left-3 rounded-full border border-white/10 bg-black/55 px-2.5 py-1 text-[10px] text-white/65 backdrop-blur">Aurora reference · generate final visual below</span>
        )}
        {partialCarousel && (
          <span className="absolute bottom-3 left-3 rounded-full border border-red-400/30 bg-black/60 px-2.5 py-1 text-[10px] text-red-200 backdrop-blur">
            Slide{missing.length === 1 ? "" : "s"} {missing.join(", ")} missing
          </span>
        )}
      </div>
      <div className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-violet-300">{item.hook}</p>
            <h3 className="mt-1 text-xl font-semibold">{item.title}</h3>
          </div>
          <span className={cn("shrink-0 rounded-full border px-2.5 py-1 text-[10px] capitalize", STATUS_STYLES[item.status])}>{item.status}</span>
        </div>

        <Textarea aria-label={`Caption for ${item.title}`} value={item.caption} onChange={(event) => patchItem(item.id, { caption: event.target.value })} rows={5} className="text-sm leading-6" />
        <div className="flex flex-wrap gap-1.5">
          {item.hashtags.map((tag) => <span key={tag} className="rounded-full bg-white/5 px-2 py-1 text-[10px] text-white/45">#{tag.replace(/^#/, "")}</span>)}
        </div>
        {item.slides.length > 0 && (
          <details className="rounded-xl border border-white/8 bg-black/20 p-3">
            <summary className="cursor-pointer text-xs font-medium text-white/65">{item.slides.length}-slide carousel outline</summary>
            <ol className="mt-3 space-y-2">
              {item.slides.map((slide, index) => (
                <li key={`${slide.heading}-${index}`} className="grid grid-cols-[24px_1fr] gap-2 text-xs">
                  <span className="text-violet-300">{index + 1}</span>
                  <span>
                    <strong className="block text-white/75">{slide.heading}</strong>
                    <span className="text-white/40">{slide.body}</span>
                    {partialCarousel && !item.assetUrls[index] && <span className="ml-1 text-red-300">· visual missing</span>}
                  </span>
                </li>
              ))}
            </ol>
          </details>
        )}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => void generateVisuals(item)} disabled={Boolean(activity)} className="gap-1.5">
            {activity === "visuals" ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />}
            {partialCarousel ? `Retry ${missing.length} missing slide${missing.length === 1 ? "" : "s"}` : item.format === "carousel" ? "Generate slides" : "Generate visual"}
          </Button>
          {item.format === "reel" && (
            <Button size="sm" onClick={() => void generateReel(item)} disabled={Boolean(activity)} className="gap-1.5">
              {activity === "reel" ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
              Generate 5s Reel
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => void copyPost(item)} className="gap-1.5">
            <Clipboard className="size-3.5" /> Copy post
          </Button>
        </div>

        <div className="grid gap-3 border-t border-white/8 pt-4 sm:grid-cols-[1fr_auto]">
          <label className="space-y-1 text-xs text-white/45">
            <span className="flex items-center gap-1.5"><CalendarDays className="size-3" /> Schedule date</span>
            <Input type="date" value={item.scheduledDate} onChange={(event) => patchItem(item.id, { scheduledDate: event.target.value, status: event.target.value ? "scheduled" : item.status })} />
          </label>
          <label className="space-y-1 text-xs text-white/45">
            <span className="flex items-center gap-1.5"><Clock3 className="size-3" /> Workflow</span>
            <select aria-label={`Workflow status for ${item.title}`} value={item.status} onChange={(event) => patchItem(item.id, { status: event.target.value as PostStatus })} className={cn("block rounded-xl border px-3 py-[11px] text-xs capitalize outline-none", STATUS_STYLES[item.status])}>
              <option value="draft">Draft</option>
              <option value="approved">Approved</option>
              <option value="scheduled">Scheduled</option>
              <option value="published">Published</option>
            </select>
          </label>
        </div>
      </div>
    </article>
  );
}