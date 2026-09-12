import { Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { ArrowRight, Flame, ImageIcon, Sparkles } from "lucide-react";
import { buildFallbackSpecs, type SpinSpec } from "@/lib/spin-engine";
import { ResponsiveImage } from "@/components/ui/responsive-image";

const HOOK_CHIPS = [
  { label: "New single out now", topic: "my new single just dropped" },
  { label: "Day in my life", topic: "day in my life as an artist" },
  { label: "Outfit of the day", topic: "outfit of the day lookbook" },
  { label: "Behind the scenes", topic: "behind the scenes in the studio" },
  { label: "Gym era", topic: "gym transformation era" },
  { label: "Album rollout", topic: "album rollout content" },
];

const PREVIEW_COUNT = 4;

function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function PreviewCard({ spec, index }: { spec: SpinSpec; index: number }) {
  return (
    <div
      className="relative flex flex-col justify-between rounded-2xl border border-white/10 bg-zinc-900/80 p-4 overflow-hidden"
      style={{
        animation: `ve-fade-in 0.3s ease-out ${index * 60}ms both`,
      }}
    >
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-brand/5 to-transparent" />

      <div className="relative">
        <span className="inline-flex items-center gap-1 rounded-md bg-brand/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-brand mb-2">
          {spec.contentType}
        </span>
        <p className="text-[13px] font-semibold text-zinc-100 leading-snug line-clamp-2">
          {spec.hook}
        </p>
      </div>

      <div className="relative mt-3 space-y-1">
        <p className="text-[11px] text-zinc-400 line-clamp-2 leading-snug">{spec.caption}</p>
        <p className="text-[10px] text-zinc-600 leading-snug">
          {spec.mood} · {spec.location}
        </p>
      </div>
    </div>
  );
}

function PreviewSkeleton({ index }: { index: number }) {
  return (
    <div
      className="rounded-2xl border border-white/8 bg-zinc-900/50 p-4"
      style={{ animation: `ve-shimmer 1.4s ease-in-out ${index * 150}ms infinite` }}
    >
      <div className="mb-2 h-3 w-20 rounded bg-zinc-800" />
      <div className="h-4 w-full rounded bg-zinc-800 mb-1.5" />
      <div className="h-4 w-3/4 rounded bg-zinc-800" />
      <div className="mt-3 h-3 w-5/6 rounded bg-zinc-800/60" />
    </div>
  );
}

export function ViralEngine() {
  const [activeChip, setActiveChip] = useState<string>(HOOK_CHIPS[0].topic);
  const [customText, setCustomText] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewImageLoading, setPreviewImageLoading] = useState(true);
  const [specs, setSpecs] = useState<SpinSpec[]>(() =>
    buildFallbackSpecs(HOOK_CHIPS[0].topic, PREVIEW_COUNT),
  );
  const inputRef = useRef<HTMLInputElement>(null);

  const rawTopic = customText.trim() || activeChip;
  const debouncedTopic = useDebounce(rawTopic, 300);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      setSpecs(buildFallbackSpecs(debouncedTopic, PREVIEW_COUNT));
      setLoading(false);
    }, 50);
    return () => clearTimeout(t);
  }, [debouncedTopic]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 7_000);
    setPreviewImageLoading(true);

    void fetch("/api/public/viral-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: debouncedTopic }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Preview unavailable");
        return (await response.json()) as { url?: unknown };
      })
      .then(({ url }) => {
        if (!active) return;
        if (typeof url !== "string" || !url.startsWith("https://image.pollinations.ai/")) {
          throw new Error("Invalid preview URL");
        }
        setPreviewImageUrl(url);
      })
      .catch(() => {
        if (active) {
          setPreviewImageUrl(null);
          setPreviewImageLoading(false);
        }
      })
      .finally(() => {
        clearTimeout(timeout);
      });

    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [debouncedTopic]);

  useEffect(() => {
    if (!previewImageUrl || !previewImageLoading) return;
    const timeout = setTimeout(() => {
      setPreviewImageUrl(null);
      setPreviewImageLoading(false);
    }, 8_000);
    return () => clearTimeout(timeout);
  }, [previewImageUrl, previewImageLoading]);

  const handleChipClick = (chip: typeof HOOK_CHIPS[0]) => {
    setActiveChip(chip.topic);
    setCustomText("");
    inputRef.current?.blur();
  };

  const navigateTopic = rawTopic;

  return (
    <section className="relative z-10 py-20 px-5 border-t border-white/5 overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(109,40,217,0.18) 0%, transparent 70%)",
        }}
      />

      <div className="relative">
        <div className="mb-8">
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.3em] text-brand">
            <Flame className="size-3.5" />
            Go viral on TikTok
          </span>
          <h2 className="mt-3 text-4xl font-semibold leading-tight">
            Type a hook.{" "}
            <span className="font-serif italic">See your 50 posts.</span>
          </h2>
          <p className="mt-3 text-sm text-zinc-400 max-w-[38ch] leading-relaxed">
            Pick a topic below or type your own — Aurora generates a scroll-stopping
            preview before you even sign in.
          </p>

          {/* Real output showcase */}
          <div className="mt-6 rounded-2xl overflow-hidden ring-1 ring-white/10 relative">
            <ResponsiveImage
              src="/spin-demo.jpg"
              sizes="(min-width: 900px) 560px, 100vw"
              alt="9 campaign shots generated from one studio session"
              className="w-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand">Real output</p>
                <p className="text-xs font-semibold text-white mt-0.5">9 campaign shots · one studio session</p>
              </div>
              <span className="rounded-full bg-brand/20 px-2.5 py-1 text-[10px] font-bold text-brand">
                TikTok30
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-5">
          {HOOK_CHIPS.map((chip) => {
            const isActive = activeChip === chip.topic && customText === "";
            return (
              <button
                key={chip.topic}
                type="button"
                onClick={() => handleChipClick(chip)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/70 ${
                  isActive
                    ? "bg-brand/20 text-brand shadow-[0_0_12px_-4px] shadow-brand/50"
                    : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
                }`}
              >
                <Sparkles className="size-3 shrink-0 opacity-70" />
                {chip.label}
              </button>
            );
          })}
        </div>

        <div className="relative mb-6">
          <input
            ref={inputRef}
            type="text"
            value={customText}
            onChange={(e) => {
              const val = e.target.value;
              setCustomText(val);
              if (val.trim()) {
                setActiveChip("");
              } else {
                setActiveChip(HOOK_CHIPS[0].topic);
              }
            }}
            placeholder="Or type your own hook topic…"
            maxLength={120}
            className="w-full rounded-2xl border border-white/10 bg-zinc-900/80 px-4 py-3.5 pr-14 text-sm text-zinc-100 placeholder-zinc-600 outline-none ring-0 transition-all duration-150 focus:border-brand/50 focus:ring-2 focus:ring-brand/20"
          />
          {customText && (
            <button
              type="button"
              onClick={() => {
                setCustomText("");
                setActiveChip(HOOK_CHIPS[0].topic);
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-300 text-lg leading-none"
              aria-label="Clear"
            >
              ×
            </button>
          )}
        </div>

        <div
          className="relative mb-3 aspect-[4/5] overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/70"
          aria-live="polite"
          aria-label="Rendered post preview"
        >
          {previewImageUrl && (
            <img
              key={previewImageUrl}
              src={previewImageUrl}
              alt={`AI-rendered TikTok campaign preview for ${debouncedTopic}`}
              className="h-full w-full object-cover"
              loading="lazy"
              onLoad={() => setPreviewImageLoading(false)}
              onError={() => {
                setPreviewImageUrl(null);
                setPreviewImageLoading(false);
              }}
            />
          )}
          {previewImageLoading && (
            <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-brand/15 via-zinc-900 to-zinc-950" />
          )}
          {!previewImageLoading && !previewImageUrl && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-zinc-950/75 px-8 text-center">
              <ImageIcon className="size-7 text-zinc-600" aria-hidden="true" />
              <p className="text-xs font-semibold text-zinc-400">Visual preview is taking a break</p>
              <p className="text-[11px] text-zinc-600">Your post ideas are still ready below.</p>
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/10" />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand">
              AI-rendered preview
            </p>
            <p className="mt-1 line-clamp-2 text-sm font-semibold text-white">
              {specs[0]?.hook}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-7" aria-live="polite" aria-label="Post preview">
          {loading
            ? Array.from({ length: PREVIEW_COUNT }).map((_, i) => (
                <PreviewSkeleton key={i} index={i} />
              ))
            : specs.map((spec, i) => (
                <PreviewCard key={`${debouncedTopic}-${i}`} spec={spec} index={i} />
              ))}
        </div>

        <p className="text-[11px] text-zinc-600 mb-4 text-center tracking-wide">
          Showing {PREVIEW_COUNT} of 50 posts · all from your topic, zero repeats
        </p>

        <Link
          to="/spin"
          search={{ prompt: navigateTopic, jobId: undefined }}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand to-violet-400 py-4 text-sm font-bold text-white shadow-[0_8px_30px_-8px] shadow-brand/60 transition-transform hover:scale-[1.01] active:scale-[0.99] no-underline"
        >
          Generate all 50 posts
          <ArrowRight className="size-4" />
        </Link>

        <p className="mt-3 text-center text-[11px] text-zinc-600">
          Sign in to render · 50 free Aura on signup
        </p>
      </div>

      <style>{`
        @keyframes ve-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ve-shimmer {
          0%, 100% { opacity: 0.5; }
          50%       { opacity: 0.8; }
        }
      `}</style>
    </section>
  );
}
