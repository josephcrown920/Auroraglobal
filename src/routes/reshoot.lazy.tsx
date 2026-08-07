import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  reshootMultiAngle,
  RESHOOT_ANGLES,
  RESHOOT_COST_PER_IMAGE,
  type ReshootResult,
} from "@/lib/reshoot.functions";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  ImagePlus,
  X,
  Download,
  Share2,
  Camera,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { saveAssetToDisk } from "@/lib/save";
import { publishGeneration } from "@/lib/share.functions";

const TOTAL_COST = RESHOOT_ANGLES.length * RESHOOT_COST_PER_IMAGE;

export const Route = createLazyFileRoute("/reshoot")({ component: ReshootPage });

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
          {value ? "Reference uploaded — tap to replace" : "Tap to upload a portrait"}
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

function ResultCard({
  angleId,
  label,
  caption,
  result,
  pending,
}: {
  angleId: string;
  label: string;
  caption: string;
  result: ReshootResult | undefined;
  pending: boolean;
}) {
  const shareFn = useServerFn(publishGeneration);
  const shareMut = useMutation({
    mutationFn: async (id: string) => shareFn({ data: { id } }),
    onSuccess: async (r) => {
      try {
        await navigator.clipboard.writeText(r.url);
        toast.success("Share link copied");
      } catch {
        toast.success("Shared — link: " + r.url);
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Share failed"),
  });

  const succeeded = result?.status === "succeeded" && result.url;
  const failed = result?.status === "failed";

  return (
    <div className="relative rounded-2xl overflow-hidden border border-border bg-card/40 aspect-[9/16]">
      <div className="absolute top-2 left-2 z-10 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/85 text-primary-foreground text-[10px] font-semibold uppercase tracking-widest shadow">
        <Camera className="size-3" /> {label}
      </div>

      {succeeded ? (
        <>
          <img src={result.url} alt={label} className="w-full h-full object-cover" />
          <div className="absolute bottom-2 right-2 z-10 flex gap-1.5">
            {result.generationId && (
              <button
                type="button"
                onClick={() => shareMut.mutate(result.generationId!)}
                disabled={shareMut.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background/85 backdrop-blur text-xs font-medium hover:bg-background disabled:opacity-50"
                title="Share"
              >
                {shareMut.isPending ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Share2 className="size-3" />
                )}
                Share
              </button>
            )}
            <button
              type="button"
              onClick={() => saveAssetToDisk(result.url!, `aurora-reshoot-${angleId}.png`)}
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
      ) : failed ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-5">
          <AlertTriangle className="size-6 text-amber-400/80 mb-2" />
          <p className="text-xs text-amber-200/90 font-medium">This angle failed</p>
          <p className="text-[11px] text-muted-foreground mt-1">Auto-refunded — no Aura charged.</p>
        </div>
      ) : pending ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-5">
          <Loader2 className="size-6 animate-spin text-primary mb-2" />
          <p className="text-xs text-muted-foreground">{caption}</p>
        </div>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground text-xs px-5 text-center">
          <Camera className="size-6 text-primary/40 mb-2" />
          <p>{caption}</p>
        </div>
      )}
    </div>
  );
}

function ReshootPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  const reshootFn = useServerFn(reshootMultiAngle);

  const [reference, setReference] = useState<string | null>(null);
  const [results, setResults] = useState<ReshootResult[] | null>(null);

  const mut = useMutation({
    mutationFn: async () => {
      if (!reference) throw new Error("Upload a reference portrait first");
      return reshootFn({ data: { imageUrl: reference } });
    },
    onSuccess: (r) => {
      setResults(r.results);
      const ok = r.results.filter((x) => x.status === "succeeded").length;
      if (ok === 0) toast.error("All angles failed — your Aura was refunded.");
      else if (ok < r.results.length)
        toast.success(`${ok}/${r.results.length} angles ready — failed ones were refunded.`);
      else toast.success("All six angles are in.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Reshoot failed"),
  });

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  const resultFor = (id: string) => results?.find((r) => r.angleId === id);

  return (
    <main className="aurora-page-shell text-foreground">
      <span aria-hidden className="aurora-ambient" />
      <header className="relative z-10 flex items-center justify-between pl-24 pr-6 md:pr-10 py-4 border-b border-border bg-background/80 backdrop-blur-xl">
        <Link to="/studio" className="flex items-center gap-2 font-semibold tracking-tight">
          <ArrowLeft className="size-4 text-muted-foreground" />
          <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20"><span className="inline-block size-2.5 rounded-full bg-primary" /></span>
          Multi-Angle Reshoot
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

      <div className="relative z-10 max-w-7xl mx-auto p-5 md:p-10 grid lg:grid-cols-[1fr_1.4fr] gap-10">
        {/* LEFT — controls */}
        <section className="space-y-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              One photo. <span className="aurora-gradient-text">Six camera angles.</span>
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Upload a single portrait and we reshoot the exact same subject — same face, outfit,
              scene and lighting — from six fixed cinematic angles. {TOTAL_COST} Aura · ~30–45s.
            </p>
          </div>

          <MiniUpload
            userId={user.id}
            label="Reference portrait · required"
            value={reference}
            onChange={(v) => {
              setReference(v);
              setResults(null);
            }}
          />

          <Button
            variant="premium"
            disabled={!reference || mut.isPending}
            onClick={() => mut.mutate()}
            className="w-full h-14 text-base font-medium"
          >
            {mut.isPending ? (
              <>
                <Loader2 className="size-5 mr-2 animate-spin" /> Reshooting six angles…
              </>
            ) : (
              <>
                <Camera className="size-5 mr-2" /> Reshoot · {TOTAL_COST} Aura
              </>
            )}
          </Button>

          <div className="aurora-panel p-4 space-y-2">
            <p className="aurora-kicker">The six angles</p>
            <ul className="text-sm text-foreground/80 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
              {RESHOOT_ANGLES.map((a) => (
                <li key={a.id} className="flex items-start gap-1.5">
                  <span className="text-primary font-medium">{a.label}</span>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-muted-foreground pt-1">
              Each angle is {RESHOOT_COST_PER_IMAGE} Aura and charged on its own — if one fails it
              is refunded automatically, and the rest still come through.
            </p>
          </div>
        </section>

        {/* RIGHT — results grid */}
        <section className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {RESHOOT_ANGLES.map((a) => (
              <ResultCard
                key={a.id}
                angleId={a.id}
                label={a.label}
                caption={a.caption}
                result={resultFor(a.id)}
                pending={mut.isPending}
              />
            ))}
          </div>

          {/* Example outputs — shown before any generation to demonstrate what's possible */}
          {!results && !mut.isPending && (
            <div className="aurora-panel p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Example reshoot — red studio · 4 of 6 angles shown
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { src: "/josh/josh-red-angle1.png", label: "Fish-eye" },
                  { src: "/josh/josh-red-angle2.png", label: "Bird's-eye" },
                  { src: "/josh/josh-red-angle3.png", label: "Low angle" },
                  { src: "/josh/josh-red-angle4.png", label: "Dutch tilt" },
                ].map((ex) => (
                  <figure key={ex.src} className="relative overflow-hidden rounded-xl aspect-[3/4] bg-background/40 border border-border">
                    <img
                      src={ex.src}
                      alt={ex.label}
                      loading="lazy"
                      className="absolute inset-0 size-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/70 to-transparent">
                      <figcaption className="text-[10px] font-medium text-white/90">{ex.label}</figcaption>
                    </div>
                  </figure>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Same subject, same outfit, same scene — six camera angles from one photo. Upload yours above to run.
              </p>
            </div>
          )}

          {mut.isPending && (
            <div className="aurora-panel p-4 flex items-center gap-3">
              <Loader2 className="size-4 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Running six generations in parallel — usually 30–45 seconds.
              </p>
            </div>
          )}

          {results && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Saved to your gallery, tagged{" "}
                <span className="text-foreground/80">[Reshoot]</span>.
              </span>
              <Link to="/gallery" className="text-primary hover:underline">
                Open gallery →
              </Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
