import { authNextSearch } from "@/lib/auth-return-path";
import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FeatureGuard } from "@/components/FeatureVisibilityProvider";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  getKidsOptions,
  generateKidsScript,
  enqueueKidsStory,
  getKidsStoryStatus,
  listKidsStories,
} from "@/lib/kids-generation.functions";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  ImagePlus,
  X,
  Download,
  BookOpen,
  AlertTriangle,
  Check,
  Wand2,
  Pencil,
  Film,
  Music,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { saveAssetToDisk } from "@/lib/save";
import { ShareMenu } from "@/components/share/ShareMenu";
import { CartoonPreview } from "@/components/kids/CartoonPreview";
import { KidsShowcaseCarousel } from "@/components/kids/ShowcaseCarousel";
import { KIDS_CHARACTER_PREVIEWS } from "@/lib/kids-previews";

// Artist-only mode: this feature is hidden from regular users by default.
// Admins always pass; regular users are redirected to /studio unless the
// owner has toggled the feature visible (see feature-visibility registry).
export const Route = createLazyFileRoute("/kids")({
  component: () => (
    <FeatureGuard feature="kids">
      <KidsPage />
    </FeatureGuard>
  ),
});

const TERMINAL = new Set(["succeeded", "failed"]);

type Scene = { narration: string; illustration: string };

/** Compact uploader, styled to match the other tool pages. */
function MiniUpload({
  userId,
  label,
  value,
  onChange,
}: {
  userId: string;
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Max 20MB");
      return;
    }
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userId}/uploads/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("studio")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data: signed, error: signErr } = await supabase.storage
        .from("studio")
        .createSignedUrl(path, 60 * 60);
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
        "group relative h-24 w-full rounded-xl border border-dashed flex items-center gap-3 px-4 transition-colors overflow-hidden text-left",
        value ? "border-primary/40 bg-card/60" : "border-border bg-card/30 hover:border-primary/40",
      )}
    >
      <div className="relative size-16 shrink-0 rounded-lg overflow-hidden bg-background/60 flex items-center justify-center">
        {value ? (
          <img src={value} alt={label} className="size-full object-cover" />
        ) : busy ? (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        ) : (
          <ImagePlus className="size-5 text-muted-foreground group-hover:text-primary" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="text-sm text-foreground/80 truncate">
          {value ? "Character uploaded — tap to replace" : "Tap to upload your character art"}
        </div>
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
          <X className="size-4" />
        </span>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
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

function Choice({
  active,
  onClick,
  title,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  sub?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-left rounded-xl border px-3.5 py-3 transition-colors",
        active
          ? "border-primary/60 bg-primary/10 ring-1 ring-primary/30"
          : "border-border bg-card/30 hover:border-primary/40",
      )}
    >
      <div className="text-sm font-medium text-foreground flex items-center gap-1.5">
        {active && <Check className="size-3.5 text-primary" />}
        {title}
      </div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{sub}</div>}
    </button>
  );
}

const STAGE_ORDER = ["scripting", "rendering", "assembling", "succeeded"] as const;
const STAGE_LABEL: Record<string, string> = {
  scripting: "Writing the script",
  rendering: "Illustrating & animating scenes",
  assembling: "Stitching the final video",
  succeeded: "Finished",
};

function StageStepper({ status }: { status: string }) {
  const currentIdx =
    status === "pending"
      ? 0
      : STAGE_ORDER.indexOf(status as (typeof STAGE_ORDER)[number]);
  return (
    <ol className="space-y-2">
      {STAGE_ORDER.filter((s) => s !== "succeeded").map((stage, i) => {
        const done = currentIdx > i || status === "succeeded";
        const active = currentIdx === i && status !== "succeeded";
        return (
          <li key={stage} className="flex items-center gap-2.5 text-sm">
            <span
              className={cn(
                "size-5 shrink-0 rounded-full flex items-center justify-center text-[10px] border",
                done
                  ? "bg-primary border-primary text-primary-foreground"
                  : active
                    ? "border-primary text-primary"
                    : "border-border text-muted-foreground",
              )}
            >
              {done ? <Check className="size-3" /> : active ? <Loader2 className="size-3 animate-spin" /> : i + 1}
            </span>
            <span className={cn(done || active ? "text-foreground" : "text-muted-foreground")}>
              {STAGE_LABEL[stage]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function KidsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: authNextSearch() });
  }, [user, loading, navigate]);

  const optionsFn = useServerFn(getKidsOptions);
  const scriptFn = useServerFn(generateKidsScript);
  const enqueueFn = useServerFn(enqueueKidsStory);
  const statusFn = useServerFn(getKidsStoryStatus);
  const listFn = useServerFn(listKidsStories);

  const optionsQ = useQuery({
    queryKey: ["kids-options"],
    queryFn: () => optionsFn(),
    enabled: !!user,
  });
  const opts = optionsQ.data;

  const historyQ = useQuery({
    queryKey: ["kids-history"],
    queryFn: () => listFn(),
    enabled: !!user,
  });

  // Brief state
  const [contentType, setContentType] = useState("bedtime");
  const [ageRange, setAgeRange] = useState("3-5");
  const [topic, setTopic] = useState("");
  const [lengthId, setLengthId] = useState("short");
  const [musicId, setMusicId] = useState<string>("auto");

  // Character state
  const [charMode, setCharMode] = useState<"preset" | "avatar" | "upload">("preset");
  const [presetId, setPresetId] = useState<string | null>(null);
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);
  const [uploadName, setUploadName] = useState("My character");

  // Set default preset once options arrive.
  useEffect(() => {
    if (opts && presetId === null) setPresetId(opts.defaultCharacterId);
  }, [opts, presetId]);

  // Script + render state
  const [script, setScript] = useState<{ title: string; scenes: Scene[]; cost: number } | null>(
    null,
  );
  const [storyId, setStoryId] = useState<string | null>(null);

  const character = useMemo(() => {
    if (charMode === "preset") {
      const c = opts?.characters.find((x) => x.id === presetId);
      return {
        characterName: c?.name ?? "Fuzz the monster",
        characterDescription: c?.description as string | undefined,
        characterImageUrl: undefined as string | undefined,
      };
    }
    if (charMode === "avatar") {
      const a = opts?.avatars.find((x) => x.id === avatarId);
      return {
        characterName: a?.name ?? "My character",
        characterDescription: undefined as string | undefined,
        characterImageUrl: a?.previewUrl ?? undefined,
      };
    }
    return {
      characterName: uploadName.trim() || "My character",
      characterDescription: undefined as string | undefined,
      characterImageUrl: uploadUrl ?? undefined,
    };
  }, [charMode, presetId, avatarId, uploadUrl, uploadName, opts]);

  const characterReady =
    charMode === "preset"
      ? !!presetId
      : charMode === "avatar"
        ? !!avatarId
        : !!uploadUrl;

  const selectedLength = opts?.lengths.find((l) => l.id === lengthId);
  const cost = script?.cost ?? selectedLength?.cost ?? 0;

  // ── Script generation ──
  const scriptMut = useMutation({
    mutationFn: async () => {
      if (!topic.trim()) throw new Error("Tell us what the story is about");
      if (!characterReady) throw new Error("Pick or upload a character first");
      return scriptFn({
        data: {
          contentType: contentType as "bedtime" | "nursery_rhyme" | "educational" | "adventure",
          ageRange: ageRange as "0-3" | "3-5" | "5-8",
          topic: topic.trim(),
          lengthId: lengthId as "short" | "medium" | "long",
          characterName: character.characterName,
          characterDescription: character.characterDescription,
        },
      });
    },
    onSuccess: (r) => {
      setScript({ title: r.title, scenes: r.scenes, cost: r.cost });
      if (r.source === "template")
        toast.message("Used a built-in story template (no story AI configured).");
      else toast.success("Story drafted — review and tweak it below.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not write the story"),
  });

  // ── Enqueue render ──
  const enqueueMut = useMutation({
    mutationFn: async () => {
      if (!script) throw new Error("Write the script first");
      return enqueueFn({
        data: {
          contentType: contentType as "bedtime" | "nursery_rhyme" | "educational" | "adventure",
          ageRange: ageRange as "0-3" | "3-5" | "5-8",
          topic: topic.trim(),
          lengthId: lengthId as "short" | "medium" | "long",
          characterName: character.characterName,
          characterDescription: character.characterDescription,
          characterImageUrl: character.characterImageUrl,
          musicId: musicId === "auto" ? undefined : musicId,
          aspect: "9:16",
          script: { title: script.title, scenes: script.scenes },
        },
      });
    },
    onSuccess: (r) => {
      setStoryId(r.storyId);
      toast.success(`Story queued — ${r.credits} Aura reserved.`);
      historyQ.refetch();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not start the render"),
  });

  // ── Poll status ──
  const statusQ = useQuery({
    queryKey: ["kids-story", storyId],
    queryFn: () => statusFn({ data: { storyId: storyId! } }),
    enabled: !!storyId,
    staleTime: 0,
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s && TERMINAL.has(s) ? false : 4000;
    },
  });
  const story = statusQ.data;

  useEffect(() => {
    if (story && TERMINAL.has(story.status)) historyQ.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- historyQ.refetch is a stable TanStack Query method; dep narrowed to story status to avoid redundant refetches
  }, [story?.status]);

  const updateScene = (i: number, patch: Partial<Scene>) => {
    setScript((prev) =>
      prev
        ? { ...prev, scenes: prev.scenes.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) }
        : prev,
    );
  };

  const resetForNew = () => {
    setScript(null);
    setStoryId(null);
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  const rendering = !!storyId && (!story || !TERMINAL.has(story.status));
  const failed = story?.status === "failed";
  const succeeded = story?.status === "succeeded";

  return (
    <main className="aurora-page-shell text-foreground">
      <span aria-hidden className="aurora-ambient" />
      <header className="relative z-10 flex items-center justify-between pl-24 pr-6 md:pr-10 py-4 border-b border-border bg-background/80 backdrop-blur-xl">
        <Link to="/studio" className="flex items-center gap-2 font-semibold tracking-tight">
          <ArrowLeft className="size-4 text-muted-foreground" />
          <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20"><span className="inline-block size-2.5 rounded-full bg-primary" /></span>
          Kids Story Studio
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <Link to="/studio" className="text-muted-foreground hover:text-foreground">
            Full Studio
          </Link>
          <Link to="/gallery" className="text-muted-foreground hover:text-foreground">
            Gallery
          </Link>
        </div>
      </header>

      <div className="relative z-10 max-w-7xl mx-auto p-5 md:p-10 grid lg:grid-cols-[1fr_1.1fr] gap-10">
        {/* LEFT — brief / script */}
        <section className="space-y-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              A brief becomes a <span className="aurora-gradient-text">finished kids video.</span>
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Choose the kind of story, who it stars and what it's about. We write the script,
              illustrate and gently animate every scene, narrate it and add soft music — then stitch
              it into one MP4. {selectedLength ? `${cost} Aura` : ""} · faceless &amp; wholesome.
            </p>
          </div>

          {/* Content type */}
          <div className="space-y-2">
            <p className="aurora-kicker">Story type</p>
            <div className="grid grid-cols-2 gap-2">
              {(opts?.contentTypes ?? []).map((c) => (
                <Choice
                  key={c.id}
                  active={contentType === c.id}
                  onClick={() => setContentType(c.id)}
                  title={c.label}
                  sub={c.blurb}
                />
              ))}
            </div>
          </div>

          {/* Age + length */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="aurora-kicker">Age range</p>
              <div className="grid gap-2">
                {(opts?.ageRanges ?? []).map((a) => (
                  <Choice
                    key={a.id}
                    active={ageRange === a.id}
                    onClick={() => setAgeRange(a.id)}
                    title={a.label}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="aurora-kicker">Length</p>
              <div className="grid gap-2">
                {(opts?.lengths ?? []).map((l) => (
                  <Choice
                    key={l.id}
                    active={lengthId === l.id}
                    onClick={() => setLengthId(l.id)}
                    title={l.label}
                    sub={`${l.cost} Aura`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Topic */}
          <div className="space-y-2">
            <p className="aurora-kicker">What's it about?</p>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={2}
              maxLength={300}
              placeholder="e.g. a little star who's afraid of the dark and learns to glow"
              className="w-full rounded-xl border border-border bg-card/30 px-3.5 py-3 text-sm resize-none focus:outline-none focus:border-primary/50"
            />
          </div>

          {/* Character */}
          <div className="space-y-2">
            <p className="aurora-kicker">Character</p>
            <div className="inline-flex rounded-lg border border-border p-0.5 bg-card/30 text-xs">
              {(["preset", "avatar", "upload"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setCharMode(m)}
                  className={cn(
                    "px-3 py-1.5 rounded-md capitalize transition-colors",
                    charMode === m ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {m === "preset" ? "Presets" : m === "avatar" ? "My avatars" : "Upload"}
                </button>
              ))}
            </div>

            {charMode === "preset" && (
              <div className="grid grid-cols-2 gap-2">
                {(opts?.characters ?? []).map((c) => {
                  const preview = KIDS_CHARACTER_PREVIEWS[c.id];
                  const active = presetId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setPresetId(c.id)}
                      aria-pressed={active}
                      title={c.description}
                      className={cn(
                        "group relative rounded-xl border p-1.5 text-left transition-colors",
                        active
                          ? "border-primary/60 bg-primary/10 ring-1 ring-primary/30"
                          : "border-border bg-card/30 hover:border-primary/40",
                      )}
                    >
                      <div className="relative">
                        {preview ? (
                          <CartoonPreview
                            src={preview.loop}
                            poster={preview.poster}
                            alt={c.name}
                            rounded="rounded-lg"
                            className="aspect-[4/5] w-full"
                          />
                        ) : (
                          <div className="aspect-[4/5] w-full rounded-lg bg-card/40" />
                        )}
                        {active && (
                          <span className="absolute top-1 right-1 size-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow">
                            <Check className="size-3" />
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 px-0.5 text-xs font-medium text-foreground truncate">
                        {c.name}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}

            {charMode === "avatar" &&
              ((opts?.avatars.length ?? 0) > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {opts!.avatars.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setAvatarId(a.id)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl border p-2 transition-colors text-left",
                        avatarId === a.id
                          ? "border-primary/60 bg-primary/10 ring-1 ring-primary/30"
                          : "border-border bg-card/30 hover:border-primary/40",
                      )}
                    >
                      <div className="size-10 rounded-lg overflow-hidden bg-background/60 shrink-0">
                        {a.previewUrl && (
                          <img src={a.previewUrl} alt={a.name} className="size-full object-cover" />
                        )}
                      </div>
                      <span className="text-sm truncate">{a.name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground rounded-xl border border-border bg-card/30 px-3.5 py-3">
                  No saved avatars yet. Pick a preset or upload your own character art.
                </p>
              ))}

            {charMode === "upload" && (
              <div className="space-y-2">
                <MiniUpload
                  userId={user.id}
                  label="Character art · required"
                  value={uploadUrl}
                  onChange={setUploadUrl}
                />
                <input
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  maxLength={80}
                  placeholder="Character name"
                  className="w-full rounded-xl border border-border bg-card/30 px-3.5 py-2.5 text-sm focus:outline-none focus:border-primary/50"
                />
              </div>
            )}
          </div>

          {/* Music */}
          <div className="space-y-2">
            <p className="aurora-kicker flex items-center gap-1.5">
              <Music className="size-3.5" /> Background music
            </p>
            <select
              value={musicId}
              onChange={(e) => setMusicId(e.target.value)}
              className="w-full rounded-xl border border-border bg-card/30 px-3.5 py-2.5 text-sm focus:outline-none focus:border-primary/50"
            >
              <option value="auto">Auto — pick to match the story</option>
              <option value="none">No music</option>
              {(opts?.music ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} · {m.mood}
                </option>
              ))}
            </select>
          </div>

          {/* Actions */}
          {!script ? (
            <Button
              variant="premium"
              disabled={!topic.trim() || !characterReady || scriptMut.isPending}
              onClick={() => scriptMut.mutate()}
              className="w-full h-14 text-base font-medium"
            >
              {scriptMut.isPending ? (
                <>
                  <Loader2 className="size-5 mr-2 animate-spin" /> Writing the story…
                </>
              ) : (
                <>
                  <Wand2 className="size-5 mr-2" /> Write the script
                </>
              )}
            </Button>
          ) : (
            <div className="aurora-panel p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="aurora-kicker flex items-center gap-1.5">
                  <Pencil className="size-3.5" /> Review &amp; edit the script
                </p>
                <button
                  type="button"
                  onClick={() => scriptMut.mutate()}
                  disabled={scriptMut.isPending}
                  className="text-xs text-primary hover:underline disabled:opacity-50"
                >
                  {scriptMut.isPending ? "Rewriting…" : "Rewrite"}
                </button>
              </div>
              <input
                value={script.title}
                onChange={(e) => setScript({ ...script, title: e.target.value })}
                className="w-full rounded-lg border border-border bg-background/40 px-3 py-2 text-sm font-medium focus:outline-none focus:border-primary/50"
              />
              <div className="space-y-3 max-h-[42vh] overflow-y-auto pr-1">
                {script.scenes.map((s, i) => (
                  <div key={i} className="rounded-lg border border-border bg-background/30 p-3 space-y-2">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Scene {i + 1}
                    </p>
                    <textarea
                      value={s.narration}
                      onChange={(e) => updateScene(i, { narration: e.target.value })}
                      rows={2}
                      maxLength={600}
                      placeholder="Narration"
                      className="w-full rounded-md border border-border bg-card/30 px-3 py-2 text-sm resize-none focus:outline-none focus:border-primary/50"
                    />
                    <textarea
                      value={s.illustration}
                      onChange={(e) => updateScene(i, { illustration: e.target.value })}
                      rows={2}
                      maxLength={800}
                      placeholder="Illustration description"
                      className="w-full rounded-md border border-border bg-card/30 px-3 py-2 text-xs text-muted-foreground resize-none focus:outline-none focus:border-primary/50"
                    />
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  variant="premium"
                  disabled={enqueueMut.isPending || rendering}
                  onClick={() => enqueueMut.mutate()}
                  className="flex-1 h-12 font-medium"
                >
                  {enqueueMut.isPending ? (
                    <>
                      <Loader2 className="size-5 mr-2 animate-spin" /> Starting render…
                    </>
                  ) : (
                    <>
                      <Film className="size-5 mr-2" /> Render story · {cost} Aura
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={resetForNew} className="h-12">
                  Start over
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* RIGHT — render / preview */}
        <section className="space-y-4">
          <div className="rounded-3xl overflow-hidden border border-border bg-card/60 backdrop-blur-xl aspect-[9/16] max-w-sm mx-auto w-full relative shadow-[var(--shadow-soft)]">
            {succeeded && story?.videoUrl ? (
              <video
                src={story.videoUrl}
                poster={story.posterUrl ?? undefined}
                controls
                playsInline
                className="w-full h-full object-cover bg-black"
              />
            ) : failed ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                <AlertTriangle className="size-7 text-amber-400/80 mb-2" />
                <p className="text-sm text-amber-200/90 font-medium">This story couldn't finish</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {story?.error ?? "Something went wrong."}
                </p>
                <p className="text-[11px] text-muted-foreground mt-2">
                  Your Aura was refunded automatically.
                </p>
              </div>
            ) : rendering ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 gap-4">
                <Loader2 className="size-7 animate-spin text-primary" />
                <p className="text-sm text-foreground/80">
                  {STAGE_LABEL[story?.status ?? "pending"] ?? "Getting started"}…
                </p>
                {story?.posterUrl && (
                  <img
                    src={story.posterUrl}
                    alt="preview"
                    className="absolute inset-0 -z-10 size-full object-cover opacity-30"
                  />
                )}
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground text-sm px-6 text-center">
                <BookOpen className="size-8 text-primary/40 mb-2" />
                <p>Your finished story video will play here.</p>
              </div>
            )}
          </div>

          {/* Stage progress */}
          {rendering && story && (
            <div className="aurora-panel p-4 space-y-3">
              <StageStepper status={story.status} />
              {story.scenes.some((s) => "status" in (s as object)) && (
                <div className="grid grid-cols-5 gap-1.5 pt-1">
                  {story.scenes.map((s, i) => (
                    <div
                      key={i}
                      className="relative aspect-[9/16] rounded-md overflow-hidden border border-border bg-background/40"
                      title={s.error ?? s.status}
                    >
                      {s.imageUrl ? (
                        <img src={s.imageUrl} alt={`scene ${i + 1}`} className="size-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          {s.error ? (
                            <AlertTriangle className="size-3.5 text-amber-400/80" />
                          ) : (
                            <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Done actions */}
          {succeeded && story?.videoUrl && (
            <div className="flex items-center justify-between gap-3">
              <Button
                onClick={() =>
                  saveAssetToDisk(story.videoUrl!, `aurora-kids-${story.id}.mp4`)
                }
                variant="premium"
                className="flex-1"
              >
                <Download className="size-4 mr-2" /> Download MP4
              </Button>
              <ShareMenu
                getShareTarget={() => ({
                  url: story.videoUrl!,
                  text: "Check out this story I made with Aurora!",
                  assetUrl: story.videoUrl!,
                  filename: `aurora-kids-${story.id}.mp4`,
                })}
                triggerClassName="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-background/60 text-sm font-medium hover:bg-background disabled:opacity-50"
              />
              <Link to="/gallery" className="text-sm text-primary hover:underline whitespace-nowrap">
                Open gallery →
              </Link>
            </div>
          )}

          {/* History */}
          {(historyQ.data?.length ?? 0) > 0 && (
            <div className="aurora-panel p-4 space-y-3">
              <p className="aurora-kicker">Recent stories</p>
              <div className="grid grid-cols-2 gap-2">
                {historyQ.data!.slice(0, 6).map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => {
                      setStoryId(h.id);
                      setScript(null);
                    }}
                    className="group relative aspect-[9/16] rounded-lg overflow-hidden border border-border bg-background/40 text-left"
                  >
                    {h.posterUrl ? (
                      <img src={h.posterUrl} alt={h.title ?? "story"} className="size-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <BookOpen className="size-5 text-primary/40" />
                      </div>
                    )}
                    <div className="absolute bottom-0 inset-x-0 p-1.5 pt-6 bg-gradient-to-t from-black/80 to-transparent">
                      <p className="text-[10px] text-white truncate">{h.title ?? "Untitled"}</p>
                      <p className="text-[9px] text-white/60 capitalize">{h.status}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sample stories showcase */}
          <div className="aurora-panel p-4 space-y-3">
            <div>
              <p className="aurora-kicker flex items-center gap-1.5">
                <Film className="size-3.5" /> See an example
              </p>
              <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">
                A peek at the kind of finished, faceless story you'll get — illustrated, gently
                animated and narrated.
              </p>
            </div>
            <KidsShowcaseCarousel />
          </div>

          <div className="aurora-panel p-4 space-y-1.5">
            <p className="aurora-kicker flex items-center gap-1.5">
              <Sparkles className="size-3.5" /> How it works
            </p>
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              We write a short script, draw every scene in a consistent storybook style (your
              character is held the same throughout), add gentle motion and narration, layer in soft
              royalty-free music, and stitch it all into one vertical video — ready to preview,
              download and share from your gallery.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
