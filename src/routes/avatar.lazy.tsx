import { authNextSearch } from "@/lib/auth-return-path";
import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { FeatureGuard } from "@/components/FeatureVisibilityProvider";
import { useEffect, useRef, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  savePhotoAvatar,
  listPhotoAvatars,
  deletePhotoAvatar,
  generateFromPhotoAvatar,
  PHOTO_AVATAR_COST,
  type PhotoAvatarWithUrl,
} from "@/lib/photo-avatar.functions";
import {
  generateFromPlatformTemplate,
  generateAvatarShot,
  saveAvatarShot,
  listAvatarShots,
  deleteAvatarShot,
  templateCost,
  GENERATE_ALL_COST,
  SHOT_IMAGE_COST,
  SHOT_KLING_COST,
  type SavedAvatarShot,
} from "@/lib/platform-template.functions";
import {
  PLATFORM_TEMPLATES,
  FEATURED_TEMPLATES,
  OTHER_TEMPLATES,
  type PlatformTemplate,
} from "@/lib/platform-templates";
import { writeAvatarScript, improveAvatarScript } from "@/lib/avatar-script.functions";
import { toast } from "sonner";
import {
  Loader2,
  Sparkles,
  Film,
  Zap,
  CheckCircle2,
  AlertCircle,
  Download,
  Mic,
  Wand2,
  ChevronDown,
  ChevronUp,
  Play,
  SkipBack,
  Volume2,
  X,
  Trash2,
  Upload,
  ImagePlus,
} from "lucide-react";

// Artist-only mode: this feature is hidden from regular users by default.
// Admins always pass; regular users are redirected to /studio unless the
// owner has toggled the feature visible (see feature-visibility registry).
export const Route = createLazyFileRoute("/avatar")({
  component: () => (
    <FeatureGuard feature="talking-avatars">
      <AvatarStudioPage />
    </FeatureGuard>
  ),
});

// ─── constants ────────────────────────────────────────────────────────────────

const VOICES = [
  { id: "m3Fp8hA8nS1Gc1Ne9FIf", name: "Polished Pro", tag: "Male · EN" },
  { id: "HFJgR1FG42fSaMg8piDw", name: "Bright Vlogger", tag: "EN" },
  { id: "f38a635bee7a4d1f9b0a654a31d050d2", name: "Chill Brian", tag: "Male · EN" },
  { id: "f8c69e517f424cafaecde32dde57096b", name: "Allison", tag: "Female · EN" },
  { id: "d92994ae0de34b2e8659b456a2f388b8", name: "John Doe", tag: "Male · EN" },
  { id: "97dd67ab8ce242b6a9e7689cb00c6414", name: "Monika", tag: "Female · EN" },
] as const;

type VoiceId = (typeof VOICES)[number]["id"];
type StudioTab = "script" | "preview" | "avatars" | "shots";
type ShotEngine = "seedream" | "gemini" | "kling";
type CardState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; url: string }
  | { status: "error"; message: string };
type AIStyle = "hype" | "smooth" | "story" | "promo";
type AIDuration = "short" | "medium" | "long";
type AIAction = "improve" | "longer" | "shorter" | "hook" | "punchup";

const ACCEPT = "image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm";

function estimateDuration(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const secs = Math.round((words / 140) * 60);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function AvatarStudioPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  // ── studio state ────────────────────────────────────────────────────────────
  const search = Route.useSearch();
  const [activeTab, setActiveTab] = useState<StudioTab>(search.tab ?? "script");
  const [script, setScript] = useState("");
  const [selectedId, setSelectedId] = useState("heygen-avatar-1");
  const [selectedVoice, setSelectedVoice] = useState<VoiceId>("m3Fp8hA8nS1Gc1Ne9FIf");
  const [cardStates, setCardStates] = useState<Record<string, CardState>>(
    Object.fromEntries(PLATFORM_TEMPLATES.map((t) => [t.id, { status: "idle" }])),
  );

  useEffect(() => {
    if (search.tab) setActiveTab(search.tab);
  }, [search.tab]);

  // ── AI tools state ──────────────────────────────────────────────────────────
  const [showAI, setShowAI] = useState(false);
  const [aiTheme, setAiTheme] = useState("");
  const [aiStyle, setAiStyle] = useState<AIStyle>("hype");
  const [aiDuration, setAiDuration] = useState<AIDuration>("medium");
  const [aiLoading, setAiLoading] = useState(false);

  // ── shots tab state ─────────────────────────────────────────────────────────
  const [shotEngine, setShotEngine] = useState<ShotEngine>("seedream");
  const [shotPrompt, setShotPrompt] = useState("");
  const [shotLoading, setShotLoading] = useState(false);
  const [shotAvatarUrl, setShotAvatarUrl] = useState<string | null>(null);
  const [shotResults, setShotResults] = useState<
    Array<{ url: string; engine: ShotEngine; kind: "image" | "video" }>
  >([]);

  // ── personal avatar state ───────────────────────────────────────────────────
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [avatarName, setAvatarName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [activeAvatar, setActiveAvatar] = useState<PhotoAvatarWithUrl | null>(null);
  const [avatarScript, setAvatarScript] = useState("");
  const [avatarResult, setAvatarResult] = useState<string | null>(null);
  const [avatarGenerating, setAvatarGenerating] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: authNextSearch() });
  }, [user, loading, navigate]);

  // ── server fns ──────────────────────────────────────────────────────────────
  const saveFn = useServerFn(savePhotoAvatar);
  const listFn = useServerFn(listPhotoAvatars);
  const deleteFn = useServerFn(deletePhotoAvatar);
  const generatePhotoFn = useServerFn(generateFromPhotoAvatar);
  const generateTemplateFn = useServerFn(generateFromPlatformTemplate);
  const shotFn = useServerFn(generateAvatarShot);
  const saveShotFn = useServerFn(saveAvatarShot);
  const listShotsFn = useServerFn(listAvatarShots);
  const deleteShotFn = useServerFn(deleteAvatarShot);
  const writeFn = useServerFn(writeAvatarScript);
  const improveFn = useServerFn(improveAvatarScript);

  const { data: myAvatars = [], isLoading: listLoading } = useQuery({
    queryKey: ["photo-avatars"],
    queryFn: () => listFn(),
    enabled: !!user,
  });

  const { data: savedShots = [], refetch: refetchShots } = useQuery({
    queryKey: ["avatar-shots"],
    queryFn: () => listShotsFn(),
    enabled: !!user,
  });

  const selectedTemplate = PLATFORM_TEMPLATES.find((t) => t.id === selectedId)!;
  const selectedState = cardStates[selectedId] ?? { status: "idle" };
  const loadingCount = Object.values(cardStates).filter((s) => s.status === "loading").length;
  const doneCount = Object.values(cardStates).filter((s) => s.status === "done").length;
  const isGeneratingAll = loadingCount > 0;

  // ── generate one template ───────────────────────────────────────────────────
  const generateOne = useCallback(
    async (templateId: string, scriptText: string) => {
      setCardStates((p) => ({ ...p, [templateId]: { status: "loading" } }));
      try {
        const res = await generateTemplateFn({
          data: { templateId, script: scriptText.trim(), voiceId: selectedVoice },
        });
        if (res.ok) {
          setCardStates((p) => ({ ...p, [templateId]: { status: "done", url: res.url } }));
        } else {
          setCardStates((p) => ({
            ...p,
            [templateId]: { status: "error", message: res.error },
          }));
          if (res.insufficient) {
            toast.error("Not enough Aura credits");
          } else {
            toast.error(res.error ?? "Generation failed", { duration: 6000 });
          }
        }
      } catch (e) {
        setCardStates((p) => ({
          ...p,
          [templateId]: { status: "error", message: e instanceof Error ? e.message : "Failed" },
        }));
      }
    },
    [generateTemplateFn, selectedVoice],
  );

  // ── generate all ────────────────────────────────────────────────────────────
  const generateAll = useCallback(async () => {
    const trimmed = script.trim();
    if (!trimmed) return toast.error("Write your script first");
    setCardStates(
      Object.fromEntries(PLATFORM_TEMPLATES.map((t) => [t.id, { status: "loading" as const }])),
    );
    await Promise.allSettled(PLATFORM_TEMPLATES.map((t) => generateOne(t.id, trimmed)));
    toast.success("All templates generated!");
  }, [script, generateOne]);

  // ── generate selected ───────────────────────────────────────────────────────
  const generateSelected = useCallback(async () => {
    const trimmed = script.trim();
    if (!trimmed) return toast.error("Write your script first");
    await generateOne(selectedId, trimmed);
  }, [script, selectedId, generateOne]);

  // ── AI: write for me ────────────────────────────────────────────────────────
  const aiWrite = async () => {
    if (!aiTheme.trim()) return toast.error("Describe the theme or song first");
    setAiLoading(true);
    try {
      const { script: s } = await writeFn({
        data: { theme: aiTheme.trim(), style: aiStyle, duration: aiDuration },
      });
      setScript(s);
      toast.success("Script written ✨");
      setShowAI(false);
    } catch {
      toast.error("AI writing failed — try again");
    } finally {
      setAiLoading(false);
    }
  };

  // ── AI: improve ─────────────────────────────────────────────────────────────
  const aiImprove = async (action: AIAction) => {
    if (!script.trim()) return toast.error("Write something first");
    setAiLoading(true);
    try {
      const { script: s } = await improveFn({ data: { script: script.trim(), action } });
      setScript(s);
      toast.success(
        action === "hook"
          ? "Hook added ✨"
          : action === "longer"
            ? "Extended ✨"
            : action === "shorter"
              ? "Tightened ✨"
              : action === "punchup"
                ? "Punched up ✨"
                : "Improved ✨",
      );
    } catch {
      toast.error("AI improvement failed — try again");
    } finally {
      setAiLoading(false);
    }
  };

  // ── personal avatar upload ──────────────────────────────────────────────────
  const handleFile = (f: File) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
    if (!avatarName) setAvatarName(f.name.replace(/\.[^.]+$/, ""));
  };
  const handleSave = async () => {
    if (!file || !user || !avatarName.trim()) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/avatars/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("studio")
        .upload(path, file, { contentType: file.type, upsert: true });
      if (error) throw new Error(error.message);
      await saveFn({ data: { name: avatarName.trim(), storagePath: path } });
      toast.success("Avatar saved!");
      setFile(null);
      setPreview(null);
      setAvatarName("");
      qc.invalidateQueries({ queryKey: ["photo-avatars"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setUploading(false);
    }
  };
  const generateAvatar = async () => {
    if (!activeAvatar || !avatarScript.trim()) return;
    setAvatarGenerating(true);
    setAvatarResult(null);
    try {
      const res = await generatePhotoFn({
        data: { avatarId: activeAvatar.id, script: avatarScript.trim() },
      });
      if (res.ok) {
        setAvatarResult(res.url);
        toast.success("Video ready!");
      } else toast.error(res.error, { duration: 6000 });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setAvatarGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-5 animate-spin text-primary" />
      </div>
    );
  }

  const estDuration = estimateDuration(script);
  const wordCount = script.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* ── Studio header ─────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-3 py-2 border-b border-border/40 bg-background/95 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Film className="size-4 text-primary shrink-0" />
          <span className="text-sm font-semibold truncate max-w-[140px]">
            {selectedTemplate.name}
          </span>
          <span className="text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
            {selectedTemplate.kind === "heygen-avatar"
              ? "HeyGen"
              : selectedTemplate.kind === "photo"
                ? "Photo"
                : "Video"}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Generate All — small secondary */}
          <button
            onClick={generateAll}
            disabled={isGeneratingAll || !script.trim()}
            className="hidden xs:flex text-[10px] text-muted-foreground hover:text-primary px-2 py-1 rounded transition-colors disabled:opacity-40"
          >
            <Zap className="size-3 mr-1" />
            All
          </button>
          {/* Generate selected — primary CTA */}
          <button
            onClick={generateSelected}
            disabled={selectedState.status === "loading" || !script.trim()}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-3 py-1.5 text-xs font-semibold transition-opacity disabled:opacity-50"
          >
            {selectedState.status === "loading" ? (
              <><Loader2 className="size-3 animate-spin" /> Generating…</>
            ) : (
              <>
                <CheckCircle2 className="size-3" />
                Generate
              </>
            )}
          </button>
        </div>
      </header>

      {/* ── Tab bar ───────────────────────────────────────────────────────── */}
      <nav className="flex border-b border-border/40 bg-background/80 shrink-0">
        {(
          [
            { id: "script", label: "Script", icon: "📝" },
            { id: "preview", label: "Preview", icon: "🎬" },
            { id: "avatars", label: "Avatars", icon: "👤" },
            { id: "shots", label: "Shots", icon: "🎨" },
          ] as { id: StudioTab; label: string; icon: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2 ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
            {tab.id === "avatars" && doneCount > 0 && (
              <span className="bg-green-500/20 text-green-400 text-[9px] px-1 rounded">
                {doneCount}✓
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* ── Tab content ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        {/* ══ SCRIPT TAB ══ */}
        {activeTab === "script" && (
          <div className="h-full flex flex-col">
            {/* Scene header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-border/20 bg-muted/20 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary/80" />
                <span className="text-xs font-semibold text-foreground/70">Scene 1</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">
                  00:00 / {estDuration} est.
                </span>
                {wordCount > 0 && (
                  <span className="text-[10px] bg-muted/50 text-muted-foreground px-1.5 py-0.5 rounded">
                    {wordCount}w
                  </span>
                )}
              </div>
            </div>

            {/* Textarea — main script area */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
              <textarea
                placeholder={`Write your script here…\n\nOr use AI Tools below to generate one from a song, theme, or idea.`}
                value={script}
                onChange={(e) => setScript(e.target.value)}
                className="w-full h-full min-h-[200px] bg-transparent text-sm leading-relaxed placeholder:text-muted-foreground/40 focus:outline-none resize-none font-[system-ui] italic"
              />
            </div>

            {/* Bottom toolbar */}
            <div className="border-t border-border/30 bg-background/80 shrink-0">
              {/* AI tools drawer */}
              {showAI && (
                <div className="px-4 py-3 border-b border-border/20 bg-muted/10 space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold flex items-center gap-1.5">
                      <Wand2 className="size-3.5 text-primary" />
                      AI Script Tools
                    </span>
                    <button onClick={() => setShowAI(false)}>
                      <X className="size-4 text-muted-foreground" />
                    </button>
                  </div>

                  {/* Write for me */}
                  <div className="space-y-2">
                    <input
                      placeholder="Song title, theme, or idea…"
                      value={aiTheme}
                      onChange={(e) => setAiTheme(e.target.value)}
                      className="w-full bg-background/60 border border-border/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/60"
                    />
                    {/* Style */}
                    <div className="flex gap-1.5">
                      {(["hype", "smooth", "story", "promo"] as AIStyle[]).map((s) => (
                        <button
                          key={s}
                          onClick={() => setAiStyle(s)}
                          className={`flex-1 text-[10px] py-1 rounded font-medium transition-colors capitalize ${
                            aiStyle === s
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted/40 text-muted-foreground hover:bg-muted/60"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                    {/* Duration */}
                    <div className="flex gap-1.5">
                      {([
                        { v: "short" as AIDuration, l: "Short ~15s" },
                        { v: "medium" as AIDuration, l: "Medium ~30s" },
                        { v: "long" as AIDuration, l: "Long ~60s" },
                      ] as { v: AIDuration; l: string }[]).map(({ v, l }) => (
                        <button
                          key={v}
                          onClick={() => setAiDuration(v)}
                          className={`flex-1 text-[10px] py-1 rounded font-medium transition-colors ${
                            aiDuration === v
                              ? "bg-primary/20 text-primary border border-primary/40"
                              : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                          }`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={aiWrite}
                      disabled={aiLoading || !aiTheme.trim()}
                      className="w-full bg-primary text-primary-foreground rounded-lg py-2 text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity"
                    >
                      {aiLoading ? (
                        <><Loader2 className="size-3.5 animate-spin" /> Writing…</>
                      ) : (
                        <><Wand2 className="size-3.5" /> Write for me</>
                      )}
                    </button>
                  </div>

                  {/* Improve existing */}
                  {script.trim() && (
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1.5 font-medium uppercase tracking-wider">
                        Improve existing script
                      </p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {([
                          { v: "improve" as AIAction, l: "✨ Improve" },
                          { v: "longer" as AIAction, l: "➕ Longer" },
                          { v: "shorter" as AIAction, l: "✂️ Shorter" },
                          { v: "hook" as AIAction, l: "🎣 Add Hook" },
                          { v: "punchup" as AIAction, l: "💥 Punch Up" },
                        ] as { v: AIAction; l: string }[]).map(({ v, l }) => (
                          <button
                            key={v}
                            onClick={() => aiImprove(v)}
                            disabled={aiLoading}
                            className="text-[10px] py-1.5 bg-muted/40 hover:bg-primary/20 hover:text-primary text-muted-foreground rounded font-medium transition-colors disabled:opacity-40"
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Toolbar row */}
              <div className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowAI(!showAI)}
                    className={`flex items-center gap-1.5 text-xs transition-colors ${showAI ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <Wand2 className="size-4" />
                    <span>AI Tools</span>
                    {showAI ? <ChevronDown className="size-3" /> : <ChevronUp className="size-3" />}
                  </button>
                  <button className="text-muted-foreground hover:text-foreground transition-colors">
                    <Mic className="size-4" />
                  </button>
                </div>
                <button
                  onClick={generateAll}
                  disabled={isGeneratingAll || !script.trim()}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary disabled:opacity-40 transition-colors"
                >
                  <Zap className="size-3.5" />
                  Generate All ({GENERATE_ALL_COST}✦)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ PREVIEW TAB ══ */}
        {activeTab === "preview" && (
          <div className="h-full flex flex-col items-center justify-start overflow-y-auto py-4 px-4 gap-3">
            {/* Phone-frame portrait preview */}
            <div className="w-full max-w-[240px] mx-auto">
              <div className="aspect-[9/16] rounded-2xl overflow-hidden border border-border/40 bg-muted/20 relative">
                <img
                  src={selectedTemplate.thumbnailPath}
                  alt={selectedTemplate.name}
                  className="w-full h-full object-cover"
                />

                {/* State overlay */}
                {selectedState.status === "loading" && (
                  <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="size-8 animate-spin text-primary" />
                    <span className="text-xs text-white/70">Generating…</span>
                  </div>
                )}
                {selectedState.status === "done" && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3">
                    <CheckCircle2 className="size-8 text-green-400" />
                    <span className="text-xs text-white font-medium">Ready to play</span>
                  </div>
                )}
                {selectedState.status === "error" && (
                  <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2 p-3">
                    <AlertCircle className="size-7 text-red-400" />
                    <span className="text-[10px] text-red-300 text-center leading-tight">
                      {selectedState.message}
                    </span>
                  </div>
                )}
                {selectedState.status === "idle" && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
                      <Play className="size-5 text-white ml-0.5" />
                    </div>
                  </div>
                )}

                {/* Kind + cost badge */}
                <div className="absolute top-2 left-2 flex gap-1">
                  <span className="bg-black/60 backdrop-blur-sm text-white/70 text-[9px] px-1.5 py-0.5 rounded">
                    {selectedTemplate.kind === "heygen-avatar"
                      ? "HeyGen"
                      : selectedTemplate.kind === "photo"
                        ? "Photo"
                        : "Video"}
                  </span>
                </div>
                <div className="absolute top-2 right-2">
                  <span className="bg-primary/80 text-white text-[9px] px-1.5 py-0.5 rounded font-medium">
                    {templateCost(selectedTemplate.kind)}✦
                  </span>
                </div>
              </div>
            </div>

            {/* Playback controls */}
            <div className="w-full max-w-[300px] aurora-panel rounded-xl px-3 py-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium truncate">{selectedTemplate.name}</span>
                <span className="text-[10px] text-muted-foreground">{estDuration} est.</span>
              </div>
              <div className="flex items-center gap-3">
                <button className="text-muted-foreground hover:text-foreground">
                  <SkipBack className="size-3.5" />
                </button>
                <button className="text-muted-foreground hover:text-foreground">
                  <Play className="size-3.5" />
                </button>
                <div className="flex-1 h-1 bg-muted/40 rounded-full">
                  <div className="w-0 h-full bg-primary rounded-full" />
                </div>
                <button className="text-muted-foreground hover:text-foreground">
                  <Volume2 className="size-3.5" />
                </button>
              </div>
              {/* Timeline strip */}
              <div className="flex gap-1.5 mt-2">
                <div className="h-10 w-16 rounded overflow-hidden border border-border/30 relative shrink-0">
                  <img
                    src={selectedTemplate.thumbnailPath}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-0.5 right-0.5 bg-black/60 rounded text-[8px] text-white px-0.5">
                    {estDuration}
                  </div>
                </div>
                <div className="flex-1 h-10 border-2 border-dashed border-border/30 rounded flex items-center justify-center text-muted-foreground/40">
                  <span className="text-[9px]">+ Add scene</span>
                </div>
              </div>
            </div>

            {/* If generated — show result video */}
            {selectedState.status === "done" && (
              <div className="w-full max-w-[300px] aurora-panel rounded-xl overflow-hidden">
                <video
                  src={selectedState.url}
                  controls
                  autoPlay
                  className="w-full max-h-64 bg-black"
                />
                <div className="p-2 flex justify-end">
                  <button
                    onClick={() => {
                      const url = (selectedState as { status: "done"; url: string }).url;
                      fetch(url)
                        .then((r) => r.blob())
                        .then((b) => {
                          const a = document.createElement("a");
                          a.href = URL.createObjectURL(b);
                          a.download = `${selectedTemplate.name.replace(/\s+/g, "-").toLowerCase()}.mp4`;
                          a.click();
                        });
                    }}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <Download className="size-3" /> Download
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ AVATARS TAB ══ */}
        {activeTab === "avatars" && (
          <div className="h-full overflow-y-auto">
            {/* Avatar & Voice header */}
            <div className="px-4 py-3 border-b border-border/20">
              <h2 className="text-xs font-semibold text-foreground/70 uppercase tracking-wider mb-3">
                Avatar & Voice
              </h2>

              {/* Currently selected */}
              <div className="flex items-center gap-3 bg-muted/20 rounded-xl p-2.5 mb-3">
                <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-border/30">
                  <img
                    src={selectedTemplate.thumbnailPath}
                    alt={selectedTemplate.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{selectedTemplate.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {selectedTemplate.kind === "heygen-avatar"
                      ? "HeyGen Avatar"
                      : selectedTemplate.kind === "photo"
                        ? "Photo Avatar"
                        : "Video Avatar"}
                  </p>
                </div>
                <span className="text-xs text-primary font-medium shrink-0">
                  {templateCost(selectedTemplate.kind)}✦
                </span>
              </div>

              {/* Voice selector — show for heygen-avatar primarily */}
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 font-medium">
                  Voice (HeyGen Avatars)
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {VOICES.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVoice(v.id as VoiceId)}
                      className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${
                        selectedVoice === v.id
                          ? "bg-primary/15 border border-primary/40"
                          : "bg-muted/20 border border-border/30 hover:border-primary/30"
                      }`}
                    >
                      <Mic className="size-3 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium truncate">{v.name}</p>
                        <p className="text-[9px] text-muted-foreground">{v.tag}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── FEATURED templates ── */}
            {FEATURED_TEMPLATES.length > 0 && (
              <div className="px-4 py-3">
                <p className="text-[10px] uppercase tracking-wider mb-2 font-semibold flex items-center gap-1.5">
                  <span className="text-amber-400">★</span>
                  <span className="text-amber-400/90">Best Picks</span>
                </p>
                <div className="grid grid-cols-3 gap-2 mb-1">
                  {FEATURED_TEMPLATES.map((tpl) => (
                    <TemplateCard
                      key={tpl.id}
                      tpl={tpl}
                      state={cardStates[tpl.id] ?? { status: "idle" }}
                      isSelected={tpl.id === selectedId}
                      featured
                      onSelect={() => { setSelectedId(tpl.id); setActiveTab("preview"); }}
                      onGenerate={(e) => {
                        e.stopPropagation();
                        const trimmed = script.trim();
                        if (!trimmed) { toast.error("Write your script first"); setActiveTab("script"); return; }
                        generateOne(tpl.id, trimmed);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── All other templates ── */}
            <div className="px-4 pb-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 font-medium">
                All Templates ({PLATFORM_TEMPLATES.length})
              </p>
              <div className="grid grid-cols-2 gap-2">
                {OTHER_TEMPLATES.map((tpl) => (
                  <TemplateCard
                    key={tpl.id}
                    tpl={tpl}
                    state={cardStates[tpl.id] ?? { status: "idle" }}
                    isSelected={tpl.id === selectedId}
                    featured={false}
                    onSelect={() => { setSelectedId(tpl.id); setActiveTab("preview"); }}
                    onGenerate={(e) => {
                      e.stopPropagation();
                      const trimmed = script.trim();
                      if (!trimmed) { toast.error("Write your script first"); setActiveTab("script"); return; }
                      generateOne(tpl.id, trimmed);
                    }}
                  />
                ))}
              </div>
            </div>

            {/* My Avatars section */}
            <div className="px-4 pb-4">
              <div className="border-t border-border/20 pt-4 mt-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3 font-medium flex items-center gap-1.5">
                  My Custom Avatars
                  <span className="text-[9px] bg-muted/50 px-1.5 rounded">Upload your photo/video</span>
                </p>

                {/* Upload zone */}
                <div
                  className="border-2 border-dashed border-border/40 rounded-xl p-4 flex flex-col items-center gap-2 cursor-pointer hover:border-primary/50 transition-colors mb-3"
                  onClick={() => fileRef.current?.click()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files[0];
                    if (f) handleFile(f);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                >
                  <input
                    ref={fileRef}
                    type="file"
                    accept={ACCEPT}
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFile(f);
                      e.target.value = "";
                    }}
                  />
                  {preview ? (
                    file?.type.startsWith("video") ? (
                      <video src={preview} className="max-h-24 rounded-lg" muted playsInline />
                    ) : (
                      <img src={preview} alt="preview" className="max-h-24 rounded-lg object-contain" />
                    )
                  ) : (
                    <>
                      <ImagePlus className="size-6 text-muted-foreground/50" />
                      <p className="text-[10px] text-muted-foreground text-center">
                        Drop photo or video · JPG · PNG · MP4
                      </p>
                    </>
                  )}
                </div>

                {file && (
                  <div className="flex gap-2 mb-3">
                    <input
                      placeholder="Name this avatar…"
                      value={avatarName}
                      onChange={(e) => setAvatarName(e.target.value)}
                      className="flex-1 bg-background/60 border border-border/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/60"
                    />
                    <button
                      onClick={handleSave}
                      disabled={uploading || !avatarName.trim()}
                      className="bg-primary text-primary-foreground px-3 py-2 rounded-lg text-xs font-medium disabled:opacity-50"
                    >
                      {uploading ? <Loader2 className="size-3.5 animate-spin" /> : "Save"}
                    </button>
                    <button
                      onClick={() => { setFile(null); setPreview(null); setAvatarName(""); }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                )}

                {/* My avatar grid */}
                {listLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="size-4 animate-spin text-primary" />
                  </div>
                ) : myAvatars.length === 0 ? (
                  <p className="text-center py-4 text-[11px] text-muted-foreground/60">
                    No custom avatars yet. Upload your photo or video above.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {myAvatars.map((av) => {
                      const isVideo = av.storage_path.match(/\.(mp4|mov|webm)$/i);
                      return (
                        <div
                          key={av.id}
                          className={`aurora-panel rounded-xl overflow-hidden cursor-pointer transition-all ${
                            activeAvatar?.id === av.id
                              ? "ring-2 ring-primary"
                              : "hover:ring-1 hover:ring-primary/40"
                          }`}
                          onClick={() => {
                            setActiveAvatar(av);
                            setAvatarResult(null);
                          }}
                        >
                          <div className="aspect-square bg-muted/20 relative">
                            {av.signedUrl ? (
                              isVideo ? (
                                <video src={av.signedUrl} className="w-full h-full object-cover" muted playsInline />
                              ) : (
                                <img src={av.signedUrl} alt={av.name} className="w-full h-full object-cover" />
                              )
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Upload className="size-5 text-muted-foreground/30" />
                              </div>
                            )}
                          </div>
                          <div className="px-1.5 py-1 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                            <p className="text-[10px] font-medium truncate flex-1 mr-0.5">{av.name}</p>
                            <button
                              onClick={async () => {
                                await deleteFn({ data: { id: av.id } });
                                toast.success("Deleted");
                                qc.invalidateQueries({ queryKey: ["photo-avatars"] });
                                if (activeAvatar?.id === av.id) setActiveAvatar(null);
                              }}
                              className="text-muted-foreground hover:text-red-400"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Personal avatar generate panel */}
                {activeAvatar && (
                  <div className="aurora-panel rounded-xl p-3 space-y-2">
                    <p className="text-xs font-medium">
                      Generate with <strong>{activeAvatar.name}</strong>
                    </p>
                    <textarea
                      placeholder="Script for this avatar…"
                      value={avatarScript}
                      onChange={(e) => setAvatarScript(e.target.value)}
                      rows={3}
                      className="w-full bg-background/60 border border-border/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/60 resize-none"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">
                        {PHOTO_AVATAR_COST}✦ Aura
                      </span>
                      <button
                        onClick={generateAvatar}
                        disabled={avatarGenerating || !avatarScript.trim()}
                        className="bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {avatarGenerating ? (
                          <><Loader2 className="size-3 animate-spin" />Generating…</>
                        ) : (
                          <><Sparkles className="size-3" />Generate</>
                        )}
                      </button>
                    </div>
                    {avatarResult && (
                      <div className="rounded-lg overflow-hidden border border-border/30">
                        <video src={avatarResult} controls className="w-full max-h-48" />
                        <div className="p-1.5 flex justify-end bg-background/40">
                          <button
                            className="text-[10px] text-primary flex items-center gap-1"
                            onClick={() => {
                              fetch(avatarResult).then((r) => r.blob()).then((b) => {
                                const a = document.createElement("a");
                                a.href = URL.createObjectURL(b);
                                a.download = `${activeAvatar.name}.mp4`;
                                a.click();
                              });
                            }}
                          >
                            <Download className="size-3" /> Download
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══ SHOTS TAB ══ */}
        {activeTab === "shots" && (
          <div className="h-full overflow-y-auto">
            {/* Header */}
            <div className="px-4 pt-4 pb-3 border-b border-border/20 bg-muted/10 shrink-0">
              <h3 className="text-sm font-semibold mb-0.5">Avatar Shots</h3>
              <p className="text-[11px] text-muted-foreground">
                Generate AI portraits &amp; live videos with SeedDream, Gemini Omni, or KlingAI
              </p>
            </div>

            {/* Engine picker */}
            <div className="px-4 pt-3 pb-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-medium">
                AI Engine
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    {
                      id: "seedream" as ShotEngine,
                      label: "SeedDream",
                      sub: "Portrait",
                      cost: SHOT_IMAGE_COST,
                      icon: "🌱",
                      kind: "image" as const,
                    },
                    {
                      id: "gemini" as ShotEngine,
                      label: "Gemini Omni",
                      sub: "Enhanced",
                      cost: SHOT_IMAGE_COST,
                      icon: "✨",
                      kind: "image" as const,
                    },
                    {
                      id: "kling" as ShotEngine,
                      label: "KlingAI",
                      sub: "Live Video",
                      cost: SHOT_KLING_COST,
                      icon: "🎬",
                      kind: "video" as const,
                    },
                  ] satisfies { id: ShotEngine; label: string; sub: string; cost: number; icon: string; kind: "image" | "video" }[]
                ).map((eng) => (
                  <button
                    key={eng.id}
                    onClick={() => setShotEngine(eng.id)}
                    className={`flex flex-col items-center gap-0.5 px-2 py-2.5 rounded-xl border text-center transition-all ${
                      shotEngine === eng.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/30 bg-background/40 text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    <span className="text-base">{eng.icon}</span>
                    <span className="text-[10px] font-semibold leading-tight">{eng.label}</span>
                    <span className="text-[9px] opacity-60">{eng.sub}</span>
                    <span className="text-[9px] font-medium mt-0.5 text-primary/80">
                      {eng.cost}✦
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Optional reference photo picker (SeedDream / Gemini only) */}
            {shotEngine !== "kling" && myAvatars.length > 0 && (
              <div className="px-4 pb-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-medium">
                  Reference photo <span className="normal-case opacity-60">(optional — locks identity)</span>
                </p>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  <button
                    onClick={() => setShotAvatarUrl(null)}
                    className={`shrink-0 w-10 h-10 rounded-lg border text-[9px] flex items-center justify-center transition-all ${
                      !shotAvatarUrl
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/30 bg-background/40 text-muted-foreground"
                    }`}
                  >
                    None
                  </button>
                  {myAvatars.map((av) => (
                    <button
                      key={av.id}
                      onClick={() => setShotAvatarUrl(av.signedUrl || null)}
                      title={av.name}
                      className={`shrink-0 w-10 h-10 rounded-lg border overflow-hidden transition-all ${
                        shotAvatarUrl === av.signedUrl
                          ? "border-primary ring-1 ring-primary"
                          : "border-border/30 hover:border-primary/40"
                      }`}
                    >
                      {av.signedUrl ? (
                        <img src={av.signedUrl} alt={av.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-muted/30 flex items-center justify-center">
                          <span className="text-[8px] text-muted-foreground">?</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Prompt */}
            <div className="px-4 pb-3">
              <textarea
                placeholder={
                  shotEngine === "kling"
                    ? "Describe the scene: 'Rapper in neon-lit studio, confident energy, cinematic camera move…'"
                    : "Describe your avatar shot: 'Professional rapper portrait, studio lighting, dark background…'"
                }
                value={shotPrompt}
                onChange={(e) => setShotPrompt(e.target.value)}
                rows={3}
                className="w-full bg-background/60 border border-border/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/60 resize-none mb-2"
              />
              <button
                onClick={async () => {
                  const trimmed = shotPrompt.trim();
                  if (!trimmed) return toast.error("Enter a prompt first");
                  setShotLoading(true);
                  try {
                    const res = await shotFn({
                      data: {
                        prompt: trimmed,
                        engine: shotEngine,
                        imageUrl: shotEngine !== "kling" && shotAvatarUrl ? shotAvatarUrl : undefined,
                      },
                    });
                    if (!res.ok) {
                      toast.error(res.error ?? "Generation failed");
                    } else {
                      const kind = shotEngine === "kling" ? "video" : "image";
                      setShotResults((prev) => [{ url: res.url, engine: shotEngine, kind }, ...prev]);
                      toast.success("Shot ready!");
                      saveShotFn({
                        data: { sourceUrl: res.url, engine: shotEngine, kind, prompt: trimmed },
                      })
                        .then(() => { void refetchShots(); })
                        .catch(() => { /* best-effort */ });
                    }
                  } catch {
                    toast.error("Generation failed");
                  } finally {
                    setShotLoading(false);
                  }
                }}
                disabled={shotLoading || !shotPrompt.trim()}
                className="w-full py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 hover:bg-primary/90 transition-colors"
              >
                {shotLoading ? (
                  <><Loader2 className="size-4 animate-spin" />Generating…</>
                ) : (
                  <><Sparkles className="size-4" />Generate · {shotEngine === "kling" ? SHOT_KLING_COST : SHOT_IMAGE_COST}✦</>
                )}
              </button>
            </div>

            {/* Results */}
            {shotResults.length > 0 && (
              <div className="px-4 pb-6">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-medium">
                  Generated Shots ({shotResults.length})
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {shotResults.map((r, i) => (
                    <div key={i} className="aurora-panel rounded-xl overflow-hidden">
                      {r.kind === "video" ? (
                        <video
                          src={r.url}
                          controls
                          playsInline
                          className="w-full aspect-video object-cover"
                        />
                      ) : (
                        <img
                          src={r.url}
                          alt={`Shot ${i + 1}`}
                          className="w-full aspect-square object-cover"
                          loading="lazy"
                        />
                      )}
                      <div className="p-1.5 flex items-center justify-between">
                        <span className="text-[9px] text-muted-foreground capitalize">
                          {r.engine === "kling" ? "KlingAI" : r.engine === "gemini" ? "Gemini" : "SeedDream"}
                        </span>
                        <button
                          onClick={() => {
                            fetch(r.url).then((res) => res.blob()).then((b) => {
                              const a = document.createElement("a");
                              a.href = URL.createObjectURL(b);
                              a.download = `avatar-shot-${Date.now()}.${r.kind === "video" ? "mp4" : "jpg"}`;
                              a.click();
                            });
                          }}
                          className="text-[9px] text-primary flex items-center gap-0.5"
                        >
                          <Download className="size-3" />Save
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {shotResults.length === 0 && !shotLoading && savedShots.length === 0 && (
              <div className="px-4 py-6 text-center text-muted-foreground/50">
                <div className="text-3xl mb-2">🎨</div>
                <p className="text-xs">
                  {shotEngine === "kling"
                    ? "Describe a scene and KlingAI will create a live avatar video"
                    : "Describe your avatar and get an AI-generated portrait"}
                </p>
              </div>
            )}

            {/* ── My Shots gallery (persisted across sessions) ──────────── */}
            {savedShots.length > 0 && (
              <div className="px-4 pb-6">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-medium">
                  My Shots ({savedShots.length})
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {savedShots.map((shot: SavedAvatarShot) => (
                    <div key={shot.id} className="aurora-panel rounded-xl overflow-hidden">
                      {shot.kind === "video" ? (
                        <video
                          src={shot.signedUrl}
                          controls
                          playsInline
                          className="w-full aspect-video object-cover"
                        />
                      ) : (
                        <img
                          src={shot.signedUrl}
                          alt={shot.prompt.slice(0, 40) || "Avatar shot"}
                          className="w-full aspect-square object-cover"
                          loading="lazy"
                        />
                      )}
                      <div className="p-1.5 flex items-center justify-between gap-1 min-w-0">
                        <span className="text-[9px] text-muted-foreground capitalize truncate">
                          {shot.engine === "kling"
                            ? "KlingAI"
                            : shot.engine === "gemini"
                              ? "Gemini"
                              : "SeedDream"}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => {
                              fetch(shot.signedUrl)
                                .then((r) => r.blob())
                                .then((b) => {
                                  const a = document.createElement("a");
                                  a.href = URL.createObjectURL(b);
                                  a.download = `avatar-shot-${shot.id.slice(0, 8)}.${shot.kind === "video" ? "mp4" : "jpg"}`;
                                  a.click();
                                });
                            }}
                            className="text-[9px] text-primary flex items-center gap-0.5"
                            title="Download"
                          >
                            <Download className="size-3" />
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                await deleteShotFn({ data: { id: shot.id } });
                                void refetchShots();
                              } catch {
                                toast.error("Delete failed");
                              }
                            }}
                            className="text-[9px] text-destructive/70 flex items-center gap-0.5 hover:text-destructive"
                            title="Delete"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Reusable template card ───────────────────────────────────────────────────

function TemplateCard({
  tpl,
  state,
  isSelected,
  featured,
  onSelect,
  onGenerate,
}: {
  tpl: PlatformTemplate;
  state: CardState;
  isSelected: boolean;
  featured: boolean;
  onSelect: () => void;
  onGenerate: (e: React.MouseEvent) => void;
}) {
  const kindLabel =
    tpl.kind === "heygen-avatar"
      ? "HeyGen"
      : tpl.kind === "photo"
        ? "Photo"
        : tpl.kind === "live"
          ? "Kling"
          : "Video";

  return (
    <div
      className={`rounded-xl overflow-hidden cursor-pointer transition-all flex flex-col ${
        featured
          ? isSelected
            ? "ring-2 ring-amber-400 bg-amber-400/5 border border-amber-400/30"
            : "border border-amber-400/20 bg-amber-400/5 hover:ring-2 hover:ring-amber-400/50"
          : isSelected
            ? "aurora-panel ring-2 ring-primary"
            : "aurora-panel hover:ring-1 hover:ring-primary/40"
      }`}
      onClick={onSelect}
    >
      {/* Thumbnail */}
      <div className="aspect-[9/16] bg-background/40 relative">
        <img
          src={tpl.thumbnailPath}
          alt={tpl.name}
          className="w-full h-full object-cover"
          loading="lazy"
        />

        {/* Loading overlay */}
        {state.status === "loading" && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <Loader2 className="size-4 animate-spin text-primary" />
          </div>
        )}

        {/* Done / error status */}
        {state.status === "done" && (
          <div className="absolute top-1 right-1">
            <CheckCircle2 className="size-3.5 text-green-400 drop-shadow" />
          </div>
        )}
        {state.status === "error" && (
          <div className="absolute top-1 right-1">
            <AlertCircle className="size-3.5 text-red-400 drop-shadow" />
          </div>
        )}

        {/* Selected ring */}
        {isSelected && (
          <div
            className={`absolute inset-0 rounded-xl border-2 ${
              featured ? "border-amber-400/70 bg-amber-400/10" : "border-primary bg-primary/10"
            }`}
          />
        )}

        {/* Kind badge */}
        <div className="absolute top-1 left-1 bg-black/55 backdrop-blur-sm rounded px-1 py-0.5">
          <span className="text-[7px] text-white/70">{kindLabel}</span>
        </div>

        {/* Featured label OR cost badge */}
        {featured && tpl.featuredLabel ? (
          <div className="absolute bottom-1 left-0 right-0 flex justify-center">
            <span className="bg-amber-400/90 text-black text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow">
              {tpl.featuredLabel}
            </span>
          </div>
        ) : (
          <div className="absolute bottom-1 right-1 bg-primary/80 rounded px-1 py-0.5">
            <span className="text-[7px] text-white font-medium">{templateCost(tpl.kind)}✦</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-1.5 flex-1 flex flex-col justify-between gap-1">
        <p className={`text-[10px] font-semibold truncate ${featured ? "text-amber-300" : ""}`}>
          {tpl.name}
        </p>
        <button
          onClick={onGenerate}
          disabled={state.status === "loading"}
          className={`w-full text-[9px] py-1 rounded font-medium transition-colors flex items-center justify-center gap-0.5 ${
            state.status === "done"
              ? "bg-green-500/15 text-green-400"
              : state.status === "error"
                ? "bg-red-500/15 text-red-400"
                : featured
                  ? "bg-amber-400/15 text-amber-400 hover:bg-amber-400/25 disabled:opacity-40"
                  : "bg-primary/15 text-primary hover:bg-primary/25 disabled:opacity-40"
          }`}
        >
          {state.status === "loading" ? (
            <><Loader2 className="size-2.5 animate-spin" />{tpl.kind === "live" ? "Animating…" : "Gen…"}</>
          ) : state.status === "done" ? (
            "✓ Retry"
          ) : state.status === "error" ? (
            "Retry"
          ) : tpl.kind === "live" ? (
            <><Sparkles className="size-2.5" />Animate</>
          ) : (
            <><Sparkles className="size-2.5" />Gen</>
          )}
        </button>
      </div>
    </div>
  );
}
