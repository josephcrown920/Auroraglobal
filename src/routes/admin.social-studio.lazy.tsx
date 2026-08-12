import { authNextSearch } from "@/lib/auth-return-path";
import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Camera,
  Download,
  Grid3X3,
  ImagePlus,
  Loader2,
  Megaphone,
  Save,
  Sparkles,
  Trash2,
  Type,
  UploadCloud,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { AdminGate, useAdminAutoUnlock } from "@/components/AdminGate";
import { usePerformanceShotJobFn } from "@/lib/use-job-polling";
import { adminUpdateSiteImage } from "@/lib/site-images.functions";
import {
  SITE_IMAGE_DEFAULTS,
  SITE_IMAGES_REFRESH_EVENT,
  type SiteImageKey,
} from "@/components/landing/SiteImagesProvider";
import { saveAssetToDisk } from "@/lib/save";
import { computeCost } from "@/lib/pricing";
import { handleGenerationError } from "@/lib/error-toasts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createLazyFileRoute("/admin/social-studio")({
  component: SocialStudio,
});

// ── Persistence ────────────────────────────────────────────────────────────
// Brand brief + saved shots survive reloads via localStorage (operator-local
// working state, deliberately NOT a DB table — see task scope).

const BRIEF_KEY = "aurora.social_studio.brief.v1";
const SHOTS_KEY = "aurora.social_studio.shots.v1";

type BrandBrief = {
  brand: string;
  subject: string;
  style: string;
  palette: string;
  audience: string;
};

const EMPTY_BRIEF: BrandBrief = { brand: "", subject: "", style: "", palette: "", audience: "" };

type SavedShot = { url: string; tab: TabId; prompt: string; at: number };

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? { ...fallback, ...(JSON.parse(raw) as T) } : fallback;
  } catch {
    return fallback;
  }
}

function loadShots(): SavedShot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SHOTS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as SavedShot[]).filter((s) => typeof s?.url === "string") : [];
  } catch {
    return [];
  }
}

function persist(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full/blocked — non-fatal, the session simply won't persist.
  }
}

// ── Tabs ───────────────────────────────────────────────────────────────────

type TabId = "thumbnails" | "character" | "products" | "textcover";

const TABS: Array<{ id: TabId; label: string; icon: typeof Camera; blurb: string; inputLabel: string; placeholder: string }> = [
  {
    id: "thumbnails",
    label: "Thumbnails",
    icon: Camera,
    blurb: "Scroll-stopping cover frames for Reels, Shorts and TikTok.",
    inputLabel: "What's the post about? (topic + hook)",
    placeholder: "e.g. how I turned one selfie into a full music video — shocked expression, neon accent",
  },
  {
    id: "character",
    label: "Character Sheet",
    icon: User,
    blurb: "A consistent brand character across poses and expressions.",
    inputLabel: "Describe the character",
    placeholder: "e.g. confident female creator, silver bob haircut, violet streetwear, friendly energy",
  },
  {
    id: "products",
    label: "Product Grid",
    icon: Grid3X3,
    blurb: "Clean product shots in varied settings for feeds and ads.",
    inputLabel: "Describe the product",
    placeholder: "e.g. matte-black wireless earbuds in a charging case with a violet LED ring",
  },
  {
    id: "textcover",
    label: "Text Cover",
    icon: Type,
    blurb: "Bold typographic covers for carousels and announcements.",
    inputLabel: "Cover title text + vibe",
    placeholder: 'e.g. "AURORA 2.0 IS HERE" — bold condensed type, electric gradient background',
  },
];

/** Compose the final prompt from the brand brief + tab recipe + operator input. */
function buildPrompt(tab: TabId, brief: BrandBrief, input: string, variant: number): string {
  const briefBits = [
    brief.brand && `Brand: ${brief.brand}.`,
    brief.style && `Visual style: ${brief.style}.`,
    brief.palette && `Colour palette: ${brief.palette}.`,
    brief.audience && `Target audience: ${brief.audience}.`,
  ]
    .filter(Boolean)
    .join(" ");
  const subject = brief.subject ? ` Recurring subject: ${brief.subject}.` : "";
  const seed = variant > 0 ? ` Variation ${variant + 1}: change the composition and angle noticeably.` : "";

  switch (tab) {
    case "thumbnails":
      return `Vertical 9:16 social media thumbnail, ultra eye-catching, high contrast, single clear focal point, room for a text overlay in the top third (do not render text). ${input}. ${briefBits}${subject} Bold studio-quality lighting, crisp detail, thumb-stopping composition.${seed}`;
    case "character":
      return `Character reference sheet, single character shown in a 2x2 grid of poses on one seamless neutral background: front standing, three-quarter smiling, side profile, expressive close-up. Identical face, hair, outfit and proportions in every pose. Character: ${input}. ${briefBits} Clean flat studio lighting, consistent scale, no text.${seed}`;
    case "products":
      return `Premium product photograph for a social feed: ${input}. ${briefBits} Hero composition on a styled surface with soft shadows, shallow depth of field, accent lighting matching the palette, negative space for a caption (no rendered text). Commercial advertising quality.${seed}`;
    case "textcover":
      return `Bold typographic social media cover graphic, vertical 9:16. Large impactful display typography reading exactly: ${input}. ${briefBits} Modern poster design, strong grid, high contrast, spelling exactly as given, no extra words.${seed}`;
  }
}

type ResultShot = { url: string; prompt: string };

function SocialStudio() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [unlocked, setUnlocked] = useAdminAutoUnlock(!!user);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: authNextSearch() });
  }, [user, loading, navigate]);

  const genFn = usePerformanceShotJobFn();
  const pushFn = useServerFn(adminUpdateSiteImage);

  const [brief, setBrief] = useState<BrandBrief>(() => loadJson(BRIEF_KEY, EMPTY_BRIEF));
  useEffect(() => persist(BRIEF_KEY, brief), [brief]);

  const [shots, setShots] = useState<SavedShot[]>(() => loadShots());
  useEffect(() => persist(SHOTS_KEY, shots), [shots]);

  const [tab, setTab] = useState<TabId>("thumbnails");
  const [input, setInput] = useState("");
  const [count, setCount] = useState(2);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ResultShot[]>([]);
  const [pushTarget, setPushTarget] = useState<SiteImageKey>("hero_1");
  const [pushing, setPushing] = useState<string | null>(null);

  const active = TABS.find((t) => t.id === tab)!;
  const perImage = useMemo(() => computeCost({ features: ["image"] }).total, []);

  async function generate() {
    const trimmed = input.trim();
    if (!trimmed) {
      toast.error("Describe what you want first.");
      return;
    }
    setRunning(true);
    setResults([]);
    try {
      const prompts = Array.from({ length: count }, (_, i) => buildPrompt(tab, brief, trimmed, i));
      const settled = await Promise.allSettled(
        prompts.map((prompt) =>
          genFn({ data: { prompt, imageUrls: [], motionVideoUrl: null } }).then((r) => ({
            url: r.resultUrl,
            prompt,
          })),
        ),
      );
      const ok = settled.filter((s): s is PromiseFulfilledResult<ResultShot> => s.status === "fulfilled").map((s) => s.value);
      const failed = settled.length - ok.length;
      setResults(ok);
      if (ok.length) toast.success(`${ok.length} image${ok.length > 1 ? "s" : ""} ready`);
      if (failed) {
        const firstErr = settled.find((s) => s.status === "rejected") as PromiseRejectedResult | undefined;
        if (firstErr) handleGenerationError(firstErr.reason);
      }
    } finally {
      setRunning(false);
    }
  }

  function saveShot(r: ResultShot) {
    if (shots.some((s) => s.url === r.url)) {
      toast.info("Already saved");
      return;
    }
    setShots((prev) => [{ url: r.url, tab, prompt: r.prompt, at: Date.now() }, ...prev].slice(0, 60));
    toast.success("Saved to shots");
  }

  async function pushToSite(url: string) {
    setPushing(url);
    try {
      await pushFn({ data: { key: pushTarget, url } });
      window.dispatchEvent(new Event(SITE_IMAGES_REFRESH_EVENT));
      toast.success(`Now live as "${SITE_IMAGE_DEFAULTS[pushTarget].label}" (${pushTarget})`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Push failed");
    } finally {
      setPushing(null);
    }
  }

  async function downloadAll() {
    for (const s of shots) {
      await saveAssetToDisk(s.url, `aurora-social-${s.tab}-${s.at}.png`);
      // Stagger so the browser doesn't swallow the synthetic clicks.
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  if (!unlocked) return <AdminGate onUnlocked={() => setUnlocked(true)} />;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-6 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm text-primary">
              <Megaphone className="h-4 w-4" />
              Admin
            </div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Social Content Studio</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Produce on-brand social assets through Aurora's own pipeline — {perImage} Aura per image.
            </p>
          </div>
          <Link
            to="/admin"
            className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground no-underline transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Admin
          </Link>
        </header>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* ── Brand Brief sidebar ─────────────────────────────────────── */}
          <aside className="space-y-3 rounded-2xl border border-border bg-card/40 p-4 self-start">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium uppercase tracking-wider">Brand Brief</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Filled fields are woven into every prompt. Saved on this device.
            </p>
            <Input placeholder="Brand name" value={brief.brand} onChange={(e) => setBrief({ ...brief, brand: e.target.value })} />
            <Input placeholder="Recurring subject / character" value={brief.subject} onChange={(e) => setBrief({ ...brief, subject: e.target.value })} />
            <Input placeholder="Visual style (e.g. cinematic, y2k)" value={brief.style} onChange={(e) => setBrief({ ...brief, style: e.target.value })} />
            <Input placeholder="Palette (e.g. violet + black)" value={brief.palette} onChange={(e) => setBrief({ ...brief, palette: e.target.value })} />
            <Input placeholder="Audience" value={brief.audience} onChange={(e) => setBrief({ ...brief, audience: e.target.value })} />
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                setBrief(EMPTY_BRIEF);
                toast.success("Brief cleared");
              }}
            >
              Clear brief
            </Button>
          </aside>

          {/* ── Main column ─────────────────────────────────────────────── */}
          <main className="space-y-6 min-w-0">
            {/* Tabs */}
            <div className="flex gap-2 overflow-x-auto">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setTab(t.id);
                    setResults([]);
                  }}
                  className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${
                    tab === t.id
                      ? "border-primary/60 bg-primary/10 text-foreground"
                      : "border-border bg-card/40 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <t.icon className="h-4 w-4" />
                  {t.label}
                </button>
              ))}
            </div>

            {/* Composer */}
            <section className="space-y-3 rounded-2xl border border-border bg-card/40 p-4">
              <p className="text-sm text-muted-foreground">{active.blurb}</p>
              <label className="block text-sm font-medium">{active.inputLabel}</label>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={active.placeholder}
                rows={3}
              />
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1 rounded-xl border border-border p-1">
                  {[1, 2, 3, 4].map((n) => (
                    <button
                      key={n}
                      onClick={() => setCount(n)}
                      className={`rounded-lg px-2.5 py-1 text-sm transition-colors ${
                        count === n ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <Button onClick={generate} disabled={running || !input.trim()} className="gap-2">
                  {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                  {running ? "Rendering…" : `Generate ${count} · ${perImage * count} Aura`}
                </Button>
              </div>
            </section>

            {/* Results */}
            {results.length > 0 && (
              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold">Results</h2>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    Push target
                    <select
                      value={pushTarget}
                      onChange={(e) => setPushTarget(e.target.value as SiteImageKey)}
                      className="rounded-lg border border-border bg-card px-2 py-1.5 text-sm text-foreground"
                    >
                      {(Object.keys(SITE_IMAGE_DEFAULTS) as SiteImageKey[]).map((k) => (
                        <option key={k} value={k}>
                          {SITE_IMAGE_DEFAULTS[k].section} · {SITE_IMAGE_DEFAULTS[k].label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {results.map((r) => (
                    <figure key={r.url} className="group relative overflow-hidden rounded-xl border border-border bg-card/40">
                      <img src={r.url} alt="Generated social asset" className="aspect-[3/4] w-full object-cover" loading="lazy" />
                      <figcaption className="flex items-center justify-between gap-1 p-2">
                        <button
                          onClick={() => saveShot(r)}
                          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                          title="Save to shots"
                        >
                          <Save className="h-3.5 w-3.5" /> Save
                        </button>
                        <button
                          onClick={() => void saveAssetToDisk(r.url, `aurora-social-${tab}-${Date.now()}.png`)}
                          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                          title="Download"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => void pushToSite(r.url)}
                          disabled={pushing === r.url}
                          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-primary transition-colors hover:brightness-125 disabled:opacity-50"
                          title="Push to Site Images"
                        >
                          {pushing === r.url ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
                          Push
                        </button>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </section>
            )}

            {/* Saved shots */}
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">Saved Shots ({shots.length})</h2>
                {shots.length > 0 && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => void downloadAll()} className="gap-1.5">
                      <Download className="h-3.5 w-3.5" /> Download all
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShots([]);
                        toast.success("Cleared saved shots");
                      }}
                      className="gap-1.5"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Clear
                    </Button>
                  </div>
                )}
              </div>
              {shots.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  Nothing saved yet — generate assets above and hit Save on your keepers.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {shots.map((s) => (
                    <figure key={s.url} className="group relative overflow-hidden rounded-lg border border-border">
                      <img src={s.url} alt={`Saved ${s.tab} asset`} className="aspect-square w-full object-cover" loading="lazy" />
                      <div className="absolute inset-0 flex items-end justify-between bg-gradient-to-t from-black/70 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={() => void saveAssetToDisk(s.url, `aurora-social-${s.tab}-${s.at}.png`)}
                          className="rounded bg-white/10 p-1 text-white"
                          title="Download"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setShots((prev) => prev.filter((x) => x.url !== s.url))}
                          className="rounded bg-white/10 p-1 text-white"
                          title="Remove"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </figure>
                  ))}
                </div>
              )}
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
