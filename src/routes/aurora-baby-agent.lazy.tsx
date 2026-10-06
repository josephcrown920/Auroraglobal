import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { createLazyFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Clapperboard, Loader2, Play, Sparkles, Wand2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  analyzeAuroraBabyBrief,
  startAuroraBabyProduction,
} from "@/lib/aurora-baby-agent.functions";
import type { AuroraBabyPlan } from "@/lib/aurora-baby-agent";

export const Route = createLazyFileRoute("/aurora-baby-agent")({
  component: AuroraBabyAgent,
});

const EXAMPLES = [
  "Make a 30-second luxury music visual of an artist walking through a rain-soaked neon city. Keep the same person, outfit and lighting across every shot.",
  "Create a 45-second product film for a futuristic skincare bottle. Macro opening, hero reveal, human interaction, premium ending. 9:16 for Reels.",
  "Turn this idea into a cinematic short: a woman finds an old cassette in her apartment, presses play, and the room transforms into the memory on the tape.",
];

function AuroraBabyAgent() {
  const analyze = useServerFn(analyzeAuroraBabyBrief);
  const start = useServerFn(startAuroraBabyProduction);
  const [brief, setBrief] = useState("");
  const [duration, setDuration] = useState(30);
  const [aspect, setAspect] = useState<"16:9" | "9:16" | "1:1" | "4:5">("9:16");
  const [plan, setPlan] = useState<AuroraBabyPlan | null>(null);
  const [estimate, setEstimate] = useState<number | null>(null);
  const [busy, setBusy] = useState<"plan" | "generate" | null>(null);

  async function handlePlan() {
    if (brief.trim().length < 10) return toast.error("Give Aurora a little more direction.");
    setBusy("plan");
    try {
      const result = await analyze({ data: { brief, durationSeconds: duration, aspectRatio: aspect } });
      setPlan(result.plan);
      setEstimate(result.estimatedCredits);
      toast.success(`${result.plan.shots.length} shots planned`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Planning failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleGenerate() {
    if (!brief.trim()) return toast.error("Describe the production first.");
    setBusy("generate");
    try {
      const result = await start({
        data: {
          brief,
          durationSeconds: duration,
          aspectRatio: aspect,
          referenceUrls: [],
          resolution: "720p",
          autoGenerate: true,
        },
      });
      setPlan(result.plan);
      toast.success(`${result.jobs.length} shot jobs queued`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Generation could not be started");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              <Sparkles className="size-4" /> Aurora Baby Agent
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">Tell it what to make.</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              One individual agent owns the production: story, characters, camera, generation, continuity, revisions and delivery.
            </p>
          </div>
          <div className="hidden rounded-2xl border border-border/60 bg-card/50 px-4 py-3 text-right sm:block">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Production loop</div>
            <div className="mt-1 text-sm font-medium">Brief → Director → Shots → QA → Render</div>
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
          <div className="rounded-3xl border border-border/60 bg-card/40 p-5 shadow-sm sm:p-7">
            <label className="mb-3 block text-sm font-medium">Production brief</label>
            <Textarea
              value={brief}
              onChange={(event) => setBrief(event.target.value)}
              placeholder="Describe the video as if you were briefing a filmmaker…"
              className="min-h-52 resize-y rounded-2xl border-border/60 bg-background/60 text-sm leading-6"
              maxLength={8000}
            />

            <div className="mt-4 flex flex-wrap gap-2">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setBrief(example)}
                  className="rounded-full border border-border/60 bg-background/50 px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                >
                  Use example
                </button>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <label className="rounded-xl border border-border/60 bg-background/50 p-3 text-xs">
                <span className="text-muted-foreground">Duration</span>
                <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="mt-2 block w-full bg-transparent font-semibold outline-none">
                  <option value={15}>15 sec</option>
                  <option value={30}>30 sec</option>
                  <option value={60}>60 sec</option>
                  <option value={90}>90 sec</option>
                </select>
              </label>
              <label className="rounded-xl border border-border/60 bg-background/50 p-3 text-xs">
                <span className="text-muted-foreground">Format</span>
                <select value={aspect} onChange={(e) => setAspect(e.target.value as typeof aspect)} className="mt-2 block w-full bg-transparent font-semibold outline-none">
                  <option value="9:16">9:16 Vertical</option>
                  <option value="16:9">16:9 Landscape</option>
                  <option value="1:1">1:1 Square</option>
                  <option value="4:5">4:5 Feed</option>
                </select>
              </label>
              <div className="col-span-2 flex items-end gap-2 sm:col-span-1 sm:flex-col sm:items-stretch">
                <Button type="button" variant="outline" onClick={() => void handlePlan()} disabled={busy !== null} className="flex-1 sm:flex-none">
                  {busy === "plan" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Wand2 className="mr-2 size-4" />}
                  Plan it
                </Button>
                <Button type="button" onClick={() => void handleGenerate()} disabled={busy !== null} className="flex-1 sm:flex-none">
                  {busy === "generate" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Play className="mr-2 size-4" />}
                  Generate
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-border/60 bg-card/30 p-5 sm:p-7">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Director board</div>
                <h2 className="mt-1 text-xl font-semibold">{plan?.brief.title ?? "Waiting for your brief"}</h2>
              </div>
              {estimate !== null && <div className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold">~{estimate} credits</div>}
            </div>

            {!plan ? (
              <div className="mt-8 rounded-2xl border border-dashed border-border/60 p-8 text-center">
                <Clapperboard className="mx-auto size-8 text-muted-foreground/50" />
                <p className="mt-3 text-sm text-muted-foreground">Aurora will turn the brief into a structured production plan here.</p>
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <Metric label="Intent" value={plan.brief.intent} />
                  <Metric label="Audience" value={plan.brief.audience} />
                  <Metric label="Format" value={plan.brief.aspectRatio} />
                  <Metric label="Shots" value={String(plan.shots.length)} />
                </div>
                <div className="max-h-[30rem] space-y-2 overflow-auto pr-1">
                  {plan.shots.map((shot, index) => (
                    <article key={shot.id} className="rounded-2xl border border-border/50 bg-background/50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-widest text-primary">Scene {shot.scene} · Shot {index + 1}</div>
                          <div className="mt-1 text-sm font-medium">{shot.purpose} · {shot.framing} · {shot.lensMm}mm</div>
                        </div>
                        <span className="text-xs text-muted-foreground">{shot.durationSeconds}s</span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">{shot.behavior}</p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {shot.referenceRoles.map((role) => <span key={role} className="rounded-full bg-muted px-2 py-1 text-[10px]">{role}</span>)}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-border/50 bg-background/40 p-3"><div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div><div className="mt-1 truncate text-xs font-semibold">{value}</div></div>;
}
