import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  refineAuroraPlan,
  listAgentSessions,
  getAgentSession,
  deleteAgentSession,
  renderAgentShot,
  type AgentPlan,
  type PlanIteration,
} from "@/lib/agent.functions";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sparkles,
  Send,
  Loader2,
  Film,
  Palette,
  Lightbulb,
  Wand2,
  ImageIcon,
  Plus,
  Trash2,
  History,
  ArrowLeft,
  Check,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";

export const Route = createFileRoute("/agent")({ component: AgentPage });

type RenderStatus = "idle" | "rendering" | "succeeded" | "failed";
type RenderState = { status: RenderStatus; url?: string | null };

const SAMPLES = [
  "A man and a chimpanzee rob a bank in the Albuquerque desert. Red Ferrari Testarossa. Hard midday sun, 16mm film look.",
  "Music video for a moody R&B track. Rainy Tokyo rooftop, neon reflections, single performer, slow dolly.",
  "UGC ad for a cold brew brand. Sunlit kitchen, hand pours coffee, condensation on glass, golden hour.",
];

function scoreColor(score: number): string {
  if (score >= 85) return "text-emerald-300";
  if (score >= 60) return "text-amber-300";
  return "text-rose-300";
}
function scoreBar(score: number): string {
  if (score >= 85) return "bg-emerald-400";
  if (score >= 60) return "bg-amber-400";
  return "bg-rose-400";
}

function AgentPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const refineFn = useServerFn(refineAuroraPlan);
  const listFn = useServerFn(listAgentSessions);
  const getFn = useServerFn(getAgentSession);
  const delFn = useServerFn(deleteAgentSession);
  const renderFn = useServerFn(renderAgentShot);

  const [brief, setBrief] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [plan, setPlan] = useState<AgentPlan | null>(null);
  const [iterations, setIterations] = useState<PlanIteration[]>([]);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [stopReason, setStopReason] = useState<string | null>(null);
  const [renders, setRenders] = useState<Record<string, RenderState>>({});
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  const sessionsQuery = useQuery({
    queryKey: ["agent-sessions"],
    queryFn: () => listFn(),
    enabled: !!user,
  });

  const startNew = () => {
    setSessionId(null);
    setPlan(null);
    setIterations([]);
    setFinalScore(null);
    setStopReason(null);
    setRenders({});
    setBrief("");
  };

  const refineMut = useMutation({
    mutationFn: (input: { brief: string; sessionId?: string }) =>
      refineFn({ data: { brief: input.brief, sessionId: input.sessionId } }),
    onSuccess: (r) => {
      setSessionId(r.sessionId);
      setPlan(r.plan);
      setIterations(r.iterations);
      setFinalScore(r.finalScore);
      setStopReason(r.stopReason);
      setRenders({});
      qc.invalidateQueries({ queryKey: ["agent-sessions"] });
      toast.success(`Plan ready — ${r.plan.shots.length} shots · scored ${r.finalScore}/100`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const loadMut = useMutation({
    mutationFn: (id: string) => getFn({ data: { sessionId: id } }),
    onSuccess: (r) => {
      setSessionId(r.session.id);
      setBrief(r.session.brief);
      setPlan(r.session.plan);
      setIterations(r.session.iterations);
      setFinalScore(r.session.iterations.at(-1)?.critique.score ?? null);
      setStopReason(null);
      const rmap: Record<string, RenderState> = {};
      for (const [sid, v] of Object.entries(r.renders)) {
        rmap[sid] = { status: v.status === "succeeded" ? "succeeded" : "rendering", url: v.url };
      }
      setRenders(rmap);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { sessionId: id } }),
    onSuccess: (_r, id) => {
      qc.invalidateQueries({ queryKey: ["agent-sessions"] });
      if (id === sessionId) startNew();
      toast.success("Session deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const renderShot = async (shotId: string) => {
    if (!sessionId) {
      toast.error("Save a plan before rendering");
      return;
    }
    setRenders((m) => ({ ...m, [shotId]: { status: "rendering" } }));
    try {
      const r = await renderFn({ data: { sessionId, shotId } });
      setRenders((m) => ({ ...m, [shotId]: { status: "succeeded", url: r.url } }));
      toast.success(`Shot ${shotId} rendered`);
    } catch (e) {
      setRenders((m) => ({ ...m, [shotId]: { status: "failed" } }));
      toast.error(e instanceof Error ? e.message : "Render failed");
    }
  };

  const submitBrief = () => {
    const text = brief.trim();
    if (text.length < 4) return;
    refineMut.mutate({ brief: text, sessionId: sessionId ?? undefined });
  };

  if (loading || !user) {
    return (
      <div className="aurora-page-shell grid place-items-center text-muted-foreground">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  const busy = refineMut.isPending;
  const sessions = sessionsQuery.data ?? [];

  return (
    <div className="aurora-page-shell text-foreground flex flex-col">
      <span aria-hidden className="aurora-ambient" />
      <header className="relative z-20 px-4 sm:px-6 py-3 border-b border-border flex items-center justify-between sticky top-0 bg-background/80 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <Link to="/" className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/40 no-underline">
            <ArrowLeft className="size-4" />
          </Link>
          <span className="size-8 rounded-xl flex items-center justify-center bg-[image:var(--gradient-hero)] shadow-[var(--shadow-glow-soft)]">
            <Sparkles className="size-4 text-white" />
          </span>
          <div>
            <p className="text-sm font-semibold">Aurora Agent</p>
            <p className="text-[10px] text-muted-foreground">Director → Critic refinement studio</p>
          </div>
        </div>
        <Button onClick={startNew} variant="glass" size="sm">
          <Plus className="size-3.5 mr-1" /> New session
        </Button>
      </header>

      <div className="relative z-10 flex-1 flex min-h-0">
        {/* Sidebar: resumable sessions */}
        <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-white/10 bg-white/[0.02]">
          <div className="px-3 py-2.5 border-b border-white/5 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/40">
            <History className="size-3" /> Saved sessions
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {sessionsQuery.isLoading && (
              <div className="flex justify-center py-6 text-white/40">
                <Loader2 className="size-4 animate-spin" />
              </div>
            )}
            {!sessionsQuery.isLoading && sessions.length === 0 && (
              <p className="text-[11px] text-white/35 px-2 py-4 text-center leading-relaxed">
                No saved sessions yet. Direct a story to create one.
              </p>
            )}
            {sessions.map((s) => (
              <div
                key={s.id}
                className={`group rounded-lg border px-2.5 py-2 cursor-pointer transition-colors ${
                  s.id === sessionId
                    ? "border-violet-400/40 bg-violet-500/10"
                    : "border-white/10 bg-white/[0.02] hover:bg-white/5"
                }`}
                onClick={() => loadMut.mutate(s.id)}
              >
                <div className="flex items-start justify-between gap-1.5">
                  <p className="text-xs font-medium text-white/90 truncate leading-tight">
                    {s.title || "Untitled plan"}
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteMut.mutate(s.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-white/40 hover:text-rose-300 shrink-0"
                    aria-label="Delete session"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                <p className="text-[10px] text-white/40 truncate mt-0.5">{s.brief}</p>
              </div>
            ))}
          </div>
        </aside>

        {/* Main column */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
            {/* Brief composer */}
            <section className="aurora-panel p-4 space-y-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-violet-300/80">
                <Wand2 className="size-3" /> {sessionId ? "Refine this brief" : "Your brief"}
              </div>
              <Textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="One paragraph: characters, location, vibe, era. e.g. a man and a chimp rob a bank in the desert…"
                rows={3}
                className="bg-black/30 border-white/10 text-white text-sm resize-none"
              />
              {!plan && !busy && (
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wider text-white/40">Try a prompt</p>
                  {SAMPLES.map((s) => (
                    <button
                      key={s}
                      onClick={() => setBrief(s)}
                      className="w-full text-left text-xs p-2.5 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/5 hover:border-violet-400/30 text-white/75"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              <Button
                onClick={submitBrief}
                disabled={busy || brief.trim().length < 4}
                variant="premium"
                className="w-full"
              >
                {busy ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Send className="size-4 mr-1" />}
                {busy ? "Director & critic at work…" : plan ? "Re-direct with critic loop" : "Direct my story"}
              </Button>
              <p className="text-[10px] text-white/40 text-center leading-relaxed">
                A director drafts the plan, a critic scores it 0–100, and the director revises until it&apos;s shippable.
              </p>
            </section>

            {busy && (
              <div className="flex flex-col items-center justify-center py-10 gap-3 text-white/70">
                <Loader2 className="size-6 animate-spin text-violet-300" />
                <p className="text-sm">Running the director ↔ critic loop…</p>
                <p className="text-[10px] text-white/40">propose · critique · refine · re-score</p>
              </div>
            )}

            {plan && !busy && (
              <div className="space-y-6 animate-fade-in">
                {/* Score + concept */}
                <section className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-violet-300/80">Concept</p>
                      <h2 className="text-xl font-semibold leading-tight truncate">{plan.title}</h2>
                      <p className="text-xs text-white/60 mt-1 italic">&ldquo;{plan.logline}&rdquo;</p>
                    </div>
                    {finalScore !== null && (
                      <div className="text-right shrink-0">
                        <p className={`text-2xl font-bold ${scoreColor(finalScore)}`}>{finalScore}</p>
                        <p className="text-[9px] uppercase tracking-wider text-white/40">critic score</p>
                      </div>
                    )}
                  </div>
                  {stopReason && (
                    <p className="text-[10px] text-white/45">
                      Stopped after {iterations.length} iteration{iterations.length === 1 ? "" : "s"} ·{" "}
                      {stopReason === "threshold"
                        ? "met quality bar"
                        : stopReason === "converged"
                          ? "improvements plateaued"
                          : "reached max iterations"}
                    </p>
                  )}
                </section>

                {/* Iteration history */}
                {iterations.length > 0 && (
                  <section className="aurora-glass rounded-2xl overflow-hidden">
                    <button
                      onClick={() => setHistoryOpen((o) => !o)}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.03]"
                    >
                      <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/50">
                        <History className="size-3" /> Refinement history · {iterations.length}
                      </span>
                      <ChevronDown className={`size-4 text-white/40 transition-transform ${historyOpen ? "rotate-180" : ""}`} />
                    </button>
                    {historyOpen && (
                      <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
                        {iterations.map((it: PlanIteration) => (
                          <div key={it.n} className="rounded-xl border border-white/10 bg-black/20 p-3">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono text-white/50">Round {it.n}</span>
                              <span className={`text-sm font-semibold ${scoreColor(it.critique.score)}`}>
                                {it.critique.score}/100
                              </span>
                              <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                                <div
                                  className={`h-full ${scoreBar(it.critique.score)}`}
                                  style={{ width: `${it.critique.score}%` }}
                                />
                              </div>
                            </div>
                            <p className="text-xs text-white/70 mt-2">{it.critique.verdict}</p>
                            {it.critique.issues.length > 0 ? (
                              <ul className="mt-2 space-y-1.5">
                                {it.critique.issues.map((iss, i) => (
                                  <li key={i} className="text-[11px] text-white/65 leading-relaxed">
                                    <span className="font-mono text-amber-300/80">[{iss.target}]</span> {iss.problem}{" "}
                                    <span className="text-emerald-300/70">→ {iss.fix}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="mt-2 text-[11px] text-emerald-300/80 inline-flex items-center gap-1">
                                <Check className="size-3" /> No blocking issues — shippable
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                )}

                {/* Direction */}
                <section className="aurora-glass rounded-xl p-3">
                  <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1 inline-flex items-center gap-1">
                    <Lightbulb className="size-3" /> Direction
                  </p>
                  <p className="text-sm text-white/80 leading-relaxed">{plan.direction}</p>
                </section>

                {/* Palette */}
                <section>
                  <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2 inline-flex items-center gap-1">
                    <Palette className="size-3" /> Color story
                  </p>
                  <div className="flex gap-2">
                    {plan.palette.map((c) => (
                      <div key={c} className="flex-1">
                        <div className="aspect-square rounded-lg border border-white/10" style={{ background: c }} />
                        <p className="text-[9px] text-white/50 mt-1 text-center font-mono">{c}</p>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Shots with per-shot render */}
                <section>
                  <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2 inline-flex items-center gap-1">
                    <Film className="size-3" /> Shot list · {plan.shots.length}
                  </p>
                  <div className="space-y-2">
                    {plan.shots.map((s) => {
                      const rs = renders[s.id] ?? { status: "idle" as RenderStatus };
                      return (
                        <div key={s.id} className="aurora-glass rounded-xl overflow-hidden">
                          <div className="flex gap-3 p-3">
                            <div className="size-20 shrink-0 rounded-lg border border-white/10 bg-black/40 overflow-hidden grid place-items-center">
                              {rs.status === "succeeded" && rs.url ? (
                                <img src={rs.url} alt={s.title} className="size-full object-cover" />
                              ) : rs.status === "rendering" ? (
                                <Loader2 className="size-5 animate-spin text-violet-300" />
                              ) : rs.status === "failed" ? (
                                <AlertTriangle className="size-5 text-rose-300" />
                              ) : (
                                <ImageIcon className="size-5 text-white/25" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono text-violet-300">{s.id}</span>
                                <p className="text-sm font-medium leading-tight truncate">{s.title}</p>
                              </div>
                              <p className="text-[10px] text-white/50 mt-0.5">
                                {s.shotType} · {s.camera}
                              </p>
                              <p className="text-xs text-white/70 mt-1 line-clamp-2">{s.action}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <Button
                                  onClick={() => renderShot(s.id)}
                                  disabled={rs.status === "rendering"}
                                  size="sm"
                                  variant="outline"
                                  className="h-7 border-white/15 bg-white/5 text-white hover:bg-white/10 text-[11px]"
                                >
                                  {rs.status === "rendering" ? (
                                    <Loader2 className="size-3 mr-1 animate-spin" />
                                  ) : (
                                    <ImageIcon className="size-3 mr-1" />
                                  )}
                                  {rs.status === "succeeded" ? "Re-render" : rs.status === "rendering" ? "Rendering…" : "Render"}
                                </Button>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(s.prompt);
                                    toast.success("Prompt copied");
                                  }}
                                  className="text-[10px] text-violet-300 hover:text-violet-200 inline-flex items-center gap-1"
                                >
                                  <Wand2 className="size-3" /> Copy prompt
                                </button>
                                {rs.status === "failed" && (
                                  <span className="text-[10px] text-rose-300 inline-flex items-center gap-1">
                                    <AlertTriangle className="size-3" /> failed
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <details className="group border-t border-white/5">
                            <summary className="cursor-pointer px-3 py-2 text-[10px] uppercase tracking-wider text-white/40 hover:bg-white/[0.03]">
                              Prompt
                            </summary>
                            <p className="px-3 pb-3 text-[11px] text-white/85 leading-relaxed font-mono">{s.prompt}</p>
                          </details>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Suggestions */}
                <section className="aurora-glass rounded-xl border-primary/25 bg-primary/5 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-violet-300/80 mb-1.5">Next moves</p>
                  <ul className="text-xs text-white/75 space-y-1 list-disc list-inside">
                    {plan.suggestions.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </section>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
