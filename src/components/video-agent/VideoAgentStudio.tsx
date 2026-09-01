import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, BookOpen, Camera, Clapperboard, Copy, Film, Layers, Play, Sparkles, Wand2 } from "lucide-react";
import { useBoard } from "@/lib/board-store";
import { buildVideoAgentPlan, serializeProductionPlan, type VideoAgentContext } from "@/lib/video-agent-studio";

const PLATFORMS: VideoAgentContext["platform"][] = ["music-video", "youtube", "tiktok", "instagram", "commercial", "custom"];

export function VideoAgentStudio() {
  const { board, updateShot } = useBoard();
  const [context, setContext] = useState<VideoAgentContext>({
    title: "Aurora Production",
    brief: "",
    audience: "",
    platform: "music-video",
    aspectRatio: "16:9",
    visualStyle: "Cinematic, photoreal, intentional camera movement",
    references: [],
    mustKeep: [],
  });
  const [activeScene, setActiveScene] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const plan = useMemo(() => (board ? buildVideoAgentPlan(board, context) : null), [board, context]);
  const scenes = plan?.scenes ?? [];
  const selectedScene = scenes.find((scene) => scene.name === activeScene) ?? scenes[0];

  if (!board || !plan) {
    return <div className="min-h-screen bg-background p-8 text-muted-foreground">Loading production workspace…</div>;
  }

  const copyPlan = async () => {
    await navigator.clipboard.writeText(serializeProductionPlan(plan));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b bg-background/90 px-5 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/agent" className="rounded-lg border p-2 hover:bg-muted" aria-label="Back to Aurora Agent"><ArrowLeft className="h-4 w-4" /></Link>
            <div>
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground"><Sparkles className="h-3.5 w-3.5" /> Aurora Video Agent</div>
              <h1 className="text-xl font-semibold">Director Workspace</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/storyboard" className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted"><Clapperboard className="h-4 w-4" /> Storyboard</Link>
            <button onClick={copyPlan} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted"><Copy className="h-4 w-4" /> {copied ? "Copied" : "Export plan"}</button>
            <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"><Play className="h-4 w-4" /> Render production</button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] gap-5 p-5 lg:grid-cols-[300px_minmax(0,1fr)_340px]">
        <aside className="space-y-4">
          <section className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2 font-semibold"><BookOpen className="h-4 w-4" /> Context notebook</div>
            <label className="mb-3 block text-xs text-muted-foreground">Project title<input value={context.title} onChange={(e) => setContext({ ...context, title: e.target.value })} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" /></label>
            <label className="mb-3 block text-xs text-muted-foreground">Creative brief<textarea value={context.brief} onChange={(e) => setContext({ ...context, brief: e.target.value })} placeholder="What are we making? What must the viewer feel?" className="mt-1 min-h-28 w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm" /></label>
            <label className="mb-3 block text-xs text-muted-foreground">Audience<input value={context.audience} onChange={(e) => setContext({ ...context, audience: e.target.value })} placeholder="Fans, customers, filmmakers…" className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" /></label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-muted-foreground">Platform<select value={context.platform} onChange={(e) => setContext({ ...context, platform: e.target.value as VideoAgentContext["platform"] })} className="mt-1 w-full rounded-lg border bg-background px-2 py-2 text-sm">{PLATFORMS.map((p) => <option key={p}>{p}</option>)}</select></label>
              <label className="text-xs text-muted-foreground">Aspect<input value={context.aspectRatio} onChange={(e) => setContext({ ...context, aspectRatio: e.target.value })} className="mt-1 w-full rounded-lg border bg-background px-2 py-2 text-sm" /></label>
            </div>
            <label className="mt-3 block text-xs text-muted-foreground">Visual direction<textarea value={context.visualStyle} onChange={(e) => setContext({ ...context, visualStyle: e.target.value })} className="mt-1 min-h-20 w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm" /></label>
          </section>

          <section className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2 font-semibold"><Wand2 className="h-4 w-4" /> Production stack</div>
            <div className="space-y-2 text-sm">
              {["Context → Story", "Story → Scenes", "Scenes → Shots", "Shots → Angles + Looks", "Layers → Model Router", "Render → GPU workers"].map((item, i) => <div key={item} className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2"><span className="text-xs text-muted-foreground">0{i + 1}</span>{item}</div>)}
            </div>
          </section>
        </aside>

        <section className="min-w-0 space-y-4">
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Story / Plan</p><h2 className="mt-1 text-2xl font-semibold">{board.treatment || "Build the production treatment"}</h2></div><Film className="h-6 w-6 text-muted-foreground" /></div>
            <div className="flex gap-2 overflow-x-auto pb-1">{scenes.map((scene) => <button key={scene.name} onClick={() => setActiveScene(scene.name)} className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${selectedScene?.name === scene.name ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{scene.name} · {scene.shots.length}</button>)}</div>
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between"><div><p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Shot stack</p><h2 className="text-xl font-semibold">{selectedScene?.name ?? "No scene"}</h2></div><span className="text-sm text-muted-foreground">{selectedScene?.shots.length ?? 0} shots</span></div>
            <div className="space-y-3">{selectedScene?.shots.map((shot, index) => <article key={shot.id} className="rounded-xl border p-4 transition hover:border-primary/50">
              <div className="flex gap-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold">{String(index + 1).padStart(2, "0")}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-medium">{shot.title}</h3><span className="rounded-full bg-muted px-2 py-0.5 text-xs">{shot.model}</span><span className="rounded-full bg-muted px-2 py-0.5 text-xs">{shot.duration}s</span></div><p className="mt-2 text-sm text-muted-foreground">{shot.videoPrompt || shot.prompt || "Add a generation prompt to this shot."}</p><div className="mt-3 grid gap-2 text-xs sm:grid-cols-4"><span><b>Frame</b><br />{shot.frame || "Unset"}</span><span><b>Angle</b><br />{shot.angle || "Unset"}</span><span><b>Mood</b><br />{shot.mood || "Unset"}</span><span><b>Continuity</b><br />{shot.continuity}</span></div></div></div>
              <div className="mt-3 flex items-center gap-2 border-t pt-3"><button onClick={() => updateShot(shot.id, { videoPrompt: `${shot.videoPrompt || shot.prompt}. ${context.visualStyle}. ${shot.continuity}` })} className="rounded-lg border px-3 py-1.5 text-xs hover:bg-muted">Apply context</button><button onClick={() => updateShot(shot.id, { videoModel: shot.model === "seedance-2.5" ? "veo-3" : "seedance-2.5" })} className="rounded-lg border px-3 py-1.5 text-xs hover:bg-muted">Swap model</button></div>
            </article>)}</div>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-2 font-semibold"><Camera className="h-4 w-4" /> Director controls</div>
            <div className="space-y-3 text-sm"><div className="rounded-xl bg-muted/50 p-3"><div className="text-xs text-muted-foreground">Reference memory</div><div className="mt-1 font-medium">{context.references.length || "No external references"}</div></div><div className="rounded-xl bg-muted/50 p-3"><div className="text-xs text-muted-foreground">Continuity lock</div><div className="mt-1 font-medium">Identity · wardrobe · lighting</div></div><div className="rounded-xl bg-muted/50 p-3"><div className="text-xs text-muted-foreground">Output</div><div className="mt-1 font-medium">{context.aspectRatio} · {context.platform}</div></div></div>
          </section>
          <section className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-2 font-semibold"><Layers className="h-4 w-4" /> Model router</div>
            <div className="space-y-2">{plan.routes.map((route) => <div key={route.task} className="rounded-xl border p-3"><div className="flex items-center justify-between text-sm font-medium capitalize"><span>{route.task}</span><span className="text-xs text-muted-foreground">{route.preferred}</span></div><p className="mt-1 text-xs text-muted-foreground">{route.reason}</p><div className="mt-2 text-[11px] text-muted-foreground">Fallbacks: {route.fallbacks.join(" · ")}</div></div>)}</div>
          </section>
          <section className="rounded-2xl border bg-card p-4 shadow-sm"><div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Production state</div><div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full w-[18%] rounded-full bg-primary" /></div><div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>{board.shots.length} shots planned</span><span>Ready for render</span></div></section>
        </aside>
      </div>
    </main>
  );
}
