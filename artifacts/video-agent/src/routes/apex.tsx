import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useCallback, useState } from "react";
import {
  BookOpen,
  Check,
  Clock,
  Cpu,
  DollarSign,
  Film,
  Image as ImageIcon,
  Loader2,
  Music,
  Play,
  Plus,
  RefreshCw,
  Save,
  Send,
  TrendingUp,
  Zap,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Server function — Claude/AI creative brief generation (server-side only)
// ---------------------------------------------------------------------------

const generateBrief = createServerFn({ method: "POST" })
  .validator((data: unknown) => data as { prompt: string })
  .handler(async ({ data }) => {
    const apiKey =
      process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
    const baseUrl = (
      process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ?? "https://api.openai.com/v1"
    ).replace(/\/$/, "");

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 900,
        messages: [
          {
            role: "system",
            content:
              "You are a world-class creative director and content strategist. Generate compelling, platform-specific content briefs, scripts, captions, and creative direction. Be specific, actionable, and visionary.",
          },
          { role: "user", content: data.prompt },
        ],
      }),
    });

    if (!res.ok) throw new Error(`API error ${res.status}: ${res.statusText}`);
    const json = await res.json();
    return { text: (json.choices?.[0]?.message?.content as string) ?? "(no response)" };
  });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AppMode =
  | "dashboard"
  | "claude-studio"
  | "seedance-lab"
  | "seedream-gallery"
  | "automation";

interface ContentItem {
  id: number | string;
  type: "video" | "image" | "combined";
  platform: string;
  date: string;
  title: string;
  views: number;
  revenue: number;
  status: string;
}

interface SeedanceOutput {
  id: string;
  theme: string;
  style: string;
  duration: string;
  format: string;
  description: string;
  timestamp: string;
}

interface SeedreamOutput {
  id: string;
  prompt: string;
  style: string;
  seed: string;
  format: string;
  description: string;
  timestamp: string;
  previewColor: string;
}

interface QueueItem {
  id: number;
  content: string;
  type: string;
  status: string;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const Route = createFileRoute("/apex")({
  head: () => ({
    meta: [
      { title: "APEX — AI Content Orchestration" },
      {
        name: "description",
        content:
          "AI content orchestration engine: Claude Studio, Seedance Lab, Seedream Gallery, and workflow automation.",
      },
    ],
  }),
  component: ApexDashboard,
});

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

function ApexDashboard() {
  const [appMode, setAppMode] = useState<AppMode>("dashboard");
  const [modelLocked, setModelLocked] = useState(false);
  const [modelSeed, setModelSeed] = useState("42857");

  // Claude Studio
  const [claudePrompt, setClaudePrompt] = useState("");
  const [claudeOutput, setClaudeOutput] = useState("");
  const [claudeLoading, setClaudeLoading] = useState(false);

  // Seedance
  const [danceTheme, setDanceTheme] = useState("luxury");
  const [danceStyle, setDanceStyle] = useState("editorial");
  const [danceGenerating, setDanceGenerating] = useState(false);
  const [danceOutput, setDanceOutput] = useState<SeedanceOutput | null>(null);

  // Seedream
  const [dreamPrompt, setDreamPrompt] = useState("");
  const [dreamStyle, setDreamStyle] = useState("ethereal");
  const [dreamGenerating, setDreamGenerating] = useState(false);
  const [dreamOutput, setDreamOutput] = useState<SeedreamOutput | null>(null);

  // Shared
  const [contentLibrary, setContentLibrary] = useState<ContentItem[]>([
    { id: 1, type: "video", platform: "TikTok", date: "2025-07-24", title: "Luxury Motion Editorial", views: 145000, revenue: 320, status: "published" },
    { id: 2, type: "image", platform: "Instagram", date: "2025-07-23", title: "Ethereal Fashion", views: 89000, revenue: 240, status: "published" },
    { id: 3, type: "combined", platform: "YouTube", date: "2025-07-22", title: "Fashion Short Film", views: 234000, revenue: 580, status: "published" },
  ]);
  const [monthlyRevenue, setMonthlyRevenue] = useState(3240);
  const [totalContent, setTotalContent] = useState(47);
  const [automationActive, setAutomationActive] = useState(false);
  const [workflowQueue, setWorkflowQueue] = useState<QueueItem[]>([]);

  // Actions
  const generateClaudeContent = useCallback(async () => {
    if (!claudePrompt.trim()) return;
    setClaudeLoading(true);
    try {
      const result = await generateBrief({ data: { prompt: claudePrompt } });
      setClaudeOutput(result.text);
    } catch (err) {
      console.error("APEX Claude error:", err);
      setClaudeOutput("Error generating content. Please try again.");
    } finally {
      setClaudeLoading(false);
    }
  }, [claudePrompt]);

  const generateSeedanceMotion = useCallback(async () => {
    setDanceGenerating(true);
    await new Promise((r) => setTimeout(r, 2000));
    setDanceOutput({
      id: "seedance_" + Date.now(),
      theme: danceTheme,
      style: danceStyle,
      duration: "15-60 seconds",
      format: "MP4/WebM",
      description: `${danceStyle} motion video in ${danceTheme} aesthetic – ready for TikTok/Instagram Reels`,
      timestamp: new Date().toLocaleTimeString(),
    });
    setDanceGenerating(false);
  }, [danceTheme, danceStyle]);

  const generateSeedreamImage = useCallback(async () => {
    if (!dreamPrompt.trim()) return;
    setDreamGenerating(true);
    await new Promise((r) => setTimeout(r, 3000));
    setDreamOutput({
      id: "seedream_" + Date.now(),
      prompt: dreamPrompt,
      style: dreamStyle,
      seed: modelSeed,
      format: "4K resolution",
      description: `${dreamStyle} image generation with seed ${modelSeed}`,
      timestamp: new Date().toLocaleTimeString(),
      previewColor:
        dreamStyle === "ethereal"
          ? "#e9d5ff"
          : dreamStyle === "cyberpunk"
            ? "#0ea5e9"
            : "#fca5a5",
    });
    setDreamGenerating(false);
  }, [dreamPrompt, dreamStyle, modelSeed]);

  const addToQueue = useCallback((content: string, type: string) => {
    setWorkflowQueue((prev) => [
      ...prev,
      { id: Date.now(), content, type, status: "queued", timestamp: new Date().toLocaleTimeString() },
    ]);
  }, []);

  const executeWorkflow = async () => {
    if (!workflowQueue.length) return;
    setAutomationActive(true);
    const added: ContentItem[] = [];
    for (const item of workflowQueue) {
      await new Promise((r) => setTimeout(r, 1500));
      const newItem: ContentItem = {
        id: Date.now() + Math.random(),
        type: (["video", "image", "combined"].includes(item.type)
          ? item.type
          : "combined") as ContentItem["type"],
        platform: ["TikTok", "Instagram", "YouTube", "Twitter"][Math.floor(Math.random() * 4)],
        date: new Date().toISOString().split("T")[0],
        title: item.content.slice(0, 50),
        views: Math.floor(Math.random() * 100_000) + 10_000,
        revenue: Math.floor(Math.random() * 500) + 100,
        status: "published",
      };
      added.push(newItem);
    }
    setContentLibrary((prev) => [...added, ...prev]);
    setMonthlyRevenue((prev) => prev + added.reduce((s, i) => s + i.revenue, 0));
    setTotalContent((prev) => prev + added.length);
    setWorkflowQueue([]);
    setAutomationActive(false);
  };

  const TABS: { id: AppMode; label: string }[] = [
    { id: "dashboard", label: "Dashboard" },
    { id: "claude-studio", label: "Claude Studio" },
    { id: "seedance-lab", label: "Seedance Lab" },
    { id: "seedream-gallery", label: "Seedream Gallery" },
    { id: "automation", label: "Automation" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      {/* ── Page header ── */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-black text-gradient leading-none">APEX</h1>
          <p className="text-sm text-muted-foreground mt-1">AI Content Orchestration Engine</p>
        </div>
        <div className="flex items-center gap-2 glass rounded-lg px-3 py-2">
          <Cpu className="h-4 w-4 text-primary" />
          <span className="text-xs text-primary font-semibold uppercase tracking-widest">
            All Systems Active
          </span>
        </div>
      </div>

      {/* ── Mode tabs ── */}
      <div className="flex gap-1 mb-6 p-1 glass rounded-xl overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setAppMode(t.id)}
            className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
              appMode === t.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Model seed lock bar ── */}
      <div className="mb-6 glass rounded-xl p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/30 to-primary-glow/20 border border-primary/30 flex items-center justify-center">
            <Cpu className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="text-sm font-semibold">Model Seed Lock</div>
            <div className="text-xs text-muted-foreground">
              Consistent identity across all generated content
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={modelSeed}
            onChange={(e) => !modelLocked && setModelSeed(e.target.value)}
            disabled={modelLocked}
            className="w-24 bg-muted/50 border border-border rounded-lg px-3 py-1.5 text-sm text-center text-foreground disabled:opacity-60 focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            onClick={() => setModelLocked((l) => !l)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
              modelLocked
                ? "bg-primary/20 text-primary border-primary/40"
                : "bg-muted text-muted-foreground border-border hover:text-foreground"
            }`}
          >
            {modelLocked ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
            {modelLocked ? "Locked" : "Lock Seed"}
          </button>
        </div>
      </div>

      {/* ── Tab content ── */}
      {appMode === "dashboard" && (
        <DashboardView
          monthlyRevenue={monthlyRevenue}
          totalContent={totalContent}
          workflowQueue={workflowQueue}
          contentLibrary={contentLibrary}
          onNavigate={setAppMode}
        />
      )}
      {appMode === "claude-studio" && (
        <ClaudeStudioView
          prompt={claudePrompt}
          setPrompt={setClaudePrompt}
          output={claudeOutput}
          loading={claudeLoading}
          onGenerate={generateClaudeContent}
          onAddToQueue={addToQueue}
        />
      )}
      {appMode === "seedance-lab" && (
        <SeedanceLabView
          theme={danceTheme}
          setTheme={setDanceTheme}
          style={danceStyle}
          setStyle={setDanceStyle}
          generating={danceGenerating}
          output={danceOutput}
          onGenerate={generateSeedanceMotion}
          onAddToQueue={() => {
            if (danceOutput) {
              addToQueue(`Seedance video: ${danceOutput.description}`, "video");
              setDanceOutput(null);
            }
          }}
        />
      )}
      {appMode === "seedream-gallery" && (
        <SeedreamGalleryView
          prompt={dreamPrompt}
          setPrompt={setDreamPrompt}
          style={dreamStyle}
          setStyle={setDreamStyle}
          generating={dreamGenerating}
          output={dreamOutput}
          modelSeed={modelSeed}
          onGenerate={generateSeedreamImage}
          onAddToQueue={() => {
            if (dreamOutput) {
              addToQueue(`Seedream image: ${dreamOutput.description}`, "image");
              setDreamOutput(null);
            }
          }}
        />
      )}
      {appMode === "automation" && (
        <AutomationView
          queue={workflowQueue}
          active={automationActive}
          onExecute={executeWorkflow}
          contentLibrary={contentLibrary}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard View
// ---------------------------------------------------------------------------

function DashboardView({
  monthlyRevenue,
  totalContent,
  workflowQueue,
  contentLibrary,
  onNavigate,
}: {
  monthlyRevenue: number;
  totalContent: number;
  workflowQueue: QueueItem[];
  contentLibrary: ContentItem[];
  onNavigate: (mode: AppMode) => void;
}) {
  const stats = [
    {
      label: "Monthly Revenue",
      value: `$${monthlyRevenue.toLocaleString()}`,
      icon: DollarSign,
      sub: "+12% vs last month",
    },
    {
      label: "Content Published",
      value: String(totalContent),
      icon: TrendingUp,
      sub: "Across all platforms",
    },
    {
      label: "Automation Tasks",
      value: String(workflowQueue.length),
      icon: Zap,
      sub: workflowQueue.length === 1 ? "item in queue" : "items in queue",
    },
    {
      label: "Model Status",
      value: "Active",
      icon: Cpu,
      sub: "All providers online",
    },
  ];

  const modules: { id: AppMode; label: string; desc: string; icon: React.FC<{ className?: string }> }[] = [
    { id: "claude-studio", label: "Claude Studio", desc: "Creative direction & copy", icon: (p) => <BookOpen className={p.className} /> },
    { id: "seedance-lab", label: "Seedance Lab", desc: "Motion & video generation", icon: (p) => <Film className={p.className} /> },
    { id: "seedream-gallery", label: "Seedream Gallery", desc: "Image generation & editing", icon: (p) => <ImageIcon className={p.className} /> },
    { id: "automation", label: "Automation", desc: "Workflow orchestration", icon: (p) => <Zap className={p.className} /> },
  ];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="glass rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <s.icon className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                {s.label}
              </span>
            </div>
            <div className="text-3xl font-black text-foreground mb-1">{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Module cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {modules.map((m) => (
          <button
            key={m.id}
            onClick={() => onNavigate(m.id)}
            className="group glass rounded-xl p-6 text-left hover:border-primary/40 transition-colors"
          >
            <m.icon className="h-7 w-7 text-primary mb-3" />
            <h3 className="font-bold text-foreground">{m.label}</h3>
            <p className="text-xs text-muted-foreground mt-1">{m.desc}</p>
          </button>
        ))}
      </div>

      {/* Content library */}
      <div className="glass rounded-xl p-6">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Recent Content
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="pb-3 pr-4 font-medium">Type</th>
                <th className="pb-3 pr-4 font-medium">Title</th>
                <th className="pb-3 pr-4 font-medium">Platform</th>
                <th className="pb-3 pr-4 font-medium">Date</th>
                <th className="pb-3 pr-4 font-medium text-right">Views</th>
                <th className="pb-3 font-medium text-right">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {contentLibrary.slice(0, 8).map((item) => (
                <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                  <td className="py-3 pr-4">
                    {item.type === "video" && <Film className="h-4 w-4 text-primary" />}
                    {item.type === "image" && <ImageIcon className="h-4 w-4 text-primary/70" />}
                    {item.type === "combined" && <Music className="h-4 w-4 text-primary/50" />}
                  </td>
                  <td className="py-3 pr-4 text-foreground max-w-[180px] truncate">{item.title}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{item.platform}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{item.date}</td>
                  <td className="py-3 pr-4 text-right text-foreground">
                    {item.views.toLocaleString()}
                  </td>
                  <td className="py-3 text-right text-primary font-semibold">
                    ${item.revenue}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Claude Studio View
// ---------------------------------------------------------------------------

function ClaudeStudioView({
  prompt,
  setPrompt,
  output,
  loading,
  onGenerate,
  onAddToQueue,
}: {
  prompt: string;
  setPrompt: (v: string) => void;
  output: string;
  loading: boolean;
  onGenerate: () => void;
  onAddToQueue: (content: string, type: string) => void;
}) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-4">
        <div className="glass rounded-xl p-6">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Claude Studio
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Generate creative briefs, scripts, captions, and strategic direction using AI.
          </p>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. Write a TikTok script for a luxury fashion brand targeting Gen Z creators…"
            className="w-full h-36 bg-muted/50 border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          />
          <button
            onClick={onGenerate}
            disabled={loading || !prompt.trim()}
            className="mt-3 w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold py-2.5 rounded-lg hover:opacity-90 disabled:opacity-50 transition"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Generate Brief
              </>
            )}
          </button>
        </div>
      </div>

      <div className="glass rounded-xl p-6 flex flex-col">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-widest mb-4">
          Output
        </h3>
        {output ? (
          <>
            <div className="flex-1 overflow-y-auto text-sm text-foreground leading-relaxed whitespace-pre-wrap bg-muted/30 rounded-lg p-4 max-h-72">
              {output}
            </div>
            <button
              onClick={() => onAddToQueue(output, "combined")}
              className="mt-4 flex items-center justify-center gap-2 border border-primary/40 text-primary font-semibold py-2 rounded-lg hover:bg-primary/10 transition text-sm"
            >
              <Plus className="h-4 w-4" />
              Add to Workflow Queue
            </button>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            <div className="text-center">
              <BookOpen className="h-10 w-10 text-muted/50 mx-auto mb-3" />
              <p>Your creative brief will appear here</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Seedance Lab View
// ---------------------------------------------------------------------------

function SeedanceLabView({
  theme,
  setTheme,
  style,
  setStyle,
  generating,
  output,
  onGenerate,
  onAddToQueue,
}: {
  theme: string;
  setTheme: (v: string) => void;
  style: string;
  setStyle: (v: string) => void;
  generating: boolean;
  output: SeedanceOutput | null;
  onGenerate: () => void;
  onAddToQueue: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black mb-1">Seedance Lab</h1>
        <p className="text-muted-foreground text-sm">
          Motion generation for TikTok, Instagram Reels, YouTube Shorts
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="glass rounded-xl p-6">
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
            Dance Theme
          </label>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {["luxury", "urban", "minimalist", "cyberpunk", "sensual"].map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>

        <div className="glass rounded-xl p-6">
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
            Motion Style
          </label>
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {["editorial", "raw", "cinematic", "dance", "abstract"].map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      <button
        onClick={onGenerate}
        disabled={generating}
        className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold py-3 rounded-xl hover:opacity-90 disabled:opacity-50 transition"
      >
        {generating ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Generating Motion…
          </>
        ) : (
          <>
            <Play className="h-5 w-5" />
            Generate Motion Video
          </>
        )}
      </button>

      {output && (
        <div className="glass rounded-xl p-6 border border-primary/30 space-y-4">
          <div className="flex items-center gap-2 text-primary font-semibold">
            <Check className="h-4 w-4" />
            Motion video generated
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Row label="Theme" value={output.theme} />
            <Row label="Style" value={output.style} />
            <Row label="Duration" value={output.duration} />
            <Row label="Format" value={output.format} />
          </div>
          <p className="text-sm text-muted-foreground">{output.description}</p>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> Generated at {output.timestamp}
          </div>
          <button
            onClick={onAddToQueue}
            className="w-full flex items-center justify-center gap-2 border border-primary/40 text-primary font-semibold py-2 rounded-lg hover:bg-primary/10 transition text-sm"
          >
            <Plus className="h-4 w-4" />
            Add to Workflow Queue
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Seedream Gallery View
// ---------------------------------------------------------------------------

function SeedreamGalleryView({
  prompt,
  setPrompt,
  style,
  setStyle,
  generating,
  output,
  modelSeed,
  onGenerate,
  onAddToQueue,
}: {
  prompt: string;
  setPrompt: (v: string) => void;
  style: string;
  setStyle: (v: string) => void;
  generating: boolean;
  output: SeedreamOutput | null;
  modelSeed: string;
  onGenerate: () => void;
  onAddToQueue: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black mb-1">Seedream Gallery</h1>
        <p className="text-muted-foreground text-sm">
          Dreamy, ethereal, and surreal image generation with seed consistency
        </p>
      </div>

      <div className="glass rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
            Image Prompt
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the dreamy image you want to create…"
            className="w-full h-24 bg-muted/50 border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
            Visual Style
          </label>
          <div className="flex flex-wrap gap-2">
            {["ethereal", "cyberpunk", "rose-gold", "monochrome", "neon", "natural"].map((s) => (
              <button
                key={s}
                onClick={() => setStyle(s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  style === s
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
          <Cpu className="h-3.5 w-3.5" />
          <span>Using seed {modelSeed} for consistent identity</span>
          <RefreshCw className="h-3.5 w-3.5 ml-auto" />
          <span className="text-primary">Locked</span>
        </div>
      </div>

      <button
        onClick={onGenerate}
        disabled={generating || !prompt.trim()}
        className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold py-3 rounded-xl hover:opacity-90 disabled:opacity-50 transition"
      >
        {generating ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Generating Image…
          </>
        ) : (
          <>
            <ImageIcon className="h-5 w-5" />
            Generate Image
          </>
        )}
      </button>

      {output && (
        <div className="glass rounded-xl p-6 border border-primary/30 space-y-4">
          {/* Colour swatch preview */}
          <div
            className="w-full h-40 rounded-lg flex items-center justify-center text-sm font-semibold"
            style={{ backgroundColor: output.previewColor, color: "#1e1e2e" }}
          >
            {output.style} · seed {output.seed}
          </div>
          <div className="flex items-center gap-2 text-primary font-semibold">
            <Check className="h-4 w-4" />
            Image generated
          </div>
          <p className="text-sm text-muted-foreground">{output.description}</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Row label="Style" value={output.style} />
            <Row label="Format" value={output.format} />
            <Row label="Seed" value={output.seed} />
            <Row label="Generated" value={output.timestamp} />
          </div>
          <button
            onClick={onAddToQueue}
            className="w-full flex items-center justify-center gap-2 border border-primary/40 text-primary font-semibold py-2 rounded-lg hover:bg-primary/10 transition text-sm"
          >
            <Plus className="h-4 w-4" />
            Add to Workflow Queue
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Automation View
// ---------------------------------------------------------------------------

function AutomationView({
  queue,
  active,
  onExecute,
  contentLibrary,
}: {
  queue: QueueItem[];
  active: boolean;
  onExecute: () => void;
  contentLibrary: ContentItem[];
}) {
  const RULES = [
    { label: "Auto-Post to All Platforms", desc: "After processing, content auto-publishes to Instagram, TikTok, YouTube, Twitter" },
    { label: "Log to Obsidian", desc: "Every published piece is logged with metadata and added to knowledge base" },
    { label: "Revenue Tracking", desc: "Monitors impressions, clicks, and conversions across all channels" },
    { label: "Trending Detection", desc: "Prompts AI to generate variations based on real-time trends" },
  ];

  return (
    <div className="space-y-6">
      {/* Queue */}
      <div className="glass rounded-xl p-6">
        <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Workflow Queue
          {queue.length > 0 && (
            <span className="ml-auto text-xs font-medium bg-primary/20 text-primary rounded-full px-2 py-0.5">
              {queue.length} item{queue.length !== 1 ? "s" : ""}
            </span>
          )}
        </h2>
        {queue.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <Zap className="h-10 w-10 text-muted/40 mx-auto mb-3" />
            <p>No items in queue. Generate content and add it here.</p>
          </div>
        ) : (
          <div className="space-y-2 mb-4">
            {queue.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 bg-muted/30 rounded-lg px-4 py-3 text-sm"
              >
                {item.type === "video" ? (
                  <Film className="h-4 w-4 text-primary shrink-0" />
                ) : (
                  <ImageIcon className="h-4 w-4 text-primary/70 shrink-0" />
                )}
                <span className="flex-1 text-foreground truncate">{item.content}</span>
                <span className="text-xs text-muted-foreground shrink-0">{item.timestamp}</span>
                <span className="text-xs bg-primary/20 text-primary rounded-full px-2 py-0.5 shrink-0">
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        )}
        <button
          onClick={onExecute}
          disabled={active || queue.length === 0}
          className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold py-3 rounded-xl hover:opacity-90 disabled:opacity-50 transition"
        >
          {active ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Processing…
            </>
          ) : (
            <>
              <Zap className="h-5 w-5" />
              Execute Workflow
            </>
          )}
        </button>
      </div>

      {/* Automation rules */}
      <div className="glass rounded-xl p-6">
        <h2 className="font-bold text-lg mb-4">Active Automation Rules</h2>
        <div className="space-y-3">
          {RULES.map((rule) => (
            <div
              key={rule.label}
              className="flex items-start gap-4 bg-muted/30 rounded-lg p-4"
            >
              <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-sm text-foreground">{rule.label}</div>
                <div className="text-xs text-muted-foreground mt-1">{rule.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Published content summary */}
      {contentLibrary.length > 0 && (
        <div className="glass rounded-xl p-6">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Published Content ({contentLibrary.length} total)
          </h2>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="bg-muted/30 rounded-lg p-4 text-center">
              <div className="text-2xl font-black text-primary">
                {contentLibrary.reduce((s, i) => s + i.views, 0).toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Total Views</div>
            </div>
            <div className="bg-muted/30 rounded-lg p-4 text-center">
              <div className="text-2xl font-black text-primary">
                ${contentLibrary.reduce((s, i) => s + i.revenue, 0).toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Total Revenue</div>
            </div>
            <div className="bg-muted/30 rounded-lg p-4 text-center">
              <div className="text-2xl font-black text-primary">
                {new Set(contentLibrary.map((i) => i.platform)).size}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Platforms</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/30 rounded-lg px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-semibold text-foreground capitalize">{value}</div>
    </div>
  );
}
