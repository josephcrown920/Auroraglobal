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
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Upload,
  UserCircle2,
  Trash2,
  Loader2,
  Play,
  X,
  Sparkles,
  Film,
  Zap,
  CheckCircle2,
  AlertCircle,
  Download,
} from "lucide-react";

export const Route = createFileRoute("/avatar")({
  component: AvatarPage,
  head: () => ({
    meta: [
      { title: "Content Campaign — Aurora" },
      {
        name: "description",
        content:
          "Generate your script across all avatar templates at once. One script, full content package.",
      },
    ],
  }),
});

// ─── types ───────────────────────────────────────────────────────────────────

type CardState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; url: string }
  | { status: "error"; message: string };

const ACCEPT = "image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm";

// ─── Upload helper ────────────────────────────────────────────────────────────

async function uploadToStudio(file: File, userId: string): Promise<string> {
  const ext = file.name.split(".").pop() ?? (file.type.startsWith("video") ? "mp4" : "jpg");
  const path = `${userId}/avatars/${Date.now()}-photo.${ext}`;
  const { error } = await supabase.storage.from("studio").upload(path, file, {
    contentType: file.type,
    upsert: true,
  });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return path;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function AvatarPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  // Shared script state
  const [script, setScript] = useState("");

  // Per-template card state
  const [cardStates, setCardStates] = useState<Record<string, CardState>>(
    Object.fromEntries(PLATFORM_TEMPLATES.map((t) => [t.id, { status: "idle" }])),
  );

  // Upload form
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [uploading, setUploading] = useState(false);

  // Personal avatar generation
  const [activeAvatar, setActiveAvatar] = useState<PhotoAvatarWithUrl | null>(null);
  const [avatarScript, setAvatarScript] = useState("");
  const [avatarResult, setAvatarResult] = useState<string | null>(null);
  const [avatarGenerating, setAvatarGenerating] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  const saveFn = useServerFn(savePhotoAvatar);
  const listFn = useServerFn(listPhotoAvatars);
  const deleteFn = useServerFn(deletePhotoAvatar);
  const generatePhotoFn = useServerFn(generateFromPhotoAvatar);
  const generateTemplateFn = useServerFn(generateFromPlatformTemplate);

  const { data: avatars = [], isLoading: listLoading } = useQuery({
    queryKey: ["photo-avatars"],
    queryFn: () => listFn(),
    enabled: !!user,
  });

  // ─── Generate a single template ───────────────────────────────────────────

  const generateOne = useCallback(
    async (templateId: string, scriptText: string) => {
      setCardStates((prev) => ({ ...prev, [templateId]: { status: "loading" } }));
      try {
        const res = await generateTemplateFn({ data: { templateId, script: scriptText.trim() } });
        if (res.ok) {
          setCardStates((prev) => ({ ...prev, [templateId]: { status: "done", url: res.url } }));
        } else {
          setCardStates((prev) => ({
            ...prev,
            [templateId]: { status: "error", message: res.error },
          }));
          if (res.insufficient) toast.error("Not enough Aura credits");
        }
      } catch (e) {
        setCardStates((prev) => ({
          ...prev,
          [templateId]: { status: "error", message: e instanceof Error ? e.message : "Failed" },
        }));
      }
    },
    [generateTemplateFn],
  );

  // ─── Generate ALL templates in parallel ───────────────────────────────────

  const generateAll = useCallback(async () => {
    const trimmed = script.trim();
    if (!trimmed) return toast.error("Write your script first");
    // Set all to loading immediately
    setCardStates(
      Object.fromEntries(PLATFORM_TEMPLATES.map((t) => [t.id, { status: "loading" as const }])),
    );
    // Fire all in parallel — each updates its own card as it resolves
    await Promise.allSettled(PLATFORM_TEMPLATES.map((t) => generateOne(t.id, trimmed)));
    toast.success("All templates generated!");
  }, [script, generateOne]);

  // ─── Personal avatar generation ───────────────────────────────────────────

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
      } else {
        toast.error(res.error, { duration: 6000 });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setAvatarGenerating(false);
    }
  };

  // ─── File pick ────────────────────────────────────────────────────────────

  const handleFile = (f: File) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
    if (!name) setName(f.name.replace(/\.[^.]+$/, ""));
  };

  const handleSave = async () => {
    if (!file || !user) return;
    if (!name.trim()) return toast.error("Give your avatar a name");
    setUploading(true);
    try {
      const storagePath = await uploadToStudio(file, user.id);
      await saveFn({ data: { name: name.trim(), storagePath } });
      toast.success("Avatar saved!");
      setFile(null);
      setPreview(null);
      setName("");
      qc.invalidateQueries({ queryKey: ["photo-avatars"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setUploading(false);
    }
  };

  // ─── Computed stats ───────────────────────────────────────────────────────

  const doneCount = Object.values(cardStates).filter((s) => s.status === "done").length;
  const loadingCount = Object.values(cardStates).filter((s) => s.status === "loading").length;
  const isRunningAll = loadingCount > 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="aurora-page-shell min-h-screen">
      <div className="aurora-ambient pointer-events-none" />

      <div className="relative z-10 max-w-3xl mx-auto px-4 py-10 space-y-8">

        {/* ── Header ── */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Film className="size-5 text-primary" />
            <h1 className="text-xl font-bold">Content Campaign</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Write your script once — generate it across all your avatar templates simultaneously.
          </p>
        </div>

        {/* ── Script input ── */}
        <div className="aurora-panel rounded-xl p-5">
          <label className="text-xs font-semibold uppercase tracking-wider text-foreground/60 mb-2 block">
            Your Script
          </label>
          <textarea
            placeholder="Write what you want all your avatars to say — a verse, a hook, a promo…"
            value={script}
            onChange={(e) => setScript(e.target.value)}
            rows={4}
            className="w-full bg-background/60 border border-border/50 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary/60 resize-none mb-4"
          />

          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              {isRunningAll ? (
                <span className="flex items-center gap-1.5 text-primary">
                  <Loader2 className="size-3.5 animate-spin" />
                  {loadingCount} generating… {doneCount} done
                </span>
              ) : doneCount > 0 ? (
                <span className="flex items-center gap-1.5 text-green-400">
                  <CheckCircle2 className="size-3.5" />
                  {doneCount} of {PLATFORM_TEMPLATES.length} completed
                </span>
              ) : (
                <span>
                  Total:{" "}
                  <span className="text-foreground font-medium">{GENERATE_ALL_COST} Aura</span> for
                  all {PLATFORM_TEMPLATES.length} templates
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={isRunningAll || !script.trim()}
                onClick={() =>
                  setCardStates(
                    Object.fromEntries(PLATFORM_TEMPLATES.map((t) => [t.id, { status: "idle" }])),
                  )
                }
                className="text-xs h-8"
              >
                Reset
              </Button>
              <Button
                onClick={generateAll}
                disabled={isRunningAll || !script.trim()}
                className="aurora-button-premium h-8 text-xs px-4"
              >
                {isRunningAll ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin mr-1.5" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Zap className="size-3.5 mr-1.5" />
                    Generate All Templates
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* ── Template grid ── */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground/60 mb-3 flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-primary" />
            Templates ({PLATFORM_TEMPLATES.length})
          </h2>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {PLATFORM_TEMPLATES.map((tpl) => (
              <TemplateCard
                key={tpl.id}
                template={tpl}
                state={cardStates[tpl.id] ?? { status: "idle" }}
                onGenerate={() => {
                  const trimmed = script.trim();
                  if (!trimmed) return toast.error("Write your script first");
                  generateOne(tpl.id, trimmed);
                }}
                disabled={isRunningAll}
              />
            ))}
          </div>
        </div>

        {/* ── My Avatars ── */}
        <div className="aurora-panel rounded-xl p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground/60 mb-4 flex items-center gap-1.5">
            <UserCircle2 className="size-3.5" />
            My Avatars
          </h2>

          {/* Upload zone */}
          <div
            className="border-2 border-dashed border-border/50 rounded-lg p-4 flex flex-col items-center gap-2 cursor-pointer hover:border-primary/50 transition-colors mb-4"
            onClick={() => fileRef.current?.click()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            onDragOver={(e) => e.preventDefault()}
          >
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
            />
            {preview ? (
              file?.type.startsWith("video") ? (
                <video src={preview} className="max-h-32 rounded-lg object-contain" muted playsInline />
              ) : (
                <img src={preview} alt="preview" className="max-h-32 rounded-lg object-contain" />
              )
            ) : (
              <>
                <Upload className="size-6 text-muted-foreground" />
                <p className="text-xs text-muted-foreground text-center">
                  Drop photo or video · JPG · PNG · MP4 · MOV
                </p>
              </>
            )}
          </div>

          {file && (
            <div className="flex gap-2 items-center mb-4">
              <input
                type="text"
                placeholder="Name this avatar…"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 bg-background/60 border border-border/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/60"
              />
              <Button onClick={handleSave} disabled={uploading || !name.trim()} className="aurora-button-premium shrink-0 h-9 text-xs">
                {uploading ? <Loader2 className="size-3.5 animate-spin" /> : "Save"}
              </Button>
              <button onClick={() => { setFile(null); setPreview(null); setName(""); }} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>
          )}

          {listLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="size-4 animate-spin text-primary" /></div>
          ) : avatars.length === 0 ? (
            <p className="text-center py-6 text-xs text-muted-foreground">No personal avatars yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {avatars.map((av) => (
                <PersonalAvatarCard
                  key={av.id}
                  avatar={av}
                  isActive={activeAvatar?.id === av.id}
                  onSelect={() => {
                    setActiveAvatar(av);
                    setAvatarScript("");
                    setAvatarResult(null);
                  }}
                  onDelete={async () => {
                    await deleteFn({ data: { id: av.id } });
                    toast.success("Avatar deleted");
                    qc.invalidateQueries({ queryKey: ["photo-avatars"] });
                    if (activeAvatar?.id === av.id) setActiveAvatar(null);
                  }}
                />
              ))}
            </div>
          )}

          {/* Personal avatar generation panel */}
          {activeAvatar && (
            <div className="mt-4 pt-4 border-t border-border/30">
              <p className="text-xs font-medium mb-2">
                Generate with <strong>{activeAvatar.name}</strong>
              </p>
              <textarea
                placeholder="Script for this avatar…"
                value={avatarScript}
                onChange={(e) => setAvatarScript(e.target.value)}
                rows={3}
                className="w-full bg-background/60 border border-border/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/60 resize-none mb-2"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Cost: <span className="text-foreground font-medium">{PHOTO_AVATAR_COST} Aura</span>
                </span>
                <Button
                  onClick={generateAvatar}
                  disabled={avatarGenerating || !avatarScript.trim()}
                  className="aurora-button-premium h-8 text-xs"
                >
                  {avatarGenerating ? <><Loader2 className="size-3.5 animate-spin mr-1" />Generating…</> : <><Sparkles className="size-3.5 mr-1" />Generate</>}
                </Button>
              </div>
              {avatarResult && (
                <div className="mt-3 rounded-lg overflow-hidden border border-border/40">
                  <video src={avatarResult} controls autoPlay className="w-full max-h-80" />
                  <div className="p-2 flex justify-end bg-background/40">
                    <button
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                      onClick={() => {
                        fetch(avatarResult).then((r) => r.blob()).then((b) => {
                          const a = document.createElement("a");
                          a.href = URL.createObjectURL(b);
                          a.download = `${activeAvatar.name}-video.mp4`;
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
  );
}

// ─── Template card ─────────────────────────────────────────────────────────

function TemplateCard({
  template,
  state,
  onGenerate,
  disabled,
}: {
  template: PlatformTemplate;
  state: CardState;
  onGenerate: () => void;
  disabled: boolean;
}) {
  const kindBadge =
    template.kind === "heygen-avatar" ? "HeyGen" : template.kind === "photo" ? "Photo" : "Video";

  return (
    <div className="aurora-panel rounded-xl overflow-hidden flex flex-col">
      {/* Thumbnail */}
      <div className="aspect-[9/16] bg-background/40 relative">
        <img
          src={template.thumbnailPath}
          alt={template.name}
          className="w-full h-full object-cover"
          loading="lazy"
        />

        {/* Overlay by state */}
        {state.status === "loading" && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2">
            <Loader2 className="size-6 animate-spin text-primary" />
            <span className="text-xs text-white/70">Generating…</span>
          </div>
        )}
        {state.status === "done" && (
          <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-2">
            <CheckCircle2 className="size-7 text-green-400" />
            <button
              className="text-xs text-white bg-white/20 hover:bg-white/30 rounded px-2 py-1 flex items-center gap-1 transition-colors"
              onClick={() => {
                fetch(state.url).then((r) => r.blob()).then((b) => {
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(b);
                  a.download = `${template.name.replace(/\s+/g, "-").toLowerCase()}.mp4`;
                  a.click();
                });
              }}
            >
              <Download className="size-3" />
              Download
            </button>
          </div>
        )}
        {state.status === "error" && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-1 p-2">
            <AlertCircle className="size-5 text-red-400" />
            <span className="text-[10px] text-red-300 text-center leading-tight line-clamp-3">
              {state.message}
            </span>
          </div>
        )}

        {/* Kind badge */}
        <div className="absolute top-1.5 left-1.5 bg-black/60 backdrop-blur-sm rounded px-1.5 py-0.5">
          <span className="text-[9px] text-white/70 font-medium">{kindBadge}</span>
        </div>

        {/* Cost badge */}
        <div className="absolute top-1.5 right-1.5 bg-primary/80 backdrop-blur-sm rounded px-1.5 py-0.5">
          <span className="text-[9px] text-white font-medium">
            {templateCost(template.kind)}✦
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="p-2 flex-1 flex flex-col justify-between gap-1.5">
        <div>
          <p className="text-[11px] font-semibold truncate">{template.name}</p>
          <p className="text-[10px] text-muted-foreground truncate">{template.description}</p>
        </div>
        <button
          onClick={onGenerate}
          disabled={disabled || state.status === "loading"}
          className={`w-full rounded text-[10px] py-1.5 font-medium transition-colors flex items-center justify-center gap-1 ${
            state.status === "done"
              ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
              : state.status === "error"
                ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                : "bg-primary/20 text-primary hover:bg-primary/30 disabled:opacity-40 disabled:cursor-not-allowed"
          }`}
        >
          {state.status === "loading" ? (
            <><Loader2 className="size-3 animate-spin" /> Generating</>
          ) : state.status === "done" ? (
            <><Play className="size-3" /> Play / Retry</>
          ) : state.status === "error" ? (
            <>Retry</>
          ) : (
            <><Sparkles className="size-3" /> Generate</>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Personal avatar card ──────────────────────────────────────────────────

function PersonalAvatarCard({
  avatar,
  isActive,
  onSelect,
  onDelete,
}: {
  avatar: PhotoAvatarWithUrl;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const isVideo = avatar.storage_path.match(/\.(mp4|mov|webm)$/i);
  return (
    <div
      className={`aurora-panel rounded-xl overflow-hidden cursor-pointer transition-all ${isActive ? "ring-2 ring-primary" : "hover:ring-1 hover:ring-primary/40"}`}
      onClick={onSelect}
    >
      <div className="aspect-square bg-background/40 relative">
        {avatar.signedUrl ? (
          isVideo ? (
            <video src={avatar.signedUrl} className="w-full h-full object-cover" muted playsInline />
          ) : (
            <img src={avatar.signedUrl} alt={avatar.name} className="w-full h-full object-cover" />
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <UserCircle2 className="size-8 text-muted-foreground/30" />
          </div>
        )}
        {isActive && (
          <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
            <Play className="size-5 text-primary" />
          </div>
        )}
      </div>
      <div className="px-2 py-1.5 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
        <p className="text-[11px] font-medium truncate flex-1 mr-1">{avatar.name}</p>
        <button onClick={onDelete} className="text-muted-foreground hover:text-red-400 transition-colors shrink-0">
          <Trash2 className="size-3" />
        </button>
      </div>
    </div>
  );
}
