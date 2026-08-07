import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useSplitRealityJobFn } from "@/lib/use-job-polling";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  ImagePlus,
  X,
  Download,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { saveAssetToDisk } from "@/lib/save";
import { publishGeneration } from "@/lib/share.functions";
import { ShareMenu } from "@/components/share/ShareMenu";

export const Route = createLazyFileRoute("/split-reality")({ component: SplitRealityPage });

/** Compact uploader, styled to match the Colors page. */
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
        "group relative h-20 rounded-xl border border-dashed flex items-center gap-3 px-3 transition-colors overflow-hidden text-left",
        value
          ? "border-primary/40 bg-card/60"
          : "border-border bg-card/30 hover:border-primary/40",
      )}
    >
      <div className="relative size-14 shrink-0 rounded-lg overflow-hidden bg-background/60 flex items-center justify-center">
        {value ? (
          <img src={value} alt={label} className="size-full object-cover" />
        ) : busy ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : (
          <ImagePlus className="size-4 text-muted-foreground group-hover:text-primary" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="text-xs text-foreground/80 truncate">
          {value ? "Uploaded" : "Tap to upload"}
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
          <X className="size-3.5" />
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

type SideResult = { id: string; url: string; variant: string };
type SplitMode = "mirror" | "characters";

function ResultCard({
  side,
  label,
  caption,
}: {
  side: SideResult | null;
  label: string;
  caption: string;
}) {
  const shareFn = useServerFn(publishGeneration);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-border bg-card/40 aspect-[4/5]">
      <div className="absolute top-2 left-2 z-10 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/85 text-primary-foreground text-[10px] font-semibold uppercase tracking-widest shadow">
        <Sparkles className="size-3" /> {label}
      </div>
      {side ? (
        <>
          <img
            src={side.url}
            alt={label}
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-2 right-2 z-10 flex gap-1.5">
            <ShareMenu
              triggerClassName="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background/85 backdrop-blur text-xs font-medium hover:bg-background disabled:opacity-50"
              getShareTarget={async () => {
                const r = await shareFn({ data: { id: side.id } });
                return {
                  url: `${window.location.origin}${r.url}`,
                  text: caption,
                  assetUrl: side.url,
                  filename: `aurora-split-${side.variant}-${side.id.slice(0, 6)}.png`,
                };
              }}
            />
            <button
              type="button"
              onClick={() =>
                saveAssetToDisk(
                  side.url,
                  `aurora-split-${side.variant}-${side.id.slice(0, 6)}.png`,
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background/85 backdrop-blur text-xs font-medium hover:bg-background"
              title="Save image"
            >
              <Download className="size-3" /> Save
            </button>
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-3 pt-10 text-[11px] text-white bg-gradient-to-t from-black/80 to-transparent">
            {caption}
          </div>
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground text-xs px-6 text-center">
          <Sparkles className="size-6 text-primary/40 mb-2" />
          <p>{caption}</p>
        </div>
      )}
    </div>
  );
}

function SplitRealityPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  const splitFn = useSplitRealityJobFn();

  const [mode, setMode] = useState<SplitMode>("mirror");

  // mirror mode
  const [selfie, setSelfie] = useState<string | null>(null);
  const [outfit, setOutfit] = useState<string | null>(null);
  const [scene, setScene] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");

  // characters mode
  const [selfieA, setSelfieA] = useState<string | null>(null);
  const [outfitA, setOutfitA] = useState<string | null>(null);
  const [selfieB, setSelfieB] = useState<string | null>(null);
  const [outfitB, setOutfitB] = useState<string | null>(null);
  const [action, setAction] = useState("");
  const [lifeA, setLifeA] = useState("");
  const [lifeB, setLifeB] = useState("");

  const [result, setResult] = useState<{
    mode: SplitMode;
    left: SideResult;
    right: SideResult;
  } | null>(null);

  const mut = useMutation({
    mutationFn: async () => {
      if (mode === "characters") {
        const imageUrlsA = [selfieA, outfitA].filter((x): x is string => !!x);
        const imageUrlsB = [selfieB, outfitB].filter((x): x is string => !!x);
        if (imageUrlsA.length === 0 || imageUrlsB.length === 0)
          throw new Error("Upload a reference photo for both characters");
        if (action.trim().length < 3)
          throw new Error("Describe the shared action both characters are doing");
        return splitFn({
          data: {
            mode: "characters",
            imageUrlsA,
            imageUrlsB,
            action,
            lifeA,
            lifeB,
            basePrompt: prompt,
          },
        });
      }
      const imageUrls = [selfie, outfit, scene].filter(
        (x): x is string => !!x,
      );
      if (imageUrls.length === 0)
        throw new Error("Upload at least a selfie reference");
      return splitFn({ data: { mode: "mirror", imageUrls, basePrompt: prompt } });
    },
    onSuccess: (r) => {
      setResult({ ...r, mode });
      toast.success(mode === "characters" ? "Both lives are in." : "Both realities are in.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  const ready = mode === "characters" ? !!selfieA && !!selfieB && action.trim().length >= 3 : !!selfie;

  return (
    <main className="aurora-page-shell text-foreground">
      <span aria-hidden className="aurora-ambient" />
      <header className="relative z-10 flex items-center justify-between pl-24 pr-6 md:pr-10 py-4 border-b border-border bg-background/80 backdrop-blur-xl">
        <Link to="/studio" className="flex items-center gap-2 font-semibold tracking-tight">
          <ArrowLeft className="size-4 text-muted-foreground" />
          <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20"><span className="inline-block size-2.5 rounded-full bg-primary" /></span>
          Split Reality
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <Link to="/colors" className="text-muted-foreground hover:text-foreground">
            Colors
          </Link>
          <Link to="/gallery" className="text-muted-foreground hover:text-foreground">
            Gallery
          </Link>
          <Link to="/studio" className="text-muted-foreground hover:text-foreground">
            Full Studio
          </Link>
        </div>
      </header>

      <div className="relative z-10 max-w-7xl mx-auto p-5 md:p-10 grid lg:grid-cols-[1fr_1.2fr] gap-10">
        {/* LEFT — controls */}
        <section className="space-y-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              {mode === "characters" ? (
                <>
                  Two lives.{" "}
                  <span className="aurora-gradient-text">One moment.</span>
                </>
              ) : (
                <>
                  One subject.{" "}
                  <span className="aurora-gradient-text">Two realities.</span>
                </>
              )}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {mode === "characters"
                ? "Two different characters, living opposite lives, doing the exact same thing at the exact same moment — rendered side by side. 2 Aura · ~20–30s."
                : "We run two image generations in parallel from the same references: a documentary mirror-selfie on one side, and a moody cinematic close-up on the other. 2 Aura · ~20–30s."}
            </p>
          </div>

          <div className="inline-flex p-1 rounded-full bg-card/60 border border-border gap-1">
            <button
              type="button"
              onClick={() => setMode("mirror")}
              className={cn(
                "px-4 py-1.5 rounded-full text-xs font-medium transition-colors",
                mode === "mirror" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              Mirror universe
            </button>
            <button
              type="button"
              onClick={() => setMode("characters")}
              className={cn(
                "px-4 py-1.5 rounded-full text-xs font-medium transition-colors",
                mode === "characters" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              Two characters
            </button>
          </div>

          {mode === "mirror" ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <MiniUpload
                userId={user.id}
                label="Selfie · required"
                value={selfie}
                onChange={setSelfie}
              />
              <MiniUpload
                userId={user.id}
                label="Outfit · optional"
                value={outfit}
                onChange={setOutfit}
              />
              <MiniUpload
                userId={user.id}
                label="Scene · optional"
                value={scene}
                onChange={setScene}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-primary">Character A</p>
                <MiniUpload userId={user.id} label="Selfie · required" value={selfieA} onChange={setSelfieA} />
                <MiniUpload userId={user.id} label="Outfit · optional" value={outfitA} onChange={setOutfitA} />
                <Textarea
                  value={lifeA}
                  onChange={(e) => setLifeA(e.target.value.slice(0, 300))}
                  rows={2}
                  placeholder="Their life (optional) — e.g. cramped studio apartment, working two jobs"
                  className="bg-background/60 text-xs"
                />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-primary">Character B</p>
                <MiniUpload userId={user.id} label="Selfie · required" value={selfieB} onChange={setSelfieB} />
                <MiniUpload userId={user.id} label="Outfit · optional" value={outfitB} onChange={setOutfitB} />
                <Textarea
                  value={lifeB}
                  onChange={(e) => setLifeB(e.target.value.slice(0, 300))}
                  rows={2}
                  placeholder="Their life (optional) — e.g. penthouse, private chef, luxury car"
                  className="bg-background/60 text-xs"
                />
              </div>
            </div>
          )}

          {mode === "characters" && (
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 block">
                Shared action (required)
              </label>
              <Textarea
                value={action}
                onChange={(e) => setAction(e.target.value.slice(0, 300))}
                rows={2}
                placeholder="e.g. brushing their teeth while looking in the mirror"
                className="bg-background/60"
              />
            </div>
          )}

          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 block">
              Extra direction (optional)
            </label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value.slice(0, 600))}
              rows={3}
              placeholder="e.g. wearing all black, neon street background, gold chain visible"
              className="bg-background/60"
            />
          </div>

          <Button
            variant="premium"
            disabled={!ready || mut.isPending}
            onClick={() => mut.mutate()}
            className="w-full h-14 text-base font-medium"
          >
            {mut.isPending ? (
              <>
                <Loader2 className="size-5 mr-2 animate-spin" /> {mode === "characters" ? "Living both lives…" : "Splitting reality…"}
              </>
            ) : (
              <>
                <Wand2 className="size-5 mr-2" /> {mode === "characters" ? "Generate both lives · 2 Aura" : "Generate both realities · 2 Aura"}
              </>
            )}
          </Button>

          <div className="aurora-panel p-4 space-y-2">
            <p className="aurora-kicker">
              What you get
            </p>
            {mode === "characters" ? (
              <ul className="text-sm text-foreground/80 space-y-1.5">
                <li>
                  <span className="text-primary font-medium">Character A</span> · your first
                  reference, living their own life, doing the shared action.
                </li>
                <li>
                  <span className="text-primary font-medium">Character B</span> · your second
                  reference, living a contrasting life, doing the exact same action.
                </li>
              </ul>
            ) : (
              <ul className="text-sm text-foreground/80 space-y-1.5">
                <li>
                  <span className="text-primary font-medium">Ultra-real</span> · phone
                  mirror selfie, natural skin, indoor light, no styling.
                </li>
                <li>
                  <span className="text-primary font-medium">Cinematic</span> · anamorphic
                  close-up, windswept hair, moody grade, ARRI look.
                </li>
              </ul>
            )}
          </div>
        </section>

        {/* RIGHT — split view */}
        <section className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <ResultCard
              side={result?.left ?? null}
              label={mode === "characters" ? "Character A" : "Ultra-real"}
              caption={
                mode === "characters"
                  ? "Character A living their life, doing the shared action"
                  : "Documentary mirror-selfie · natural skin & light"
              }
            />
            <ResultCard
              side={result?.right ?? null}
              label={mode === "characters" ? "Character B" : "Cinematic"}
              caption={
                mode === "characters"
                  ? "Character B living a contrasting life, same action"
                  : "Anamorphic close-up · ARRI cinematic grade"
              }
            />
          </div>

          {mut.isPending && (
            <div className="aurora-panel p-4 flex items-center gap-3">
              <Loader2 className="size-4 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Running two generations in parallel — usually 20–30 seconds.
              </p>
            </div>
          )}

          {result && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Saved to your gallery, tagged{" "}
                <span className="text-foreground/80">[Split Reality]</span>.
              </span>
              <Link
                to="/gallery"
                className="text-primary hover:underline"
              >
                Open gallery →
              </Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
