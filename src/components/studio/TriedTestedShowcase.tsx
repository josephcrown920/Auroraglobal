import { ArrowRight, CheckCircle2, Copy, Sparkles } from "lucide-react";
import { toast } from "sonner";

type Props = {
  badge?: string;
  title: string;
  subtitle: string;
  refsImage: string;
  refsCaption: string;
  finalImage: string;
  finalCaption: string;
  prompt?: string;
  accent?: "violet" | "cyan";
};

export function TriedTestedShowcase({
  badge = "Tried & Tested",
  title,
  subtitle,
  refsImage,
  refsCaption,
  finalImage,
  finalCaption,
  prompt,
  accent = "violet",
}: Props) {
  const ring = accent === "cyan" ? "border-cyan-300/40" : "border-violet-300/40";
  const chip = accent === "cyan" ? "bg-cyan-400/15 text-cyan-200 border-cyan-300/40" : "bg-violet-500/15 text-violet-200 border-violet-400/40";

  return (
    <section className={`relative rounded-3xl border ${ring} bg-card/40 backdrop-blur-sm overflow-hidden`}>
      <div className="px-5 md:px-7 pt-5 pb-3 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] uppercase tracking-widest ${chip}`}>
            <Sparkles className="size-3" /> {badge}
          </span>
          <h3 className="mt-2 text-lg md:text-xl font-semibold tracking-tight">{title}</h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        {prompt && (
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(prompt);
              toast.success("Prompt copied — paste into Direction");
            }}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border bg-background/60 hover:bg-accent"
          >
            <Copy className="size-3" /> Copy prompt
          </button>
        )}
      </div>

      <div className="px-5 md:px-7 pb-6 grid grid-cols-[1fr_auto_1fr] gap-3 md:gap-4 items-center">
        <figure className="rounded-2xl overflow-hidden border border-border bg-background/40">
          <img src={refsImage} alt="References" className="w-full aspect-[4/5] object-cover" />
          <figcaption className="px-3 py-2 text-[11px] text-muted-foreground border-t border-border">
            <span className="text-[10px] uppercase tracking-wider mr-1.5 text-foreground/70">Inputs</span>
            {refsCaption}
          </figcaption>
        </figure>

        <div className="flex flex-col items-center justify-center text-muted-foreground">
          <ArrowRight className="size-5 md:size-6" />
          <span className="hidden md:block mt-1 text-[10px] uppercase tracking-widest">Render</span>
        </div>

        <figure className={`rounded-2xl overflow-hidden border-2 ${accent === "cyan" ? "border-cyan-300/60 shadow-[0_0_50px_-10px_rgba(103,232,249,0.45)]" : "border-violet-400/60 shadow-[0_0_50px_-10px_rgba(167,139,250,0.45)]"} bg-black relative`}>
          <span className="absolute top-2 left-2 z-10 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-400/90 text-[10px] font-bold text-emerald-950">
            <CheckCircle2 className="size-3" /> RENDERED
          </span>
          <img src={finalImage} alt="Final render" className="w-full aspect-[4/5] object-cover" />
          <figcaption className="px-3 py-2 text-[11px] text-foreground/80 border-t border-white/10 bg-black/40">
            <span className="text-[10px] uppercase tracking-wider mr-1.5 text-emerald-300">Final</span>
            {finalCaption}
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
