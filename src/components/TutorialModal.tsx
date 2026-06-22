import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { RECIPES } from "@/lib/tutorials";
import { Sparkles, ArrowRight, Zap, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";

const STORAGE_KEY = "aurora.tutorial.seen.v1";

export function TutorialModal({ trigger = 0 }: { trigger?: number }) {
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (trigger > 0) setOpen(true);
  }, [trigger]);


  const close = () => {
    setOpen(false);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, "1");
  };

  const recipe = RECIPES[idx];

  const runDemo = () => {
    close();
    if (typeof window !== "undefined") {
      localStorage.setItem("aurora.pendingRecipe", recipe.id);
    }
    navigate({ to: user ? "/studio" : "/auth" });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden border-border bg-card/95 backdrop-blur-xl">
        <button
          onClick={close}
          className="absolute top-4 right-4 z-20 size-8 rounded-full bg-background/80 backdrop-blur flex items-center justify-center hover:bg-background transition-colors"
          aria-label="Close tutorial"
        >
          <X className="size-4" />
        </button>

        <div className="grid md:grid-cols-2">
          {/* Visual */}
          <div className="relative aspect-square md:aspect-auto md:h-[560px] overflow-hidden bg-black">
            {recipe.video ? (
              <video
                key={recipe.video}
                src={recipe.video}
                poster={recipe.image}
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
                className="w-full h-full object-cover animate-fade-in"
              />
            ) : (
              <img
                key={recipe.image}
                src={recipe.image}
                alt={recipe.title}
                className="w-full h-full object-cover animate-fade-in"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/30" />
            <div className="absolute top-4 left-4 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-white/95 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur border border-white/15">
              <Sparkles className="size-3" /> {recipe.tag}
            </div>
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
              <div className="flex gap-1.5">
                {RECIPES.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setIdx(i)}
                    aria-label={`Recipe ${i + 1}`}
                    className={`h-1.5 rounded-full transition-all ${i === idx ? "w-8 bg-white" : "w-1.5 bg-white/40"}`}
                  />
                ))}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setIdx((i) => (i - 1 + RECIPES.length) % RECIPES.length)}
                  className="size-8 rounded-full bg-white/15 backdrop-blur flex items-center justify-center hover:bg-white/25 transition-colors"
                  aria-label="Previous"
                >
                  <ChevronLeft className="size-4 text-white" />
                </button>
                <button
                  onClick={() => setIdx((i) => (i + 1) % RECIPES.length)}
                  className="size-8 rounded-full bg-white/15 backdrop-blur flex items-center justify-center hover:bg-white/25 transition-colors"
                  aria-label="Next"
                >
                  <ChevronRight className="size-4 text-white" />
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-7 md:p-9 flex flex-col">
            <p className="text-xs uppercase tracking-[0.2em] text-primary mb-3">Recipe {idx + 1} of {RECIPES.length}</p>
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight leading-tight">
              {recipe.title}
            </h2>
            <p className="mt-3 text-muted-foreground text-sm md:text-base">{recipe.blurb}</p>

            <ol className="mt-5 space-y-2.5">
              {recipe.steps.map((s, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span
                    className="shrink-0 size-6 rounded-full flex items-center justify-center text-[11px] font-semibold text-primary-foreground"
                    style={{ background: "var(--gradient-hero)" }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-foreground/85 pt-0.5">{s}</span>
                </li>
              ))}
            </ol>

            <div className="mt-auto pt-6 space-y-2">
              <button
                onClick={runDemo}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full text-sm font-medium text-primary-foreground shadow-[var(--shadow-glow)] hover:scale-[1.02] transition-transform"
                style={{ background: "var(--gradient-hero)" }}
              >
                <Zap className="size-4" />
                Run this with our demo selfie
                <ArrowRight className="size-4" />
              </button>
              <button
                onClick={close}
                className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
              >
                Skip tour — I'll explore on my own
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
