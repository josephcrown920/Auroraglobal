import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import {
  Film,
  Plus,
  Trash2,
  Play,
  Loader2,
  Upload,
  User,
  Copy,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  Image as ImageIcon,
  Key,
  Clapperboard,
  ArrowLeft,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  listAuroraTemplates,
  createAuroraTemplate,
  deleteAuroraTemplate,
  generateAuroraTemplateVideo,
  type AuroraTemplateRow,
} from "@/lib/aurora-templates.functions";
import { computeCost } from "@/lib/pricing";
import { AURORA_TEMPLATE_MODEL } from "@/lib/aurora-templates.functions";

export const Route = createLazyFileRoute("/heygen-templates")({ component: HeyGenTemplatesPage });

const TEMPLATE_COST = computeCost({ features: ["video"], model: AURORA_TEMPLATE_MODEL }).total;

// ─── Add Template Sheet Fields ─────────────────────────────────────────────────

function AddTemplateFields({ onAdded, onClose }: { onAdded: () => void; onClose: () => void }) {
  const { user } = useAuth();
  const createFn = useServerFn(createAuroraTemplate);
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [characterKey, setCharacterKey] = useState("character");

  const mut = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Give this template a name");
      const tid = extractTemplateId(templateId.trim());
      if (!tid) throw new Error("Paste a HeyGen template ID or URL");
      if (!characterKey.trim()) throw new Error("Enter the character variable name");
      return createFn({
        data: {
          name: name.trim(),
          heygenTemplateId: tid,
          fixedVariables: {
            [characterKey.trim()]: {
              name: characterKey.trim(),
              type: "character" as const,
              properties: { type: "avatar" as const, character_id: "" },
            },
          },
          characterVariableKey: characterKey.trim(),
        },
      });
    },
    onSuccess: () => {
      toast.success("Template saved!");
      setName("");
      setTemplateId("");
      setCharacterKey("character");
      onAdded();
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to save template"),
  });

  if (!user) return null;

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground leading-relaxed">
        Open any template in{" "}
        <a
          href="https://app.heygen.com/templates"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline"
        >
          HeyGen Studio
        </a>
        , copy its ID or URL, and paste it below. Aurora will let you swap in
        your own avatar or photo every time you generate.
      </p>

      <div className="space-y-4">
        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold mb-1.5">
            <Clapperboard className="size-3.5 text-muted-foreground" />
            Template name
            <span className="text-muted-foreground font-normal">(for your reference)</span>
          </label>
          <Input
            placeholder="e.g. Product launch hook"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-white/5 border-white/10"
          />
        </div>

        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold mb-1.5">
            <Copy className="size-3.5 text-muted-foreground" />
            HeyGen template ID or URL
          </label>
          <Input
            placeholder="e.g. abc123def456  or  https://app.heygen.com/templates/abc123"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="bg-white/5 border-white/10 text-sm"
          />
        </div>

        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold mb-1.5">
            <Key className="size-3.5 text-muted-foreground" />
            Character variable key
          </label>
          <Input
            placeholder="character"
            value={characterKey}
            onChange={(e) => setCharacterKey(e.target.value)}
            className="bg-white/5 border-white/10"
          />
          <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
            The variable slot name in HeyGen where the avatar goes — usually{" "}
            <code className="bg-white/10 px-1 rounded">character</code>.
          </p>
        </div>
      </div>

      <Button
        onClick={() => mut.mutate()}
        disabled={mut.isPending}
        className="w-full"
        size="lg"
      >
        {mut.isPending ? (
          <><Loader2 className="mr-2 size-4 animate-spin" /> Saving…</>
        ) : (
          <><Plus className="mr-2 size-4" /> Save Template</>
        )}
      </Button>
    </div>
  );
}

// ─── Generate Panel ───────────────────────────────────────────────────────────

type CharacterType = "avatar" | "talking_photo";

function GeneratePanel({ template }: { template: AuroraTemplateRow }) {
  const { user } = useAuth();
  const genFn = useServerFn(generateAuroraTemplateVideo);
  const [open, setOpen] = useState(false);
  const [charType, setCharType] = useState<CharacterType>("talking_photo");
  const [avatarId, setAvatarId] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ url: string; generationId: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const mut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in to generate");
      let characterId = "";
      if (charType === "talking_photo") {
        if (!photoUrl) throw new Error("Upload a photo first");
        characterId = photoUrl;
      } else {
        if (!avatarId.trim()) throw new Error("Enter a HeyGen avatar ID");
        characterId = avatarId.trim();
      }
      const res = await genFn({
        data: {
          auroraTemplateId: template.id,
          character: {
            name: template.character_variable_key,
            type: "character" as const,
            properties: {
              type: charType,
              character_id: characterId,
            },
          },
        },
      });
      if (!res.ok) {
        if (res.insufficient) throw new Error("Not enough Aura — top up in Billing");
        throw new Error(res.error || "Generation failed");
      }
      return res;
    },
    onSuccess: (res) => {
      if (res.ok) {
        setResult({ url: res.url, generationId: res.generationId });
        toast.success("Video ready!");
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Generation failed"),
  });

  async function handlePhotoUpload(file: File) {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/heygen-template-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("studio")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw new Error(upErr.message);
      const { data: signed, error: signErr } = await supabase.storage
        .from("studio")
        .createSignedUrl(path, 3600);
      if (signErr || !signed?.signedUrl) throw new Error(signErr?.message ?? "Signing failed");
      setPhotoUrl(signed.signedUrl);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="border-t border-white/10 mt-3 pt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 text-xs font-semibold text-[var(--teal)] hover:opacity-80 transition-opacity"
      >
        <Play className="size-3 fill-current" />
        {open ? "Hide generate panel" : "Generate with my avatar / photo"}
        <span className="ml-auto text-[10px] font-normal text-muted-foreground">
          {TEMPLATE_COST} Aura
        </span>
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          <div className="flex gap-2">
            {(["talking_photo", "avatar"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setCharType(t)}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-medium transition-colors ${
                  charType === t
                    ? "border-[var(--teal-border)] bg-[var(--teal-dim)] text-[var(--teal)]"
                    : "border-white/10 text-white/50 hover:border-white/20 hover:bg-white/[0.03]"
                }`}
              >
                {t === "talking_photo" ? <ImageIcon className="size-3.5" /> : <User className="size-3.5" />}
                {t === "talking_photo" ? "My photo" : "HeyGen avatar"}
              </button>
            ))}
          </div>

          {charType === "talking_photo" ? (
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handlePhotoUpload(f);
                }}
              />
              {photoUrl ? (
                <div className="flex items-center gap-3 rounded-xl border border-[var(--teal-border)] bg-[var(--teal-dim)] px-3 py-2.5">
                  <img src={photoUrl} alt="uploaded" className="size-10 rounded-lg object-cover" />
                  <span className="flex-1 text-xs text-white/70 truncate">Photo ready</span>
                  <button
                    onClick={() => { setPhotoUrl(null); }}
                    className="text-white/30 hover:text-white/60 transition-colors"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="w-full flex flex-col items-center gap-2 rounded-xl border border-dashed border-white/15 py-6 text-xs text-white/40 hover:border-[var(--teal-border)] hover:text-white/60 hover:bg-[var(--teal-dim)] transition-all"
                >
                  {uploading ? (
                    <Loader2 className="size-5 animate-spin text-[var(--teal)]" />
                  ) : (
                    <Upload className="size-5" />
                  )}
                  {uploading ? "Uploading…" : "Tap to upload your photo"}
                </button>
              )}
            </div>
          ) : (
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
                <User className="size-3.5" /> HeyGen avatar ID
              </label>
              <Input
                placeholder="e.g. Abigail_expressive_20240922"
                value={avatarId}
                onChange={(e) => setAvatarId(e.target.value)}
                className="bg-white/5 border-white/10 text-sm"
              />
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Find IDs in{" "}
                <a
                  href="https://app.heygen.com/avatars"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  HeyGen → Avatars
                </a>
              </p>
            </div>
          )}

          <Button
            onClick={() => mut.mutate()}
            disabled={
              mut.isPending ||
              (!photoUrl && charType === "talking_photo") ||
              (!avatarId.trim() && charType === "avatar")
            }
            className="w-full"
            size="sm"
          >
            {mut.isPending ? (
              <><Loader2 className="mr-2 size-3.5 animate-spin" /> Generating…</>
            ) : (
              <><Sparkles className="mr-2 size-3.5" /> Generate · {TEMPLATE_COST} Aura</>
            )}
          </Button>

          {result && (
            <div className="rounded-xl border border-[var(--teal-border)] bg-[var(--teal-dim)] p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs text-[var(--teal)] font-semibold">
                <CheckCircle2 className="size-3.5" /> Video ready
              </div>
              <video
                src={result.url}
                controls
                className="w-full rounded-lg max-h-64 object-contain bg-black"
              />
              <div className="flex gap-3">
                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-primary underline"
                >
                  <ExternalLink className="size-3" /> Open
                </a>
                <button
                  onClick={async () => {
                    try {
                      const blob = await fetch(result.url).then((r) => r.blob());
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(blob);
                      a.download = `heygen-template-${result.generationId}.mp4`;
                      a.click();
                      URL.revokeObjectURL(a.href);
                    } catch {
                      window.open(result.url, "_blank");
                    }
                  }}
                  className="flex items-center gap-1.5 text-xs text-primary underline"
                >
                  Download
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Template Card ─────────────────────────────────────────────────────────────

function TemplateCard({ tpl, onDelete }: { tpl: AuroraTemplateRow; onDelete: () => void }) {
  const deleteFn = useServerFn(deleteAuroraTemplate);
  const [copied, setCopied] = useState(false);

  const delMut = useMutation({
    mutationFn: () => deleteFn({ data: { id: tpl.id } }),
    onSuccess: () => {
      toast.success("Template removed");
      onDelete();
    },
    onError: () => toast.error("Failed to delete template"),
  });

  function copyId() {
    navigator.clipboard.writeText(tpl.heygen_template_id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div className="aurora-card-raised overflow-hidden">
      {/* Thumbnail / avatar placeholder */}
      <div className="relative h-24 bg-[var(--teal-dim)] border-b border-[var(--teal-border)] flex items-center justify-center overflow-hidden">
        <div className="size-14 rounded-2xl bg-[var(--teal-dim)] border border-[var(--teal-border)] flex items-center justify-center shadow-[var(--shadow-elevated)]">
          <User className="size-7 text-[var(--teal)] opacity-70" />
        </div>
        <div className="absolute top-2 right-2">
          <span className="text-[9px] text-white/30 bg-black/30 px-1.5 py-0.5 rounded-md backdrop-blur-sm">
            {tpl.heygen_template_id.slice(0, 10)}…
          </span>
        </div>
        <div className="absolute bottom-2 left-3">
          <span
            className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded-full border"
            style={{
              color: "var(--teal)",
              borderColor: "var(--teal-border)",
              background: "var(--teal-dim)",
            }}
          >
            <Film className="size-2.5" /> HeyGen
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate">{tpl.name}</p>
            <button
              onClick={copyId}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-0.5"
            >
              {copied ? (
                <CheckCircle2 className="size-3 text-[var(--teal)]" />
              ) : (
                <Copy className="size-3" />
              )}
              <span className="truncate max-w-[200px]">{tpl.heygen_template_id}</span>
            </button>
          </div>
          <button
            onClick={() => delMut.mutate()}
            disabled={delMut.isPending}
            className="text-white/20 hover:text-red-400 transition-colors shrink-0 mt-0.5"
          >
            {delMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
          <Key className="size-3 text-[var(--teal)] opacity-70" />
          Character slot:{" "}
          <code className="text-white/60 text-[11px] bg-white/5 px-1 rounded">
            {tpl.character_variable_key}
          </code>
        </div>

        <GeneratePanel template={tpl} />
      </div>
    </div>
  );
}

// ─── How It Works strip ────────────────────────────────────────────────────────

const HOW_IT_WORKS = [
  {
    icon: Copy,
    step: "1",
    title: "Copy template ID",
    desc: "From HeyGen Studio → Templates",
  },
  {
    icon: Plus,
    step: "2",
    title: "Save in Aurora",
    desc: "Paste the ID, name it, done",
  },
  {
    icon: Sparkles,
    step: "3",
    title: "Generate",
    desc: `Upload a photo · ${TEMPLATE_COST} Aura`,
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

function HeyGenTemplatesPage() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const listFn = useServerFn(listAuroraTemplates);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["aurora-templates", user?.id],
    queryFn: () => listFn(),
    enabled: !!user,
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ["aurora-templates", user?.id] });
  }

  return (
    <div className="aurora-page-shell text-foreground">
      <span aria-hidden className="aurora-ambient" />

      {/* Add Template Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="bg-background/95 backdrop-blur-xl border-t border-white/10 max-h-[90vh] overflow-y-auto pb-safe">
          <SheetHeader className="mb-5">
            <SheetTitle className="flex items-center gap-2 text-base">
              <span className="size-7 rounded-xl flex items-center justify-center bg-[var(--teal-dim)] border border-[var(--teal-border)]">
                <Film className="size-3.5 text-[var(--teal)]" />
              </span>
              Add HeyGen Template
            </SheetTitle>
          </SheetHeader>
          <AddTemplateFields onAdded={refresh} onClose={() => setSheetOpen(false)} />
        </SheetContent>
      </Sheet>

      <section className="relative z-10 px-5 pt-24 pb-16 animate-fade-in max-w-2xl mx-auto">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-[var(--teal)] border border-[var(--teal-border)] bg-[var(--teal-dim)] px-3 py-1 rounded-full">
              <Film className="size-3" /> HeyGen Templates
            </span>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">
              One scene,{" "}
              <span className="aurora-gradient-text">any face</span>.
            </h1>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-sm">
              Paste any HeyGen template ID and Aurora re-renders it with your own photo or avatar — same scene, different creator.
            </p>
          </div>

          {user && (
            <Button
              onClick={() => setSheetOpen(true)}
              variant="premium"
              size="sm"
              className="shrink-0 mt-1"
            >
              <Plus className="size-3.5 mr-1" /> Add template
            </Button>
          )}
        </div>

        {/* How it works — always visible at top */}
        <div className="grid grid-cols-3 gap-2.5 mb-8">
          {HOW_IT_WORKS.map((s, i) => (
            <div
              key={s.title}
              className="aurora-card-raised p-4 animate-fade-in"
              style={{ animationDelay: `${i * 80}ms`, animationFillMode: "both" }}
            >
              <div className="size-7 rounded-lg flex items-center justify-center bg-[var(--teal-dim)] border border-[var(--teal-border)] mb-2.5">
                <s.icon className="size-3.5 text-[var(--teal)]" />
              </div>
              <p className="font-bold text-xs leading-tight">{s.title}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>

        {/* Auth gate */}
        {!loading && !user && (
          <div className="aurora-card-raised p-6 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Sign in to save and generate from HeyGen templates.
            </p>
            <Link to="/auth">
              <Button>Sign in</Button>
            </Link>
          </div>
        )}

        {/* Template list */}
        {user && (
          <div className="space-y-3">
            {isLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : templates.length === 0 ? (
              <div className="aurora-card-raised p-10 text-center flex flex-col items-center gap-3">
                <div className="size-14 rounded-2xl bg-[var(--teal-dim)] border border-[var(--teal-border)] flex items-center justify-center">
                  <Film className="size-7 text-[var(--teal)] opacity-60" />
                </div>
                <div>
                  <p className="text-sm font-semibold">No templates yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Tap "+ Add template" to save your first one.
                  </p>
                </div>
                <Button onClick={() => setSheetOpen(true)} variant="glass" size="sm">
                  <Plus className="size-3.5 mr-1" /> Add template
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {templates.length} saved template{templates.length !== 1 ? "s" : ""}
                  </p>
                </div>
                {templates.map((tpl) => (
                  <TemplateCard key={tpl.id} tpl={tpl} onDelete={refresh} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* How to find template IDs — detail section */}
        <div className="mt-8 aurora-glass rounded-2xl p-5 space-y-3">
          <p className="text-xs font-bold">How to find a HeyGen template ID</p>
          <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside leading-relaxed">
            <li>
              Go to{" "}
              <a href="https://app.heygen.com/templates" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                app.heygen.com/templates
              </a>
            </li>
            <li>Click any template you want to use</li>
            <li>
              Copy the ID from the URL — it&rsquo;s the part after{" "}
              <code className="bg-white/10 px-1 rounded">/templates/</code>
            </li>
            <li>Paste it in the "Add template" sheet above</li>
          </ol>
          <p className="text-[11px] text-muted-foreground">
            You can also paste the full URL — Aurora extracts the ID automatically.
          </p>
        </div>
      </section>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractTemplateId(input: string): string | null {
  if (!input) return null;
  const m = input.match(/\/templates\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{4,128}$/.test(input)) return input;
  return null;
}
