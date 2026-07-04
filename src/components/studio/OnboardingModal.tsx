import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Camera, Wand2, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { triggerLifecycleEmail } from "@/lib/emails.functions";

const STORAGE_KEY = "aurora.onboarding.done.v1";

export type VibeChoice = {
  id: string;
  name: string;
  tag: string;
  gradient: string;
  prompt: string;
};

const VIBES: VibeChoice[] = [
  {
    id: "editorial",
    name: "Editorial Cover",
    tag: "Magazine · Studio",
    gradient: "from-rose-500/60 via-amber-500/40 to-yellow-500/20",
    prompt:
      "High-fashion editorial cover shot of the subject, studio lighting with violet rim light, seamless paper backdrop, confident pose, magazine quality, medium format camera look",
  },
  {
    id: "neon",
    name: "Neon Street",
    tag: "Night · Cinematic",
    gradient: "from-cyan-500/60 via-blue-500/40 to-indigo-500/20",
    prompt:
      "Cinematic night street performance, neon purple and pink reflections, rain-soaked pavement, motion blur background, professional cinematic still",
  },
  {
    id: "cyclo",
    name: "Color Cyclorama",
    tag: "Performance · Hot pink",
    gradient: "from-pink-500/60 via-rose-500/40 to-fuchsia-500/20",
    prompt:
      "Place the subject into a minimalist studio performance scene. Full-body side profile pose. Use an exact suspended vintage studio microphone hanging from ceiling at chest level. Environment is a seamless hot pink cyclorama — background and floor one continuous color. Soft glossy lighting. Preserve exact facial likeness, hairstyle, body proportions. Ultra-realistic, hyper-real 8K ultra-HD.",
  },
];

type Props = {
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (args: { selfieUrl: string; prompt: string; vibeName: string }) => void;
};

export function OnboardingModal({ userId, open, onOpenChange, onApply }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [vibe, setVibe] = useState<VibeChoice>(VIBES[0]);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setStep(1);
  }, [open]);

  const upload = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Max 20MB");
      return;
    }
    setUploading(true);
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
      setSelfieUrl(signed.signedUrl);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const sendEmail = useServerFn(triggerLifecycleEmail);
  const finish = () => {
    if (!selfieUrl) return;
    onApply({ selfieUrl, prompt: vibe.prompt, vibeName: vibe.name });
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* ignore */ }
    // Fire-and-forget lifecycle emails (deduped server-side)
    void sendEmail({ data: { template: "signup_welcome" } }).catch(() => {});
    void sendEmail({ data: { template: "onboarding_done" } }).catch(() => {});
    onOpenChange(false);
    toast.success(`Studio loaded with ${vibe.name}. Hit Generate.`, { duration: 5000 });
  };

  const skip = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "skipped");
    } catch {
      /* ignore */
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : skip())}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Sparkles className="size-5 text-primary" />
            Your first render in under 60s
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? "Pick a vibe. We'll pre-load the prompt so you skip the blank page."
              : "Drop a selfie. We use it as the identity reference for your first render."}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="grid grid-cols-2 gap-3 py-2">
            {VIBES.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setVibe(v)}
                className={cn(
                  "group relative aspect-[4/3] overflow-hidden rounded-xl border-2 text-left transition-all",
                  vibe.id === v.id
                    ? "border-primary ring-2 ring-primary/30"
                    : "border-border hover:border-primary/50",
                )}
              >
                <div className={cn("absolute inset-0 bg-gradient-to-br", v.gradient)} />
                <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/20 to-transparent" />
                {vibe.id === v.id && (
                  <div className="absolute right-2 top-2 rounded-full bg-primary p-1 text-primary-foreground">
                    <Check className="size-3" />
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <div className="text-sm font-semibold">{v.name}</div>
                  <div className="text-xs text-muted-foreground">{v.tag}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="py-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
              }}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className={cn(
                "group relative mx-auto flex aspect-square w-full max-w-xs items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition-all",
                selfieUrl
                  ? "border-primary/40"
                  : "border-border bg-card/60 hover:border-primary/50 hover:bg-card",
              )}
            >
              {selfieUrl ? (
                <img src={selfieUrl} alt="Selfie" className="size-full object-cover" />
              ) : uploading ? (
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Camera className="size-8" />
                  <span className="text-sm font-medium">Tap to upload selfie</span>
                  <span className="text-xs">Front-facing, clear lighting works best</span>
                </div>
              )}
            </button>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-2">
          <Button variant="ghost" onClick={skip} className="text-muted-foreground">
            Skip for now
          </Button>
          {step === 1 ? (
            <Button onClick={() => setStep(2)} className="gap-2">
              Continue <Wand2 className="size-4" />
            </Button>
          ) : (
            <Button onClick={finish} disabled={!selfieUrl} className="gap-2">
              Load into Studio <Sparkles className="size-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function shouldShowOnboarding(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return !localStorage.getItem(STORAGE_KEY);
  } catch {
    return false;
  }
}
