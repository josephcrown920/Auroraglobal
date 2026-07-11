import { useEffect, useRef, useState } from "react";
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
  renderAgentShotVideo,
  type AgentPlan,
  type PlanIteration,
} from "@/lib/agent.functions";
import {
  listAuroraTemplates,
  createAuroraTemplate,
  deleteAuroraTemplate,
  generateAuroraTemplateVideo,
  AURORA_TEMPLATE_MODEL,
  type AuroraTemplateRow,
} from "@/lib/aurora-templates.functions";
import { computeCost } from "@/lib/pricing";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Sparkles,
  Send,
  Loader2,
  Film,
  Palette,
  Lightbulb,
  Wand2,
  Image as ImageIcon,
  Plus,
  Trash2,
  History,
  ArrowLeft,
  Check,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Upload,
  User,
  Copy,
  CheckCircle2,
  Bot,
  Play,
} from "lucide-react";

export const Route = createFileRoute("/agent")({
  component: AgentPage,
  head: () => ({
    meta: [
      { title: "AI Creative Agent — Aurora" },
      { name: "description", content: "Describe the shot you want in plain language — Aurora's agent plans it and renders it for you." },
      { property: "og:title", content: "AI Creative Agent — Aurora" },
      { property: "og:description", content: "Chat with Aurora's planning agent to iterate on and render creative shots." },
    ],
    links: [{ rel: "canonical", href: "https://aurorastudiostar.lovable.app/agent" }],
  }),
});

type RenderStatus = "idle" | "rendering" | "succeeded" | "failed";
type RenderState = { status: RenderStatus; url?: string | null };
type VideoStatus = "idle" | "rendering" | "succeeded" | "failed";
type VideoState = { status: VideoStatus; url?: string | null; error?: string };

type AgentMode = "agent" | "templates" | "recipes";

const TEMPLATE_COST = computeCost({ features: ["video"], model: AURORA_TEMPLATE_MODEL }).total;

function extractTemplateId(raw: string): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const parts = url.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("templates");
    if (idx !== -1 && parts[idx + 1]) return parts[idx + 1];
  } catch {
    // not a URL — treat as bare ID
  }
  const trimmed = raw.trim();
  return trimmed.length > 4 ? trimmed : null;
}

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
  const animateFn = useServerFn(renderAgentShotVideo);
  const listTplFn = useServerFn(listAuroraTemplates);
  const createTplFn = useServerFn(createAuroraTemplate);
  const deleteTplFn = useServerFn(deleteAuroraTemplate);
  const generateTplFn = useServerFn(generateAuroraTemplateVideo);

  const [mode, setMode] = useState<AgentMode>("agent");

  // ── Agent state ──────────────────────────────────────────────────────────
  const [brief, setBrief] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [plan, setPlan] = useState<AgentPlan | null>(null);
  const [iterations, setIterations] = useState<PlanIteration[]>([]);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [stopReason, setStopReason] = useState<string | null>(null);
  const [renders, setRenders] = useState<Record<string, RenderState>>({});
  const [videos, setVideos] = useState<Record<string, VideoState>>({});
  const [historyOpen, setHistoryOpen] = useState(false);

  // ── Template state ───────────────────────────────────────────────────────
  const [tplFormOpen, setTplFormOpen] = useState(false);
  const [tplName, setTplName] = useState("");
  const [tplRawId, setTplRawId] = useState("");
  const [tplCharKey, setTplCharKey] = useState("character");
  // per-template generate form open state
  const [genOpen, setGenOpen] = useState<Record<string, boolean>>({});
  // per-template generate inputs
  const [genPhotoUrl, setGenPhotoUrl] = useState<Record<string, string>>({});
  const [genAvatarId, setGenAvatarId] = useState<Record<string, string>>({});
  const [genMode, setGenMode] = useState<Record<string, "photo" | "avatar">>({});
  // per-template result
  const [tplResult, setTplResult] = useState<Record<string, { status: "rendering" | "done" | "failed"; url?: string }>>({});

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  const sessionsQuery = useQuery({
    queryKey: ["agent-sessions"],
    queryFn: () => listFn(),
    enabled: !!user,
  });

  const templatesQuery = useQuery({
    queryKey: ["aurora-templates"],
    queryFn: () => listTplFn(),
    enabled: !!user,
  });

  const saveTplMut = useMutation({
    mutationFn: async () => {
      if (!tplName.trim()) throw new Error("Give this template a name");
      const tid = extractTemplateId(tplRawId.trim());
      if (!tid) throw new Error("Paste a HeyGen template ID or URL");
      if (!tplCharKey.trim()) throw new Error("Enter the character variable key");
      return createTplFn({
        data: {
          name: tplName.trim(),
          heygenTemplateId: tid,
          fixedVariables: {
            [tplCharKey.trim()]: {
              name: tplCharKey.trim(),
              type: "character",
              properties: { url: "", talking_photo_id: "" },
            },
          },
          characterVariableKey: tplCharKey.trim(),
        },
      });
    },
    onSuccess: () => {
      setTplName(""); setTplRawId(""); setTplCharKey("character"); setTplFormOpen(false);
      qc.invalidateQueries({ queryKey: ["aurora-templates"] });
      toast.success("Template saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteTplMut = useMutation({
    mutationFn: (id: string) => deleteTplFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["aurora-templates"] });
      toast.success("Template deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const generateTplMut = useMutation({
    mutationFn: async ({ tpl, gMode }: { tpl: AuroraTemplateRow; gMode: "photo" | "avatar" }) => {
      const photo = genPhotoUrl[tpl.id]?.trim();
      const avatar = genAvatarId[tpl.id]?.trim();
      if (gMode === "photo" && !photo) throw new Error("Enter a photo URL");
      if (gMode === "avatar" && !avatar) throw new Error("Enter an avatar ID");
      setTplResult((r) => ({ ...r, [tpl.id]: { status: "rendering" } }));
      return generateTplFn({
        data: {
          auroraTemplateId: tpl.id,
          character: {
            name: tpl.character_variable_key,
            type: "character" as const,
            properties: {
              type: gMode === "photo" ? "talking_photo" : "avatar",
              character_id: gMode === "photo" ? photo! : avatar!,
            },
          },
        },
      });
    },
    onSuccess: (r, { tpl }) => {
      setTplResult((prev) => ({ ...prev, [tpl.id]: { status: "done", url: r.ok ? r.url : undefined } }));
      toast.success("Video ready!");
    },
    onError: (e: Error, { tpl }) => {
      setTplResult((prev) => ({ ...prev, [tpl.id]: { status: "failed" } }));
      toast.error(e.message);
    },
  });

  const startNew = () => {
    setSessionId(null);
    setPlan(null);
    setIterations([]);
    setFinalScore(null);
    setStopReason(null);
    setRenders({});
    setVideos({});
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
      setVideos({});
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
      setVideos({});
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
      // A fresh still invalidates any previously animated clip for this shot.
      setVideos((m) => ({ ...m, [shotId]: { status: "idle" } }));
      toast.success(`Shot ${shotId} rendered`);
    } catch (e) {
      setRenders((m) => ({ ...m, [shotId]: { status: "failed" } }));
      toast.error(e instanceof Error ? e.message : "Render failed");
    }
  };

  const animateShot = async (shotId: string) => {
    if (!sessionId) {
      toast.error("Save a plan before animating");
      return;
    }
    setVideos((m) => ({ ...m, [shotId]: { status: "rendering" } }));
    try {
      const r = await animateFn({ data: { sessionId, shotId } });
      setVideos((m) => ({ ...m, [shotId]: { status: "succeeded", url: r.url } }));
      toast.success(`Shot ${shotId} animated`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Animate failed";
      setVideos((m) => ({ ...m, [shotId]: { status: "failed", error: message } }));
      toast.error(message);
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

      {/* Mode tab bar */}
      <div className="relative z-20 flex border-b border-white/10 bg-background/60 backdrop-blur-sm shrink-0">
        <button
          onClick={() => setMode("agent")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
            mode === "agent"
              ? "border-violet-400 text-violet-300"
              : "border-transparent text-white/45 hover:text-white/70"
          }`}
        >
          <Bot className="size-3.5" /> Story Agent
        </button>
        <button
          onClick={() => setMode("templates")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
            mode === "templates"
              ? "border-violet-400 text-violet-300"
              : "border-transparent text-white/45 hover:text-white/70"
          }`}
        >
          <Film className="size-3.5" /> HeyGen Templates
        </button>
        <button
          onClick={() => setMode("recipes")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
            mode === "recipes"
              ? "border-violet-400 text-violet-300"
              : "border-transparent text-white/45 hover:text-white/70"
          }`}
        >
          <Sparkles className="size-3.5" /> Showcase
        </button>
      </div>

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

          {/* ── HeyGen Templates panel ─────────────────────────────────── */}
          {mode === "templates" && (
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">

              {/* Save form */}
              <section className="aurora-panel p-4 space-y-3">
                <button
                  onClick={() => setTplFormOpen((o) => !o)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-violet-300/80">
                    <Plus className="size-3" /> Add HeyGen template
                  </span>
                  {tplFormOpen ? <ChevronUp className="size-4 text-white/40" /> : <ChevronDown className="size-4 text-white/40" />}
                </button>

                {tplFormOpen && (
                  <div className="space-y-2.5 pt-1">
                    <div className="space-y-1">
                      <label className="text-[10px] text-white/50">Template name</label>
                      <Input
                        value={tplName}
                        onChange={(e) => setTplName(e.target.value)}
                        placeholder="e.g. Sales hook v1"
                        className="bg-black/30 border-white/10 text-white text-sm h-8"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-white/50">HeyGen template ID or URL</label>
                      <Input
                        value={tplRawId}
                        onChange={(e) => setTplRawId(e.target.value)}
                        placeholder="Paste template ID or app.heygen.com/… URL"
                        className="bg-black/30 border-white/10 text-white text-sm h-8 font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-white/50">Character variable key</label>
                      <Input
                        value={tplCharKey}
                        onChange={(e) => setTplCharKey(e.target.value)}
                        placeholder="character"
                        className="bg-black/30 border-white/10 text-white text-sm h-8 font-mono"
                      />
                      <p className="text-[10px] text-white/35 leading-relaxed">
                        The variable name you assigned to the avatar slot in HeyGen Template Editor.
                      </p>
                    </div>
                    <Button
                      onClick={() => saveTplMut.mutate()}
                      disabled={saveTplMut.isPending}
                      variant="premium"
                      className="w-full"
                    >
                      {saveTplMut.isPending ? <Loader2 className="size-4 mr-1 animate-spin" /> : <CheckCircle2 className="size-4 mr-1" />}
                      Save template
                    </Button>
                  </div>
                )}
              </section>

              {/* Template list */}
              {templatesQuery.isLoading && (
                <div className="flex justify-center py-10 text-white/40">
                  <Loader2 className="size-5 animate-spin" />
                </div>
              )}

              {!templatesQuery.isLoading && (templatesQuery.data ?? []).length === 0 && !tplFormOpen && (
                <div className="text-center py-10 text-white/40 text-sm space-y-2">
                  <Film className="size-8 mx-auto opacity-30" />
                  <p>No templates yet.</p>
                  <p className="text-[11px]">Click "Add HeyGen template" above to save one.</p>
                </div>
              )}

              {(templatesQuery.data ?? []).map((tpl) => {
                const open = genOpen[tpl.id] ?? false;
                const gm = genMode[tpl.id] ?? "photo";
                const res = tplResult[tpl.id];
                return (
                  <div key={tpl.id} className="aurora-glass rounded-2xl overflow-hidden">
                    {/* Header row */}
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{tpl.name}</p>
                        <p className="text-[10px] text-white/40 font-mono truncate mt-0.5">{tpl.heygen_template_id}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => setGenOpen((o) => ({ ...o, [tpl.id]: !open }))}
                          className="flex items-center gap-1 text-[11px] text-violet-300 hover:text-violet-200 transition-colors"
                        >
                          <Play className="size-3.5" />
                          {open ? "Close" : "Generate"}
                        </button>
                        <button
                          onClick={() => deleteTplMut.mutate(tpl.id)}
                          disabled={deleteTplMut.isPending}
                          className="text-white/30 hover:text-rose-300 transition-colors"
                          aria-label="Delete"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Generate panel */}
                    {open && (
                      <div className="border-t border-white/10 px-4 py-3 space-y-3">
                        {/* Photo vs avatar toggle */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => setGenMode((m) => ({ ...m, [tpl.id]: "photo" }))}
                            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs transition-colors ${
                              gm === "photo"
                                ? "border-violet-400/50 bg-violet-500/15 text-violet-200"
                                : "border-white/10 bg-white/[0.03] text-white/50 hover:bg-white/[0.07]"
                            }`}
                          >
                            <Upload className="size-3.5" /> My photo
                          </button>
                          <button
                            onClick={() => setGenMode((m) => ({ ...m, [tpl.id]: "avatar" }))}
                            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs transition-colors ${
                              gm === "avatar"
                                ? "border-violet-400/50 bg-violet-500/15 text-violet-200"
                                : "border-white/10 bg-white/[0.03] text-white/50 hover:bg-white/[0.07]"
                            }`}
                          >
                            <User className="size-3.5" /> HeyGen avatar
                          </button>
                        </div>

                        {gm === "photo" ? (
                          <div className="space-y-1">
                            <label className="text-[10px] text-white/50">Photo URL</label>
                            <Input
                              value={genPhotoUrl[tpl.id] ?? ""}
                              onChange={(e) => setGenPhotoUrl((u) => ({ ...u, [tpl.id]: e.target.value }))}
                              placeholder="https://… direct image URL"
                              className="bg-black/30 border-white/10 text-white text-xs h-8"
                            />
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <label className="text-[10px] text-white/50">HeyGen avatar ID</label>
                            <Input
                              value={genAvatarId[tpl.id] ?? ""}
                              onChange={(e) => setGenAvatarId((a) => ({ ...a, [tpl.id]: e.target.value }))}
                              placeholder="Paste avatar ID from HeyGen"
                              className="bg-black/30 border-white/10 text-white text-xs h-8 font-mono"
                            />
                          </div>
                        )}

                        <Button
                          onClick={() => generateTplMut.mutate({ tpl, gMode: gm })}
                          disabled={generateTplMut.isPending && generateTplMut.variables?.tpl.id === tpl.id}
                          variant="premium"
                          size="sm"
                          className="w-full"
                        >
                          {generateTplMut.isPending && generateTplMut.variables?.tpl.id === tpl.id ? (
                            <><Loader2 className="size-3.5 mr-1 animate-spin" /> Generating…</>
                          ) : (
                            <><Sparkles className="size-3.5 mr-1" /> Generate · {TEMPLATE_COST} Aura</>
                          )}
                        </Button>

                        {/* Result */}
                        {res?.status === "rendering" && (
                          <div className="flex items-center gap-2 text-xs text-white/50 justify-center py-2">
                            <Loader2 className="size-4 animate-spin text-violet-300" /> Rendering video…
                          </div>
                        )}
                        {res?.status === "failed" && (
                          <p className="text-xs text-rose-300 text-center flex items-center justify-center gap-1">
                            <AlertTriangle className="size-3.5" /> Render failed — try again
                          </p>
                        )}
                        {res?.status === "done" && res.url && (
                          <div className="space-y-2">
                            <video
                              src={res.url}
                              controls
                              playsInline
                              className="w-full rounded-xl border border-white/10 bg-black"
                            />
                            <div className="flex gap-2">
                              <a
                                href={res.url}
                                download
                                onClick={(e) => {
                                  e.preventDefault();
                                  fetch(res.url!).then((r) => r.blob()).then((blob) => {
                                    const a = document.createElement("a");
                                    a.href = URL.createObjectURL(blob);
                                    a.download = `${tpl.name}-heygen.mp4`;
                                    a.click();
                                  });
                                }}
                                className="flex-1 flex items-center justify-center gap-1 text-[11px] py-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-white/70 transition-colors no-underline"
                              >
                                <ImageIcon className="size-3.5" /> Download
                              </a>
                              <button
                                onClick={() => { navigator.clipboard.writeText(res.url!); toast.success("URL copied"); }}
                                className="flex-1 flex items-center justify-center gap-1 text-[11px] py-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-white/70 transition-colors"
                              >
                                <Copy className="size-3.5" /> Copy URL
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* How-to hint */}
              <div className="aurora-glass rounded-xl p-4 space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-white/40">How to find your template ID</p>
                <ol className="text-[11px] text-white/60 space-y-1 list-decimal list-inside leading-relaxed">
                  <li>Go to <a href="https://app.heygen.com/templates" target="_blank" rel="noreferrer" className="text-violet-300 hover:underline">app.heygen.com/templates</a></li>
                  <li>Open any template → copy the URL or the ID from the address bar</li>
                  <li>Note the variable name you set for the character/avatar slot</li>
                </ol>
              </div>
            </div>
          )}

          {/* ── Recipes / Showcase panel ─────────────────────────────────── */}
          {mode === "recipes" && (
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
              <div>
                <h2 className="text-lg font-bold text-foreground">Showcase</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Real HeyGen Video Agent recipes — copy-paste command sets you can run with AI coding agents, CI/CD pipelines, and browser extensions.
                </p>
              </div>

              {[
                {
                  title: "README-to-Video",
                  subtitle: "Auto-generate video walkthroughs from GitHub README changes.",
                  badge: "GitHub Actions",
                  accent: "from-emerald-400 to-teal-500",
                  features: "Video Agent API",
                  stack: "TypeScript · GitHub Actions · Claude",
                  cost: "~$0.05–0.15 per video",
                  insight: "Quality gap comes down to the prompt. Use an LLM to write production-quality briefs with specific visual directions — not just narration scripts.",
                  steps: [
                    "A GitHub Action watches for README changes",
                    "Claude writes a scene-by-scene production prompt",
                    "Video Agent renders and embeds the video back in the README",
                  ],
                },
                {
                  title: "Viral Video Pipeline",
                  subtitle: "Research trending topics, then batch-generate short-form videos.",
                  badge: "Batch · Portrait",
                  accent: "from-violet-400 to-purple-500",
                  features: "Video Agent API (batch, portrait mode)",
                  stack: "Claude Code · HeyGen Skills",
                  cost: "~$6 for 6 videos",
                  insight: "Rate limit handling is critical for batch generation. Fire videos sequentially with 5–10s gaps and track all IDs for async polling.",
                  steps: [
                    "Web search for trending self-improvement topics",
                    "Generate 6 TikTok/Reels/Shorts-ready videos in one run",
                    "Batch report with performance predictions",
                  ],
                },
                {
                  title: "Site2Video — Chrome Extension",
                  subtitle: "One-click: turn any website into a professional, brand-consistent video.",
                  badge: "Chrome Extension",
                  accent: "from-blue-400 to-cyan-500",
                  features: "Video Agent API · Asset Upload · 1,200+ avatars",
                  stack: "Vite + React · Next.js · Gemini / Claude",
                  cost: "Per-render",
                  insight: "Every prompt is generated from scratch via LLM analysis — the system extracts visual style from the page itself and translates it into Video Agent prompt instructions.",
                  steps: [
                    "Extension captures full-page screenshot",
                    "Analyzes site's visual DNA (colors, typography, layout)",
                    "Generates style-aware Video Agent prompt and renders branded video",
                  ],
                },
                {
                  title: "AI News Broadcast",
                  subtitle: "Automated daily AI briefings: scrape → script → render → distribute.",
                  badge: "Automated Pipeline",
                  accent: "from-amber-400 to-orange-500",
                  features: "Video Agent API",
                  stack: "Bun · TypeScript",
                  cost: "Per-video",
                  insight: "Modular architecture (research → script → video → deliver) makes each stage independently testable. Swap Telegram delivery for email, Slack, or YouTube upload.",
                  steps: [
                    "Gathers AI papers from arXiv and Hacker News",
                    "Builds a script with an LLM",
                    "Generates video via Video Agent and posts to Telegram",
                  ],
                },
                {
                  title: "AI Mafia — Live Avatar Game",
                  subtitle: "Social deduction game with AI-powered Live Avatar NPCs.",
                  badge: "Live Avatars · Real-time",
                  accent: "from-rose-400 to-pink-500",
                  features: "Live Avatar SDK (real-time streaming)",
                  stack: "Next.js · React · HeyGen Live Avatar SDK · Claude",
                  cost: "Live streaming",
                  insight: "Live Avatars enable real-time interactive experiences — not pre-rendered video. NPCs read game state, develop strategies, and respond with natural speech and expressions.",
                  steps: [
                    "3 AI players (Maria, Chen, Alex) argue, accuse, bluff, and vote",
                    "Claude powers decision-making and distinct personalities",
                    "Real-time streaming — not pre-rendered video content",
                  ],
                },
              ].map((recipe) => (
                <div
                  key={recipe.title}
                  className="aurora-panel p-4 space-y-3 relative overflow-hidden"
                >
                  <div className={`absolute top-0 left-0 w-1 h-full bg-gradient-to-b ${recipe.accent} rounded-l-xl`} />
                  <div className="pl-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-foreground">{recipe.title}</h3>
                          <span className={`rounded-full bg-gradient-to-r ${recipe.accent} px-2 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider`}>
                            {recipe.badge}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{recipe.subtitle}</p>
                      </div>
                      <span className="shrink-0 text-[10px] text-white/30 font-mono">{recipe.cost}</span>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                      <div>
                        <span className="text-white/35 uppercase tracking-wider">HeyGen features</span>
                        <div className="text-white/70 mt-0.5">{recipe.features}</div>
                      </div>
                      <div>
                        <span className="text-white/35 uppercase tracking-wider">Stack</span>
                        <div className="text-white/70 mt-0.5">{recipe.stack}</div>
                      </div>
                    </div>

                    <ol className="mt-2.5 space-y-0.5 list-decimal list-inside text-[11px] text-white/60">
                      {recipe.steps.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ol>

                    <div className="mt-2.5 rounded-lg bg-white/[0.04] border border-white/5 px-3 py-2 text-[11px] text-white/55 italic">
                      <span className="text-white/35 not-italic font-semibold uppercase tracking-wider text-[9px]">Key insight · </span>
                      {recipe.insight}
                    </div>
                  </div>
                </div>
              ))}

              <div className="aurora-panel p-4">
                <h3 className="text-xs font-semibold text-foreground mb-2">Common Patterns</h3>
                <ul className="space-y-1.5 text-[11px] text-white/60">
                  {[
                    "Content → LLM → Video Agent prompt — the meta-prompt pattern works for any content type",
                    "Batch generation with rate limit handling — sequential queuing with status tracking",
                    "Style extraction → prompt instructions — translate visual context into Video Agent language",
                    "Modular pipelines — separate research, scripting, rendering, and delivery stages",
                  ].map((p) => (
                    <li key={p} className="flex items-start gap-2">
                      <span className="mt-0.5 size-1.5 rounded-full bg-violet-400 shrink-0" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {mode === "agent" && (
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
                      const vs = videos[s.id] ?? { status: "idle" as VideoStatus };
                      return (
                        <div key={s.id} className="aurora-glass rounded-xl overflow-hidden">
                          <div className="flex gap-3 p-3">
                            <div className="size-20 shrink-0 rounded-lg border border-white/10 bg-black/40 overflow-hidden grid place-items-center">
                              {vs.status === "succeeded" && vs.url ? (
                                <video src={vs.url} className="size-full object-cover" autoPlay loop muted playsInline />
                              ) : rs.status === "succeeded" && rs.url ? (
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
                              <div className="flex items-center gap-2 mt-2 flex-wrap">
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
                                <Button
                                  onClick={() => animateShot(s.id)}
                                  disabled={rs.status !== "succeeded" || vs.status === "rendering"}
                                  size="sm"
                                  variant="outline"
                                  title={rs.status !== "succeeded" ? "Render the shot as an image first" : undefined}
                                  className="h-7 border-violet-400/25 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20 text-[11px]"
                                >
                                  {vs.status === "rendering" ? (
                                    <Loader2 className="size-3 mr-1 animate-spin" />
                                  ) : (
                                    <Film className="size-3 mr-1" />
                                  )}
                                  {vs.status === "succeeded" ? "Re-animate" : vs.status === "rendering" ? "Animating…" : "Animate"}
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
                                {vs.status === "failed" && (
                                  <span className="text-[10px] text-rose-300 inline-flex items-center gap-1">
                                    <AlertTriangle className="size-3" /> {vs.error ?? "animate failed"}
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
          )}
        </main>
      </div>
    </div>
  );
}
