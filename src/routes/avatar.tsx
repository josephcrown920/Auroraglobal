import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  PLATFORM_TEMPLATE_COST,
  type TemplateGenerateResult,
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
  ChevronRight,
  X,
  Sparkles,
  Film,
} from "lucide-react";

export const Route = createFileRoute("/avatar")({
  component: AvatarPage,
  head: () => ({
    meta: [
      { title: "Talking Avatars — Aurora" },
      {
        name: "description",
        content:
          "Pick a template or upload your photo — type any script and get a talking video back.",
      },
    ],
  }),
});

// ─── constants ───────────────────────────────────────────────────────────────

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

// ─── Component ───────────────────────────────────────────────────────────────

function AvatarPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  // upload form
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [uploading, setUploading] = useState(false);

  // active selection — either a platform template or a personal avatar
  type Selection =
    | { kind: "template"; template: PlatformTemplate }
    | { kind: "avatar"; avatar: PhotoAvatarWithUrl };

  const [selection, setSelection] = useState<Selection | null>(null);
  const [script, setScript] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);

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

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Avatar deleted");
      qc.invalidateQueries({ queryKey: ["photo-avatars"] });
      if (selection?.kind === "avatar") setSelection(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  const generateMut = useMutation({
    mutationFn: async (): Promise<TemplateGenerateResult> => {
      if (!selection) throw new Error("Nothing selected");
      if (selection.kind === "template") {
        return generateTemplateFn({
          data: { templateId: selection.template.id, script: script.trim() },
        });
      } else {
        return generatePhotoFn({
          data: { avatarId: selection.avatar.id, script: script.trim() },
        });
      }
    },
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error, { duration: 6000 });
        return;
      }
      toast.success("Video ready!");
      setResultUrl(res.url);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Generation failed"),
  });

  // ─── file pick ───────────────────────────────────────────────────────────

  const handleFile = (f: File) => {
    setFile(f);
    setResultUrl(null);
    const url = URL.createObjectURL(f);
    setPreview(url);
    if (!name) setName(f.name.replace(/\.[^.]+$/, ""));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  // ─── save avatar ─────────────────────────────────────────────────────────

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

  const activeName =
    selection?.kind === "template"
      ? selection.template.name
      : selection?.kind === "avatar"
        ? selection.avatar.name
        : null;

  const activeCost =
    selection?.kind === "template" ? PLATFORM_TEMPLATE_COST : PHOTO_AVATAR_COST;

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

      <div className="relative z-10 max-w-3xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <Film className="size-5 text-primary" />
            <h1 className="text-xl font-bold">Talking Avatars</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Pick a template below, type a script, and get a video of that avatar speaking your words.
          </p>
        </div>

        {/* ── Platform Templates ── */}
        <div className="mb-8">
          <h2 className="text-xs font-semibold mb-3 text-foreground/60 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-primary" />
            Platform Templates
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {PLATFORM_TEMPLATES.map((tpl) => {
              const isActive =
                selection?.kind === "template" && selection.template.id === tpl.id;
              return (
                <TemplateCard
                  key={tpl.id}
                  template={tpl}
                  isActive={isActive}
                  onSelect={() => {
                    setSelection({ kind: "template", template: tpl });
                    setScript("");
                    setResultUrl(null);
                    generateMut.reset();
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* ── Generation panel ── */}
        {selection && (
          <div className="aurora-panel mb-8 p-6 rounded-xl">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <ChevronRight className="size-4 text-primary" />
                <span className="text-sm font-medium">
                  Generate with <strong>{activeName}</strong>
                </span>
              </div>
              <button
                onClick={() => {
                  setSelection(null);
                  setResultUrl(null);
                  generateMut.reset();
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <textarea
              placeholder="Type the script you want this avatar to speak…"
              value={script}
              onChange={(e) => setScript(e.target.value)}
              rows={4}
              className="w-full bg-background/60 border border-border/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/60 resize-none mb-3"
            />

            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-muted-foreground">
                Cost:{" "}
                <span className="text-foreground font-medium">{activeCost} Aura</span>
              </p>
              <Button
                onClick={() => {
                  setResultUrl(null);
                  generateMut.mutate();
                }}
                disabled={generateMut.isPending || !script.trim()}
                className="aurora-button-premium"
              >
                {generateMut.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-2" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4 mr-2" />
                    Generate Video
                  </>
                )}
              </Button>
            </div>

            {resultUrl && (
              <div className="rounded-lg overflow-hidden border border-border/40">
                <video src={resultUrl} controls autoPlay className="w-full max-h-[420px]" />
                <div className="p-3 flex justify-end bg-background/40">
                  <a
                    href={resultUrl}
                    download
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                    onClick={(e) => {
                      e.preventDefault();
                      fetch(resultUrl)
                        .then((r) => r.blob())
                        .then((b) => {
                          const a = document.createElement("a");
                          a.href = URL.createObjectURL(b);
                          a.download = `${activeName ?? "avatar"}-video.mp4`;
                          a.click();
                        });
                    }}
                  >
                    Download video
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── My Avatars ── */}
        <div className="aurora-panel p-6 mb-6 rounded-xl">
          <h2 className="text-xs font-semibold mb-4 text-foreground/60 uppercase tracking-wider flex items-center gap-1.5">
            <UserCircle2 className="size-3.5" />
            My Avatars
          </h2>

          {/* Upload zone */}
          <div
            className="border-2 border-dashed border-border/50 rounded-lg p-5 flex flex-col items-center gap-3 cursor-pointer hover:border-primary/50 transition-colors mb-4"
            onClick={() => fileRef.current?.click()}
            onDrop={handleDrop}
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
                <video src={preview} className="max-h-36 rounded-lg object-contain" muted playsInline />
              ) : (
                <img src={preview} alt="preview" className="max-h-36 rounded-lg object-contain" />
              )
            ) : (
              <>
                <Upload className="size-7 text-muted-foreground" />
                <p className="text-sm text-muted-foreground text-center">
                  Drop your photo or video here
                  <br />
                  <span className="text-xs opacity-60">JPG · PNG · MP4 · MOV</span>
                </p>
              </>
            )}
          </div>

          {file && (
            <div className="flex gap-3 items-center mb-4">
              <input
                type="text"
                placeholder="Name this avatar…"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 bg-background/60 border border-border/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/60"
              />
              <Button
                onClick={handleSave}
                disabled={uploading || !name.trim()}
                className="aurora-button-premium shrink-0"
              >
                {uploading ? <Loader2 className="size-4 animate-spin" /> : <>Save Avatar</>}
              </Button>
              <button
                onClick={() => { setFile(null); setPreview(null); setName(""); }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
          )}

          {/* Avatar grid */}
          {listLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-primary" />
            </div>
          ) : avatars.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <UserCircle2 className="size-9 mx-auto mb-2 opacity-30" />
              No personal avatars yet — upload your first photo above.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {avatars.map((av) => (
                <AvatarCard
                  key={av.id}
                  avatar={av}
                  isActive={selection?.kind === "avatar" && selection.avatar.id === av.id}
                  onSelect={() => {
                    setSelection({ kind: "avatar", avatar: av });
                    setScript("");
                    setResultUrl(null);
                    generateMut.reset();
                  }}
                  onDelete={() => deleteMut.mutate(av.id)}
                  deleting={deleteMut.isPending && deleteMut.variables === av.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Template card ────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  isActive,
  onSelect,
}: {
  template: PlatformTemplate;
  isActive: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className={`aurora-panel rounded-xl overflow-hidden cursor-pointer transition-all ${
        isActive ? "ring-2 ring-primary" : "hover:ring-1 hover:ring-primary/40"
      }`}
      onClick={onSelect}
    >
      <div className="aspect-[9/16] bg-background/40 relative">
        <img
          src={template.thumbnailPath}
          alt={template.name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {isActive && (
          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
            <div className="size-9 rounded-full bg-primary/80 flex items-center justify-center">
              <Play className="size-4 text-white ml-0.5" />
            </div>
          </div>
        )}
        {/* badge */}
        <div className="absolute top-1.5 left-1.5 bg-black/60 backdrop-blur-sm rounded px-1.5 py-0.5">
          <span className="text-[10px] text-white/80 font-medium">Template</span>
        </div>
      </div>
      <div className="px-3 py-2">
        <p className="text-xs font-semibold truncate">{template.name}</p>
        <p className="text-[10px] text-muted-foreground truncate">{template.description}</p>
      </div>
    </div>
  );
}

// ─── Avatar card ──────────────────────────────────────────────────────────────

function AvatarCard({
  avatar,
  isActive,
  onSelect,
  onDelete,
  deleting,
}: {
  avatar: PhotoAvatarWithUrl;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const isVideo = avatar.storage_path.match(/\.(mp4|mov|webm)$/i);

  return (
    <div
      className={`aurora-panel rounded-xl overflow-hidden cursor-pointer transition-all ${
        isActive ? "ring-2 ring-primary" : "hover:ring-1 hover:ring-primary/40"
      }`}
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
            <UserCircle2 className="size-10 text-muted-foreground/30" />
          </div>
        )}
        {isActive && (
          <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
            <Play className="size-6 text-primary" />
          </div>
        )}
      </div>
      <div className="px-3 py-2 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
        <p className="text-xs font-medium truncate flex-1 mr-2">{avatar.name}</p>
        <button
          onClick={onDelete}
          disabled={deleting}
          className="text-muted-foreground hover:text-red-400 transition-colors shrink-0"
        >
          {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
        </button>
      </div>
    </div>
  );
}
