import { authNextSearch } from "@/lib/auth-return-path";
import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { editPhoto } from "@/lib/photo-edit.functions";
import { PRICING } from "@/lib/pricing";
import { handleGenerationError } from "@/lib/error-toasts";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Brush,
  Download,
  ImagePlus,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { saveAssetToDisk } from "@/lib/save";

const COST = PRICING.base.image;

const EXAMPLE_EDITS = [
  "Remove the people in the background",
  "Make it golden hour",
  "Turn it black and white",
  "Put me in a black suit",
  "Add soft studio lighting",
  "Clean up the skin, keep it natural",
];

export const Route = createLazyFileRoute("/photo-edit")({ component: PhotoEditPage });

/** Compact photo uploader, matching the other tool pages. */
function PhotoUpload({
  userId,
  value,
  onChange,
}: {
  userId: string;
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
          <img src={value} alt="Your photo" className="size-full object-cover" />
        ) : busy ? (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        ) : (
          <ImagePlus className="size-5 text-muted-foreground group-hover:text-primary" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Your photo
        </div>
        <div className="text-sm text-foreground/80 truncate">
          {value ? "Photo uploaded — tap to replace" : "Tap to upload the photo to edit"}
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

function PhotoEditPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: authNextSearch() });
  }, [user, loading, navigate]);

  const editFn = useServerFn(editPhoto);

  const [photo, setPhoto] = useState<string | null>(null);
  const [instruction, setInstruction] = useState("");
  const [result, setResult] = useState<{ url: string; before: string } | null>(null);

  const mut = useMutation({
    mutationFn: async () => {
      if (!photo) throw new Error("Upload a photo first");
      if (instruction.trim().length < 2) throw new Error("Describe the edit first");
      return editFn({ data: { imageUrl: photo, editPrompt: instruction.trim() } });
    },
    onSuccess: (r) => {
      setResult({ url: r.url, before: photo! });
      toast.success("Edit is in.");
    },
    onError: (e) => handleGenerationError(e),
  });

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="aurora-page-shell text-foreground">
      <span aria-hidden className="aurora-ambient" />
      <header className="relative z-10 flex items-center justify-between pl-24 pr-6 md:pr-10 py-4 border-b border-border bg-background/80 backdrop-blur-xl">
        <Link to="/studio" className="flex items-center gap-2 font-semibold tracking-tight">
          <ArrowLeft className="size-4 text-muted-foreground" />
          <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20"><span className="inline-block size-2.5 rounded-full bg-primary" /></span>
          Photo Editor
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <Link to="/reshoot" className="text-muted-foreground hover:text-foreground">
            Reshoot
          </Link>
        </div>
      </header>

      <div className="relative z-10 mx-auto w-full max-w-2xl px-6 py-8 space-y-6">
        <section className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Brush className="size-5 text-primary" /> Edit one photo, change one thing
          </h1>
          <p className="text-sm text-muted-foreground">
            Upload a photo and describe the change. Aurora applies exactly that edit and keeps
            everything else — face, pose, framing — untouched. {COST} Aura per edit.
          </p>
        </section>

        <PhotoUpload userId={user.id} value={photo} onChange={(u) => { setPhoto(u); setResult(null); }} />

        <section className="space-y-3">
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="What should change? e.g. “remove the person in the background”"
            rows={3}
            maxLength={800}
            className="w-full rounded-xl border border-border bg-card/40 px-4 py-3 text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
          />
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_EDITS.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setInstruction(ex)}
                className="px-3 py-1.5 rounded-full border border-border bg-card/30 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
        </section>

        <Button
          variant="premium"
          size="lg"
          className="w-full"
          disabled={mut.isPending || !photo || instruction.trim().length < 2}
          onClick={() => mut.mutate()}
        >
          {mut.isPending ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" /> Editing your photo…
            </>
          ) : (
            <>
              <Sparkles className="size-4 mr-2" /> Apply edit · {COST} Aura
            </>
          )}
        </Button>

        {result && (
          <section className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <figure className="space-y-1.5">
                <figcaption className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Before
                </figcaption>
                <div className="rounded-2xl overflow-hidden border border-border bg-card/40">
                  <img src={result.before} alt="Before" className="w-full object-cover" />
                </div>
              </figure>
              <figure className="space-y-1.5">
                <figcaption className="text-[11px] font-medium uppercase tracking-wider text-primary">
                  After
                </figcaption>
                <div className="rounded-2xl overflow-hidden border border-primary/40 bg-card/40">
                  <img src={result.url} alt="After" className="w-full object-cover" />
                </div>
              </figure>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => saveAssetToDisk(result.url, "aurora-photo-edit.png")}
            >
              <Download className="size-4 mr-2" /> Save edited photo
            </Button>
          </section>
        )}
      </div>
    </main>
  );
}
