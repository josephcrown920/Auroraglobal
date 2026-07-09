import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  Calendar,
  Download,
  Lock,
  Sparkles,
  TrendingUp,
  Zap,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Package,
  Hash,
  Image,
  History,
} from "lucide-react";
import { zipSync, strToU8 } from "fflate";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { getMyProfile } from "@/lib/billing.functions";
import {
  generateDailyPosts,
  generateDailyPostImage,
  generateRolloutPlan,
  generateSocialPack,
  listGrowthToolRuns,
  type GrowthTool,
} from "@/lib/growth-tools.functions";
import {
  COST_DAILY_POSTS,
  COST_ROLLOUT_PLAN,
  COST_SOCIAL_PACK,
  computeCost,
} from "@/lib/pricing";
import { cn } from "@/lib/utils";

// Same pure pricing module every other charge point uses — never a hardcoded
// duplicate — so this preview can never disagree with what generateDailyPostImage
// actually reserves per image.
const IMAGE_COST = computeCost({ features: ["image"] }).total;

export const Route = createFileRoute("/growth")({
  component: GrowthPage,
  head: () => ({
    meta: [
      { title: "Artist Growth Tools — Aurora" },
      {
        name: "description",
        content:
          "AI-powered growth tools for music artists: daily post generator, release rollout plan, and social media pack.",
      },
      { property: "og:title", content: "Artist Growth Tools — Aurora" },
    ],
    links: [{ rel: "canonical", href: "https://aurorastudiostar.lovable.app/growth" }],
  }),
});

type Tool = "daily-posts" | "rollout-plan" | "social-pack";

// ─── Copy-to-clipboard hook ───────────────────────────────────────────────────
function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  };
  return { copied, copy };
}

// ─── Small shared components ─────────────────────────────────────────────────

function CopyBtn({ text, id }: { text: string; id: string }) {
  const { copied, copy } = useCopy();
  return (
    <button
      onClick={() => copy(text, id)}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied === id ? <Check className="size-3 text-green-500" /> : <Copy className="size-3" />}
      {copied === id ? "Copied" : "Copy"}
    </button>
  );
}

function ProGate({ cost, children }: { cost: number; children: React.ReactNode }) {
  return (
    <div className="relative rounded-2xl border border-border bg-card/30 overflow-hidden">
      <div className="absolute inset-0 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-4 bg-background/60">
        <div className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2">
          <Lock className="size-4 text-primary" />
          <span className="text-sm font-medium text-primary">Pro Feature</span>
        </div>
        <p className="text-sm text-muted-foreground text-center max-w-xs px-4">
          Upgrade to Pro to unlock all Artist Growth Tools and 200 Aura/month.
        </p>
        <Link to="/billing">
          <Button variant="default" size="sm" className="gap-2">
            <Sparkles className="size-4" />
            Upgrade to Pro — $15/mo
          </Button>
        </Link>
      </div>
      <div className="pointer-events-none opacity-30 select-none">{children}</div>
    </div>
  );
}

function AuraCostBadge({ cost }: { cost: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
      <Zap className="size-3" />
      {cost} Aura
    </span>
  );
}

function HistoryPanel<TOutput>({
  tool,
  isPro,
  onLoad,
  renderSummary,
}: {
  tool: GrowthTool;
  isPro: boolean;
  onLoad: (output: TOutput) => void;
  renderSummary: (input: any) => { title: string; subtitle?: string };
}) {
  const [open, setOpen] = useState(false);
  const listFn = useServerFn(listGrowthToolRuns);
  const { data, isLoading } = useQuery({
    queryKey: ["growth-tool-runs", tool],
    queryFn: () => listFn({ data: { tool } }),
    enabled: isPro && open,
  });

  if (!isPro) return null;

  const runs = data?.ok ? data.runs : [];

  return (
    <div className="rounded-2xl border border-border bg-card/20 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <History className="size-4 text-muted-foreground" />
          Past runs
        </span>
        {open ? (
          <ChevronUp className="size-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="border-t border-border divide-y divide-border max-h-72 overflow-y-auto">
          {isLoading && <p className="px-4 py-3 text-xs text-muted-foreground">Loading…</p>}
          {!isLoading && runs.length === 0 && (
            <p className="px-4 py-3 text-xs text-muted-foreground">No past runs yet.</p>
          )}
          {runs.map((run) => {
            const { title, subtitle } = renderSummary(run.input);
            return (
              <button
                key={run.id}
                onClick={() => onLoad(run.output as TOutput)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-background/40 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{title}</p>
                  {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(run.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-muted-foreground mb-1.5">{children}</label>;
}

function Input({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "w-full rounded-xl border border-border bg-card/30 px-3.5 py-2.5 text-sm focus:outline-none focus:border-primary/50 transition-colors placeholder:text-muted-foreground/60",
        className,
      )}
    />
  );
}

function SelectField({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-border bg-card/30 px-3.5 py-2.5 text-sm focus:outline-none focus:border-primary/50 transition-colors"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function CheckboxGroup({
  options,
  selected,
  onChange,
  max,
}: {
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  max?: number;
}) {
  const toggle = (v: string) => {
    if (selected.includes(v)) {
      onChange(selected.filter((s) => s !== v));
    } else if (!max || selected.length < max) {
      onChange([...selected, v]);
    }
  };
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => toggle(o)}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            selected.includes(o)
              ? "border-primary/60 bg-primary/15 text-primary"
              : "border-border bg-card/20 text-muted-foreground hover:border-primary/30 hover:text-foreground",
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

// ─── Tool: Daily Post Generator ───────────────────────────────────────────────

type DailyPostsResult = {
  ok: true;
  days: Array<{
    day: number;
    platform: string;
    caption: string;
    imagePrompt: string;
    tone: string;
  }>;
  cost: number;
};

function DailyPostGenerator({ isPro }: { isPro: boolean }) {
  const [songTitle, setSongTitle] = useState("");
  const [artistName, setArtistName] = useState("");
  const [genre, setGenre] = useState("");
  const [releaseStatus, setReleaseStatus] = useState<"upcoming" | "out_now" | "classic">("upcoming");
  const [platforms, setPlatforms] = useState<string[]>(["Instagram", "TikTok"]);
  const [tone, setTone] = useState<"hype" | "authentic" | "storytelling" | "fan_engagement" | "mixed">("mixed");
  const [result, setResult] = useState<DailyPostsResult | null>(null);
  const [expanded, setExpanded] = useState<number | null>(0);
  const [imageStatus, setImageStatus] = useState<Record<number, "loading" | "done" | "error">>({});
  const [images, setImages] = useState<Record<number, string>>({});
  const [imageErrors, setImageErrors] = useState<Record<number, string>>({});
  const [generatingImages, setGeneratingImages] = useState(false);
  const [zipping, setZipping] = useState(false);

  const genFn = useServerFn(generateDailyPosts);
  const imgFn = useServerFn(generateDailyPostImage);
  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      genFn({ data: { songTitle, artistName, genre, releaseStatus, platforms: platforms as never, tone } }),
    onSuccess: (data) => {
      if (!data.ok) {
        toast.error(data.error ?? "Generation failed");
        return;
      }
      setResult(data as DailyPostsResult);
      setImageStatus({});
      setImages({});
      setImageErrors({});
      toast.success("7-day content calendar ready!");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const canGenerate = songTitle.trim() && artistName.trim() && genre.trim() && platforms.length > 0;

  const generateOneImage = async (day: number, prompt: string) => {
    if (generatingImages || imageStatus[day] === "loading") return;
    setImageStatus((s) => ({ ...s, [day]: "loading" }));
    try {
      const r = await imgFn({ data: { prompt, day } });
      if (r.ok) {
        setImages((s) => ({ ...s, [day]: r.url }));
        setImageStatus((s) => ({ ...s, [day]: "done" }));
      } else {
        setImageErrors((s) => ({ ...s, [day]: r.error ?? "Image generation failed" }));
        setImageStatus((s) => ({ ...s, [day]: "error" }));
      }
    } catch (e) {
      setImageErrors((s) => ({ ...s, [day]: e instanceof Error ? e.message : "Image generation failed" }));
      setImageStatus((s) => ({ ...s, [day]: "error" }));
    }
  };

  const generateAllImages = async () => {
    if (!result || generatingImages) return;
    const pending = result.days.filter((d) => imageStatus[d.day] !== "done" && imageStatus[d.day] !== "loading");
    if (pending.length === 0) return;
    setGeneratingImages(true);
    setImageStatus((s) => {
      const next = { ...s };
      pending.forEach((d) => {
        next[d.day] = "loading";
      });
      return next;
    });
    const settled = await Promise.allSettled(
      pending.map(async (d) => {
        try {
          const r = await imgFn({ data: { prompt: d.imagePrompt, day: d.day } });
          const day = r.day ?? d.day;
          if (r.ok) {
            setImages((s) => ({ ...s, [day]: r.url }));
            setImageStatus((s) => ({ ...s, [day]: "done" }));
            return { ok: true as const };
          }
          setImageErrors((s) => ({ ...s, [day]: r.error ?? "Image generation failed" }));
          setImageStatus((s) => ({ ...s, [day]: "error" }));
          return { ok: false as const };
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Image generation failed";
          setImageErrors((s) => ({ ...s, [d.day]: msg }));
          setImageStatus((s) => ({ ...s, [d.day]: "error" }));
          return { ok: false as const };
        }
      }),
    );
    const failCount = settled.filter((r) => r.status === "rejected" || !r.value.ok).length;
    setGeneratingImages(false);
    if (failCount === 0) {
      toast.success("All cover art images generated!");
    } else {
      toast.error(`${failCount} of ${pending.length} images failed — retry them individually.`);
    }
  };

  const doneImageCount = result ? result.days.filter((d) => imageStatus[d.day] === "done").length : 0;
  const pendingImageCount = result ? result.days.length - doneImageCount : 0;

  const downloadZip = async () => {
    if (!result || zipping) return;
    const readyDays = result.days.filter((d) => images[d.day]);
    if (readyDays.length === 0) {
      toast.error("Generate images first");
      return;
    }
    setZipping(true);
    try {
      const files: Record<string, Uint8Array> = {};
      const captionsText = result.days
        .map((d) => `=== Day ${d.day} — ${d.platform} (${d.tone}) ===\n\n${d.caption}`)
        .join("\n\n" + "─".repeat(60) + "\n\n");
      files["captions.txt"] = strToU8(`7-Day Content Calendar — ${songTitle} by ${artistName}\n\n${captionsText}`);

      for (const d of readyDays) {
        const url = images[d.day];
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to download image for day ${d.day}`);
        const buf = new Uint8Array(await res.arrayBuffer());
        const rawExt = url.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
        const ext = /^[a-z0-9]{2,4}$/.test(rawExt) ? rawExt : "png";
        files[`day-${d.day}-${d.platform.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.${ext}`] = buf;
      }

      const zipped = zipSync(files, { level: 6 });
      const blob = new Blob([zipped as BlobPart], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${songTitle || "content"}-cover-art.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("ZIP downloaded!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ZIP creation failed");
    } finally {
      setZipping(false);
    }
  };

  const downloadCalendar = () => {
    if (!result) return;
    const text = result.days
      .map(
        (d) =>
          `=== Day ${d.day} — ${d.platform} (${d.tone}) ===\n\nCAPTION:\n${d.caption}\n\nIMAGE PROMPT:\n${d.imagePrompt}`,
      )
      .join("\n\n" + "─".repeat(60) + "\n\n");
    const blob = new Blob([`7-Day Content Calendar — ${songTitle} by ${artistName}\n\n${text}`], {
      type: "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${songTitle}-content-calendar.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const form = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Song Title</FieldLabel>
          <Input value={songTitle} onChange={setSongTitle} placeholder="e.g. Midnight Drive" />
        </div>
        <div>
          <FieldLabel>Artist Name</FieldLabel>
          <Input value={artistName} onChange={setArtistName} placeholder="e.g. DJ Nova" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Genre</FieldLabel>
          <Input value={genre} onChange={setGenre} placeholder="e.g. Afrobeats, Drill, R&B" />
        </div>
        <div>
          <FieldLabel>Release Status</FieldLabel>
          <SelectField
            value={releaseStatus}
            onChange={(v) => setReleaseStatus(v as typeof releaseStatus)}
            options={[
              { value: "upcoming", label: "Upcoming / Pre-release" },
              { value: "out_now", label: "Out Now" },
              { value: "classic", label: "Classic Track" },
            ]}
          />
        </div>
      </div>
      <div>
        <FieldLabel>Platforms (pick up to 3)</FieldLabel>
        <CheckboxGroup
          options={["Instagram", "TikTok", "Twitter", "YouTube", "Facebook"]}
          selected={platforms}
          onChange={setPlatforms}
          max={3}
        />
      </div>
      <div>
        <FieldLabel>Content Tone</FieldLabel>
        <SelectField
          value={tone}
          onChange={(v) => setTone(v as typeof tone)}
          options={[
            { value: "mixed", label: "Mixed (recommended)" },
            { value: "hype", label: "Hype & Energetic" },
            { value: "authentic", label: "Authentic & Personal" },
            { value: "storytelling", label: "Storytelling & BTS" },
            { value: "fan_engagement", label: "Fan Engagement" },
          ]}
        />
      </div>
      <div className="flex items-center gap-3">
        <Button
          onClick={() => mutate()}
          disabled={!canGenerate || isPending}
          className="gap-2 flex-1"
        >
          {isPending ? (
            <>
              <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Generating…
            </>
          ) : (
            <>
              <Sparkles className="size-4" />
              Generate 7-Day Calendar
            </>
          )}
        </Button>
        <AuraCostBadge cost={COST_DAILY_POSTS} />
      </div>
    </div>
  );

  if (!isPro) {
    return <ProGate cost={COST_DAILY_POSTS}>{form}</ProGate>;
  }

  return (
    <div className="space-y-5">
      {form}
      <HistoryPanel
        tool="daily_posts"
        isPro={isPro}
        onLoad={(output: { days: DailyPostsResult["days"]; cost: number }) => {
          setResult({ ok: true, days: output.days, cost: output.cost });
          setExpanded(0);
          setImageStatus({});
          setImages({});
          setImageErrors({});
          toast.success("Loaded past content calendar");
        }}
        renderSummary={(input) => ({
          title: `${input.songTitle} — ${input.artistName}`,
          subtitle: input.genre,
        })}
      />
      {result && (
        <div className="rounded-2xl border border-border bg-card/20 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-semibold">Your 7-Day Content Calendar</span>
            <button
              onClick={downloadCalendar}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Download className="size-3.5" />
              Download .txt
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-border bg-background/30">
            <span className="text-xs text-muted-foreground">
              {doneImageCount > 0
                ? `${doneImageCount}/${result.days.length} cover art images generated`
                : "Generate real cover art for each day's post"}
            </span>
            <div className="flex items-center gap-3">
              {pendingImageCount > 0 && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={generateAllImages}
                  disabled={generatingImages}
                  className="h-7 gap-1.5 text-xs"
                >
                  {generatingImages ? (
                    <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <Image className="size-3" />
                  )}
                  Generate All Images
                  <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                    +{pendingImageCount * IMAGE_COST} Aura
                  </span>
                </Button>
              )}
              {doneImageCount > 0 && (
                <button
                  onClick={downloadZip}
                  disabled={zipping}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  <Download className="size-3.5" />
                  {zipping ? "Zipping…" : "Download ZIP"}
                </button>
              )}
            </div>
          </div>
          <div className="divide-y divide-border">
            {result.days.map((day) => (
              <div key={day.day} className="px-4">
                <button
                  className="flex w-full items-center justify-between py-3 text-left"
                  onClick={() => setExpanded(expanded === day.day ? null : day.day)}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-7 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                      {day.day}
                    </span>
                    <div>
                      <span className="text-sm font-medium">{day.platform}</span>
                      <span className="ml-2 text-xs text-muted-foreground capitalize">{day.tone.replace(/_/g, " ")}</span>
                    </div>
                  </div>
                  {expanded === day.day ? (
                    <ChevronUp className="size-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="size-4 text-muted-foreground" />
                  )}
                </button>
                {expanded === day.day && (
                  <div className="pb-4 space-y-3">
                    <div className="rounded-xl bg-background/40 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Caption</span>
                        <CopyBtn text={day.caption} id={`caption-${day.day}`} />
                      </div>
                      <p className="text-sm leading-relaxed">{day.caption}</p>
                    </div>
                    <div className="rounded-xl bg-background/40 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          <Image className="size-3" />
                          Image Prompt
                        </span>
                        <CopyBtn text={day.imagePrompt} id={`prompt-${day.day}`} />
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{day.imagePrompt}</p>
                      <Link
                        to="/studio"
                        search={{ prompt: day.imagePrompt } as never}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        Generate in Studio →
                      </Link>
                    </div>
                    <div className="rounded-xl bg-background/40 p-3 space-y-2">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        <Sparkles className="size-3" />
                        Cover Art
                      </span>
                      {imageStatus[day.day] === "loading" && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          Generating cover art…
                        </div>
                      )}
                      {imageStatus[day.day] === "done" && images[day.day] && (
                        <img
                          src={images[day.day]}
                          alt={`Day ${day.day} cover art`}
                          className="w-full max-w-xs rounded-lg border border-border"
                        />
                      )}
                      {imageStatus[day.day] === "error" && (
                        <div className="flex items-center justify-between gap-2 text-xs text-destructive">
                          <span>{imageErrors[day.day] ?? "Generation failed"}</span>
                          <button
                            onClick={() => generateOneImage(day.day, day.imagePrompt)}
                            className="shrink-0 underline"
                          >
                            Retry
                          </button>
                        </div>
                      )}
                      {!imageStatus[day.day] && (
                        <button
                          onClick={() => generateOneImage(day.day, day.imagePrompt)}
                          className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                        >
                          <Image className="size-3.5" />
                          Generate this image
                          <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold">
                            +{IMAGE_COST} Aura
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tool: AI Rollout Plan ────────────────────────────────────────────────────

type RolloutPlanResult = {
  ok: true;
  plan: {
    title: string;
    summary: string;
    weeks: Array<{
      week: number;
      label: string;
      goal: string;
      posts: Array<{
        platform: string;
        type: string;
        copy: string;
        hashtags: string[];
        tip: string;
      }>;
    }>;
  };
  cost: number;
};

function RolloutPlanTool({ isPro }: { isPro: boolean }) {
  const [songTitle, setSongTitle] = useState("");
  const [artistName, setArtistName] = useState("");
  const [genre, setGenre] = useState("");
  const [releaseDate, setReleaseDate] = useState("");
  const [targetPlatforms, setTargetPlatforms] = useState<string[]>(["Instagram", "TikTok", "Spotify"]);
  const [budget, setBudget] = useState<"zero" | "low" | "medium">("zero");
  const [result, setResult] = useState<RolloutPlanResult | null>(null);
  const [expandedWeek, setExpandedWeek] = useState<number | null>(0);

  const genFn = useServerFn(generateRolloutPlan);
  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      genFn({ data: { songTitle, artistName, genre, releaseDate, targetPlatforms: targetPlatforms as never, budget } }),
    onSuccess: (data) => {
      if (!data.ok) {
        toast.error(data.error ?? "Generation failed");
        return;
      }
      setResult(data as RolloutPlanResult);
      toast.success("Rollout plan ready!");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const canGenerate = songTitle.trim() && artistName.trim() && genre.trim() && releaseDate.trim() && targetPlatforms.length > 0;

  const downloadPlan = () => {
    if (!result) return;
    const lines: string[] = [
      `AI RELEASE ROLLOUT PLAN`,
      `"${result.plan.title}"`,
      ``,
      result.plan.summary,
      ``,
      `${"═".repeat(60)}`,
      ``,
    ];
    for (const week of result.plan.weeks) {
      lines.push(`WEEK ${week.week}: ${week.label.toUpperCase()}`);
      lines.push(`Goal: ${week.goal}`);
      lines.push("");
      for (const post of week.posts) {
        lines.push(`  [${post.platform}] ${post.type}`);
        lines.push(`  ${post.copy}`);
        lines.push(`  Hashtags: ${post.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}`);
        lines.push(`  Tip: ${post.tip}`);
        lines.push("");
      }
      lines.push("─".repeat(60));
      lines.push("");
    }
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${songTitle}-rollout-plan.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const form = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Song Title</FieldLabel>
          <Input value={songTitle} onChange={setSongTitle} placeholder="e.g. Golden Hour" />
        </div>
        <div>
          <FieldLabel>Artist Name</FieldLabel>
          <Input value={artistName} onChange={setArtistName} placeholder="e.g. Amara Sky" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Genre</FieldLabel>
          <Input value={genre} onChange={setGenre} placeholder="e.g. Afropop, Hip-hop" />
        </div>
        <div>
          <FieldLabel>Release Date</FieldLabel>
          <Input value={releaseDate} onChange={setReleaseDate} placeholder="e.g. Aug 15, 2026" />
        </div>
      </div>
      <div>
        <FieldLabel>Target Platforms (pick up to 4)</FieldLabel>
        <CheckboxGroup
          options={["Instagram", "TikTok", "Twitter", "YouTube", "Spotify", "Apple Music"]}
          selected={targetPlatforms}
          onChange={setTargetPlatforms}
          max={4}
        />
      </div>
      <div>
        <FieldLabel>Marketing Budget</FieldLabel>
        <SelectField
          value={budget}
          onChange={(v) => setBudget(v as typeof budget)}
          options={[
            { value: "zero", label: "Zero — organic only" },
            { value: "low", label: "Low — $0–$200 ads" },
            { value: "medium", label: "Medium — $200–$1,000 ads" },
          ]}
        />
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={() => mutate()} disabled={!canGenerate || isPending} className="gap-2 flex-1">
          {isPending ? (
            <>
              <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Generating…
            </>
          ) : (
            <>
              <Calendar className="size-4" />
              Generate Rollout Plan
            </>
          )}
        </Button>
        <AuraCostBadge cost={COST_ROLLOUT_PLAN} />
      </div>
    </div>
  );

  if (!isPro) {
    return <ProGate cost={COST_ROLLOUT_PLAN}>{form}</ProGate>;
  }

  return (
    <div className="space-y-5">
      {form}
      <HistoryPanel
        tool="rollout_plan"
        isPro={isPro}
        onLoad={(output: { plan: RolloutPlanResult["plan"]; cost: number }) => {
          setResult({ ok: true, plan: output.plan, cost: output.cost });
          setExpandedWeek(null);
          toast.success("Loaded past rollout plan");
        }}
        renderSummary={(input) => ({
          title: `${input.songTitle} — ${input.artistName}`,
          subtitle: input.genre,
        })}
      />
      {result && (
        <div className="rounded-2xl border border-border bg-card/20 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div>
              <p className="text-sm font-semibold">{result.plan.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{result.plan.summary}</p>
            </div>
            <button
              onClick={downloadPlan}
              className="flex-shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors ml-4"
            >
              <Download className="size-3.5" />
              Download
            </button>
          </div>
          <div className="divide-y divide-border">
            {result.plan.weeks.map((week) => (
              <div key={week.week} className="px-4">
                <button
                  className="flex w-full items-center justify-between py-3 text-left"
                  onClick={() => setExpandedWeek(expandedWeek === week.week ? null : week.week)}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-7 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                      W{week.week}
                    </span>
                    <div>
                      <span className="text-sm font-medium">{week.label}</span>
                      <p className="text-xs text-muted-foreground">{week.goal}</p>
                    </div>
                  </div>
                  {expandedWeek === week.week ? (
                    <ChevronUp className="size-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="size-4 text-muted-foreground shrink-0" />
                  )}
                </button>
                {expandedWeek === week.week && (
                  <div className="pb-4 space-y-2">
                    {week.posts.map((post, i) => (
                      <div key={i} className="rounded-xl bg-background/40 p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                            {post.platform}
                          </span>
                          <span className="text-xs text-muted-foreground">{post.type}</span>
                        </div>
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm leading-relaxed">{post.copy}</p>
                          <CopyBtn text={post.copy} id={`week-${week.week}-post-${i}`} />
                        </div>
                        {post.hashtags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {post.hashtags.map((h) => (
                              <span key={h} className="text-xs text-primary/80">
                                #{h.replace(/^#/, "")}
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-2">
                          {post.tip}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tool: Social Media Pack ──────────────────────────────────────────────────

type SocialPackResult = {
  ok: true;
  pack: {
    squareCaption: string;
    portraitCaption: string;
    landscapeCaption: string;
    captionVariants: string[];
    hashtags: { core: string[]; trending: string[]; branded: string[] };
    imagePromptSquare: string;
    imagePromptPortrait: string;
  };
  cost: number;
};

function SocialPackTool({ isPro }: { isPro: boolean }) {
  const [songTitle, setSongTitle] = useState("");
  const [artistName, setArtistName] = useState("");
  const [genre, setGenre] = useState("");
  const [mood, setMood] = useState("");
  const [visualStyle, setVisualStyle] = useState("");
  const [keyMessage, setKeyMessage] = useState("");
  const [result, setResult] = useState<SocialPackResult | null>(null);
  const [activeTab, setActiveTab] = useState<"captions" | "hashtags" | "prompts">("captions");

  const genFn = useServerFn(generateSocialPack);
  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      genFn({ data: { songTitle, artistName, genre, mood, visualStyle, keyMessage } }),
    onSuccess: (data) => {
      if (!data.ok) {
        toast.error(data.error ?? "Generation failed");
        return;
      }
      setResult(data as SocialPackResult);
      toast.success("Social media pack ready!");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const canGenerate = songTitle.trim() && artistName.trim() && genre.trim() && mood.trim() && visualStyle.trim() && keyMessage.trim();

  const downloadPack = () => {
    if (!result) return;
    const p = result.pack;
    const lines = [
      `SOCIAL MEDIA PACK — "${songTitle}" by ${artistName}`,
      "",
      "═══ CAPTIONS ═══",
      "",
      "📷 INSTAGRAM (SQUARE 1:1)",
      p.squareCaption,
      "",
      "📱 REELS / TIKTOK (9:16 VERTICAL)",
      p.portraitCaption,
      "",
      "🖥 YOUTUBE / TWITTER (LANDSCAPE)",
      p.landscapeCaption,
      "",
      "─── 5 CAPTION VARIANTS ───",
      ...p.captionVariants.map((v, i) => `${i + 1}. ${v}`),
      "",
      "═══ HASHTAGS ═══",
      "",
      `Core: ${p.hashtags.core.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}`,
      `Trending: ${p.hashtags.trending.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}`,
      `Branded: ${p.hashtags.branded.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}`,
      "",
      "═══ AI IMAGE PROMPTS ═══",
      "",
      "SQUARE (1:1 Cover Art):",
      p.imagePromptSquare,
      "",
      "PORTRAIT (9:16 Short Clip):",
      p.imagePromptPortrait,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${songTitle}-social-pack.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const form = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Song Title</FieldLabel>
          <Input value={songTitle} onChange={setSongTitle} placeholder="e.g. Last Summer" />
        </div>
        <div>
          <FieldLabel>Artist Name</FieldLabel>
          <Input value={artistName} onChange={setArtistName} placeholder="e.g. Ray Nova" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Genre</FieldLabel>
          <Input value={genre} onChange={setGenre} placeholder="e.g. Trap, Afrobeats, Pop" />
        </div>
        <div>
          <FieldLabel>Song Mood / Vibe</FieldLabel>
          <Input value={mood} onChange={setMood} placeholder="e.g. Dark, romantic, euphoric" />
        </div>
      </div>
      <div>
        <FieldLabel>Visual Style Reference</FieldLabel>
        <Input
          value={visualStyle}
          onChange={setVisualStyle}
          placeholder="e.g. Neon-lit city streets, moody cinematic, golden hour portrait"
        />
      </div>
      <div>
        <FieldLabel>Key Message / What Should Fans Feel?</FieldLabel>
        <input
          value={keyMessage}
          onChange={(e) => setKeyMessage(e.target.value)}
          placeholder="e.g. This song is about moving on and finding your power — fans should feel empowered"
          className="w-full rounded-xl border border-border bg-card/30 px-3.5 py-2.5 text-sm focus:outline-none focus:border-primary/50 transition-colors placeholder:text-muted-foreground/60 resize-none"
        />
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={() => mutate()} disabled={!canGenerate || isPending} className="gap-2 flex-1">
          {isPending ? (
            <>
              <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Generating…
            </>
          ) : (
            <>
              <Package className="size-4" />
              Generate Social Pack
            </>
          )}
        </Button>
        <AuraCostBadge cost={COST_SOCIAL_PACK} />
      </div>
    </div>
  );

  if (!isPro) {
    return <ProGate cost={COST_SOCIAL_PACK}>{form}</ProGate>;
  }

  return (
    <div className="space-y-5">
      {form}
      <HistoryPanel
        tool="social_pack"
        isPro={isPro}
        onLoad={(output: { pack: SocialPackResult["pack"]; cost: number }) => {
          setResult({ ok: true, pack: output.pack, cost: output.cost });
          setActiveTab("captions");
          toast.success("Loaded past social pack");
        }}
        renderSummary={(input) => ({
          title: `${input.songTitle} — ${input.artistName}`,
          subtitle: input.genre,
        })}
      />
      {result && (
        <div className="rounded-2xl border border-border bg-card/20 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-semibold">Your Social Media Pack</span>
            <button
              onClick={downloadPack}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Download className="size-3.5" />
              Download .txt
            </button>
          </div>

          {/* Tab nav */}
          <div className="flex border-b border-border">
            {(["captions", "hashtags", "prompts"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "flex-1 py-2.5 text-xs font-medium capitalize transition-colors",
                  activeTab === tab
                    ? "text-primary border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab === "captions" ? "📝 Captions" : tab === "hashtags" ? "# Hashtags" : "🎨 Prompts"}
              </button>
            ))}
          </div>

          <div className="p-4 space-y-3">
            {activeTab === "captions" && (
              <>
                {[
                  { label: "Instagram (Square 1:1)", text: result.pack.squareCaption },
                  { label: "Reels / TikTok (9:16)", text: result.pack.portraitCaption },
                  { label: "YouTube / Twitter (Landscape)", text: result.pack.landscapeCaption },
                ].map((item, i) => (
                  <div key={i} className="rounded-xl bg-background/40 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
                      <CopyBtn text={item.text} id={`cap-${i}`} />
                    </div>
                    <p className="text-sm leading-relaxed">{item.text}</p>
                  </div>
                ))}
                <div className="rounded-xl bg-background/40 p-3 space-y-2">
                  <span className="text-xs font-medium text-muted-foreground">5 Caption Variants</span>
                  <div className="space-y-2">
                    {result.pack.captionVariants.map((v, i) => (
                      <div key={i} className="flex items-start justify-between gap-2">
                        <p className="text-sm leading-relaxed">{v}</p>
                        <CopyBtn text={v} id={`variant-${i}`} />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {activeTab === "hashtags" && (
              <>
                {[
                  { label: "Core Evergreen", tags: result.pack.hashtags.core, color: "text-primary" },
                  { label: "Trending / Niche", tags: result.pack.hashtags.trending, color: "text-blue-400" },
                  { label: "Branded", tags: result.pack.hashtags.branded, color: "text-emerald-400" },
                ].map((group) => (
                  <div key={group.label} className="rounded-xl bg-background/40 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Hash className="size-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">{group.label}</span>
                      </div>
                      <CopyBtn
                        text={group.tags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}
                        id={`hashtag-${group.label}`}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {group.tags.map((tag) => (
                        <span
                          key={tag}
                          className={cn("text-sm font-medium", group.color)}
                        >
                          #{tag.replace(/^#/, "")}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="rounded-xl bg-background/40 p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">All Hashtags Combined</span>
                    <CopyBtn
                      text={[
                        ...result.pack.hashtags.core,
                        ...result.pack.hashtags.trending,
                        ...result.pack.hashtags.branded,
                      ]
                        .map((h) => `#${h.replace(/^#/, "")}`)
                        .join(" ")}
                      id="all-hashtags"
                    />
                  </div>
                </div>
              </>
            )}

            {activeTab === "prompts" && (
              <>
                {[
                  { label: "Square Cover Art (1:1)", prompt: result.pack.imagePromptSquare },
                  { label: "Portrait Short Clip (9:16)", prompt: result.pack.imagePromptPortrait },
                ].map((item, i) => (
                  <div key={i} className="rounded-xl bg-background/40 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
                      <CopyBtn text={item.prompt} id={`imgprompt-${i}`} />
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.prompt}</p>
                    <Link
                      to="/studio"
                      search={{ prompt: item.prompt } as never}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      Generate in Studio →
                    </Link>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TOOLS: { id: Tool; label: string; description: string; icon: React.ElementType; cost: number }[] = [
  {
    id: "daily-posts",
    label: "Daily Post Generator",
    description: "7 days of ready-to-post captions + image prompts in one click",
    icon: TrendingUp,
    cost: COST_DAILY_POSTS,
  },
  {
    id: "rollout-plan",
    label: "AI Rollout Plan",
    description: "Week-by-week release calendar with hashtags and platform tips",
    icon: Calendar,
    cost: COST_ROLLOUT_PLAN,
  },
  {
    id: "social-pack",
    label: "Social Media Pack",
    description: "Matched captions for every format + hashtag strategy + image prompts",
    icon: Package,
    cost: COST_SOCIAL_PACK,
  },
];

function GrowthPage() {
  const { user, loading } = useAuth();
  const [activeTool, setActiveTool] = useState<Tool>("daily-posts");

  const profileFn = useServerFn(getMyProfile);
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: () => profileFn(),
    enabled: !!user,
  });

  const isPro = !!(profile?.is_pro || profile?.isAdmin);

  if (loading) {
    return (
      <main className="aurora-page-shell text-foreground">
        <span aria-hidden className="aurora-ambient" />
        <div className="relative z-10 flex items-center justify-center h-64">
          <span className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </main>
    );
  }

  return (
    <main className="aurora-page-shell text-foreground">
      <span aria-hidden className="aurora-ambient" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between border-b border-border bg-background/80 px-5 py-4 backdrop-blur-xl">
        <Link
          to="/"
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground no-underline"
        >
          <ArrowLeft className="size-4" /> Home
        </Link>
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <span className="text-sm font-semibold">Artist Growth Tools</span>
        </div>
        <div className="w-16" />
      </header>

      <div className="relative z-10 mx-auto max-w-2xl px-4 py-8 space-y-8">

        {/* Hero */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-xs font-medium text-primary">
            <Zap className="size-3.5" />
            Pro Feature
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Artist Growth Tools</h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            AI-powered marketing tools built for independent artists. Save hours of weekly work
            and grow your fanbase with content that actually converts.
          </p>
          {!isPro && !loading && (
            <Link to="/billing">
              <Button variant="default" className="gap-2 mt-2">
                <Sparkles className="size-4" />
                Upgrade to Pro — $15/month
              </Button>
            </Link>
          )}
        </div>

        {/* Tool selector */}
        <div className="grid grid-cols-3 gap-2">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.id}
                onClick={() => setActiveTool(tool.id)}
                className={cn(
                  "rounded-2xl border p-3 text-left transition-all space-y-2",
                  activeTool === tool.id
                    ? "border-primary/60 bg-primary/10"
                    : "border-border bg-card/20 hover:border-primary/30",
                )}
              >
                <div className="flex items-center justify-between">
                  <Icon
                    className={cn("size-5", activeTool === tool.id ? "text-primary" : "text-muted-foreground")}
                  />
                  {!isPro && <Lock className="size-3 text-muted-foreground" />}
                </div>
                <p
                  className={cn(
                    "text-xs font-semibold leading-tight",
                    activeTool === tool.id ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {tool.label}
                </p>
                <div className="flex items-center gap-1">
                  <Zap className="size-2.5 text-primary/70" />
                  <span className="text-[10px] text-primary/70">{tool.cost} Aura</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Active tool panel */}
        <div className="rounded-2xl border border-border bg-card/30 backdrop-blur-sm p-5">
          {(() => {
            const tool = TOOLS.find((t) => t.id === activeTool)!;
            const Icon = tool.icon;
            return (
              <>
                <div className="flex items-center gap-3 mb-5">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-primary/15">
                    <Icon className="size-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold">{tool.label}</h2>
                    <p className="text-xs text-muted-foreground">{tool.description}</p>
                  </div>
                </div>

                {activeTool === "daily-posts" && <DailyPostGenerator isPro={isPro} />}
                {activeTool === "rollout-plan" && <RolloutPlanTool isPro={isPro} />}
                {activeTool === "social-pack" && <SocialPackTool isPro={isPro} />}
              </>
            );
          })()}
        </div>

        {/* Footer tip */}
        <p className="text-center text-xs text-muted-foreground">
          Results are generated by AI — review before posting. Aura is charged only on successful generation.
        </p>
      </div>
    </main>
  );
}
