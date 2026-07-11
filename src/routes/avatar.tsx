import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
  templateCost,
  GENERATE_ALL_COST,
} from "@/lib/platform-template.functions";
import { PLATFORM_TEMPLATES, type PlatformTemplate } from "@/lib/platform-templates";
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

export const Route = createFileRoute("/avatar")({
  component: AvatarStudioPage,
  head: () => ({
    meta: [{ title: "Avatar Studio — Aurora" }],
  }),
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
type StudioTab = "script" | "preview" | "avatars";
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
  const [activeTab, setActiveTab] = useState<StudioTab>("script");
  const [script, setScript] = useState("");
  const [selectedId, setSelectedId] = useState(PLATFORM_TEMPLATES[0].id);
  const [selectedVoice, setSelectedVoice] = useState<VoiceId>("m3Fp8hA8nS1Gc1Ne9FIf");
  const [cardStates, setCardStates] = useState<Record<string, CardState>>(
    Object.fromEntries(PLATFORM_TEMPLATES.map((t) => [t.id, { status: "idle" }])),
  );

  // ── AI tools state ──────────────────────────────────────────────────────────
  const [showAI, setShowAI] = useState(false);
  const [aiTheme, setAiTheme] = useState("");
  const [aiStyle, setAiStyle] = useState<AIStyle>("hype");
  const [aiDuration, setAiDuration] = useState<AIDuration>("medium");
  const [aiLoading, setAiLoading] = useState(false);

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
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  // ── server fns ──────────────────────────────────────────────────────────────
  const saveFn = useServerFn(savePhotoAvatar);
  const listFn = useServerFn(listPhotoAvatars);
  const deleteFn = useServerFn(deletePhotoAvatar);
  const generatePhotoFn = useServerFn(generateFromPhotoAvatar);
  const generateTemplateFn = useServerFn(generateFromPlatformTemplate);
  const writeFn = useServerFn(writeAvatarScript);
  const improveFn = useServerFn(improveAvatarScript);

  const { data: myAvatars = [], isLoading: listLoading } = useQuery({
    queryKey: ["photo-avatars"],
    queryFn: () => listFn(),
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
          if (res.insufficient) toast.error("Not enough Aura credits");
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
                <span className="text-[11px] text-muted-foreground font-mono">
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
                <span className="text-[10px] text-muted-foreground font-mono">{estDuration} est.</span>
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

            {/* Template grid */}
            <div className="px-4 py-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 font-medium">
                All Templates ({PLATFORM_TEMPLATES.length})
              </p>
              <div className="grid grid-cols-2 gap-2">
                {PLATFORM_TEMPLATES.map((tpl) => {
                  const state = cardStates[tpl.id] ?? { status: "idle" };
                  const isSelected = tpl.id === selectedId;
                  return (
                    <div
                      key={tpl.id}
                      className={`aurora-panel rounded-xl overflow-hidden cursor-pointer transition-all ${
                        isSelected ? "ring-2 ring-primary" : "hover:ring-1 hover:ring-primary/40"
                      }`}
                      onClick={() => {
                        setSelectedId(tpl.id);
                        setActiveTab("preview");
                      }}
                    >
                      {/* Thumbnail */}
                      <div className="aspect-[9/16] bg-background/40 relative">
                        <img
                          src={tpl.thumbnailPath}
                          alt={tpl.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        {/* State dot */}
                        {state.status === "loading" && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <Loader2 className="size-5 animate-spin text-primary" />
                          </div>
                        )}
                        {state.status === "done" && (
                          <div className="absolute top-1.5 right-1.5">
                            <CheckCircle2 className="size-4 text-green-400 drop-shadow" />
                          </div>
                        )}
                        {state.status === "error" && (
                          <div className="absolute top-1.5 right-1.5">
                            <AlertCircle className="size-4 text-red-400 drop-shadow" />
                          </div>
                        )}
                        {isSelected && (
                          <div className="absolute inset-0 bg-primary/10 border-2 border-primary rounded-xl" />
                        )}
                        <div className="absolute top-1.5 left-1.5 bg-black/50 backdrop-blur-sm rounded px-1 py-0.5">
                          <span className="text-[8px] text-white/70">
                            {tpl.kind === "heygen-avatar"
                              ? "HeyGen"
                              : tpl.kind === "photo"
                                ? "Photo"
                                : "Video"}
                          </span>
                        </div>
                        <div className="absolute bottom-1.5 right-1.5 bg-primary/80 rounded px-1 py-0.5">
                          <span className="text-[8px] text-white font-medium">
                            {templateCost(tpl.kind)}✦
                          </span>
                        </div>
                      </div>
                      {/* Footer */}
                      <div className="p-2">
                        <p className="text-[11px] font-semibold truncate mb-1">{tpl.name}</p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const trimmed = script.trim();
                            if (!trimmed) {
                              toast.error("Write your script first");
                              setActiveTab("script");
                              return;
                            }
                            generateOne(tpl.id, trimmed);
                          }}
                          disabled={state.status === "loading"}
                          className={`w-full text-[10px] py-1.5 rounded font-medium transition-colors flex items-center justify-center gap-1 ${
                            state.status === "done"
                              ? "bg-green-500/15 text-green-400"
                              : state.status === "error"
                                ? "bg-red-500/15 text-red-400"
                                : "bg-primary/15 text-primary hover:bg-primary/25 disabled:opacity-40"
                          }`}
                        >
                          {state.status === "loading" ? (
                            <><Loader2 className="size-3 animate-spin" />Generating</>
                          ) : state.status === "done" ? (
                            "✓ Done · Retry"
                          ) : state.status === "error" ? (
                            "Retry"
                          ) : (
                            <><Sparkles className="size-3" />Generate</>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
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
      </div>
    </div>
  );
}
