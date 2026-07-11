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
  ChevronDown,
  ChevronUp,
  Copy,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

// ─── Add Template Form ────────────────────────────────────────────────────────

function AddTemplateForm({ onAdded }: { onAdded: () => void }) {
  const { user } = useAuth();
  const createFn = useServerFn(createAuroraTemplate);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState("");
  // The "character" variable key from HeyGen. Users copy this from the
  // HeyGen template editor — it's the variable name they set for the avatar slot.
  const [characterKey, setCharacterKey] = useState("character");

  const mut = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Give this template a name");
      const tid = extractTemplateId(templateId.trim());
      if (!tid) throw new Error("Paste a HeyGen template ID or URL");
      if (!characterKey.trim()) throw new Error("Enter the character variable name");
      // Store a minimal fixed_variables with a placeholder character slot so
      // the server-side validation (characterVariableKey must exist in fixedVariables
      // AND be of type "character") passes. The real slot will be overridden at
      // generation time with the user's chosen avatar/photo.
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
      setOpen(false);
      onAdded();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to save template"),
  });

  if (!user) return null;

  return (
    <div className="aurora-glass rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <span className="flex items-center gap-2 font-semibold text-sm">
          <Plus className="size-4 text-primary" /> Add a HeyGen Template
        </span>
        {open ? <ChevronUp className="size-4 text-white/40" /> : <ChevronDown className="size-4 text-white/40" />}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-white/10 pt-4">
          <p className="text-xs text-white/50">
            Open any template in{" "}
            <a
              href="https://app.heygen.com/templates"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              HeyGen Studio
            </a>
            , copy its template ID or URL, and paste it below. Aurora will let
            you swap in your own avatar or photo every time you generate.
          </p>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-white/60 mb-1 block">Template name (for you)</label>
              <Input
                placeholder="e.g. Product launch hook"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-white/5 border-white/10"
              />
            </div>
            <div>
              <label className="text-xs text-white/60 mb-1 block">HeyGen template ID or URL</label>
              <Input
                placeholder="e.g. abc123def456  or  https://app.heygen.com/templates/abc123def456"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="bg-white/5 border-white/10"
              />
            </div>
            <div>
              <label className="text-xs text-white/60 mb-1 block">
                Character variable name{" "}
                <span className="text-white/30">
                  (the variable slot in HeyGen where the avatar goes — usually "character")
                </span>
              </label>
              <Input
                placeholder="character"
                value={characterKey}
                onChange={(e) => setCharacterKey(e.target.value)}
                className="bg-white/5 border-white/10"
              />
            </div>
          </div>

          <Button
            onClick={() => mut.mutate()}
            disabled={mut.isPending}
            className="w-full"
          >
            {mut.isPending ? (
              <><Loader2 className="mr-2 size-4 animate-spin" /> Saving…</>
            ) : (
              <><Plus className="mr-2 size-4" /> Save Template</>
            )}
          </Button>
        </div>
      )}
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
        className="w-full flex items-center gap-2 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
      >
        <Play className="size-3" />
        {open ? "Hide generate panel" : "Generate with my avatar / photo"}
        {open ? <ChevronUp className="size-3 ml-auto" /> : <ChevronDown className="size-3 ml-auto" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* Character type toggle */}
          <div className="flex gap-2">
            {(["talking_photo", "avatar"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setCharType(t)}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-medium transition-colors ${
                  charType === t
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-white/10 text-white/50 hover:border-white/20"
                }`}
              >
                {t === "talking_photo" ? <ImageIcon className="size-3" /> : <User className="size-3" />}
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
                <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2">
                  <img src={photoUrl} alt="uploaded" className="size-10 rounded-lg object-cover" />
                  <span className="flex-1 text-xs text-white/70 truncate">Photo ready</span>
                  <button
                    onClick={() => { setPhotoUrl(null); }}
                    className="text-white/30 hover:text-white/60 transition-colors"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="w-full flex flex-col items-center gap-2 rounded-xl border border-dashed border-white/20 py-5 text-xs text-white/40 hover:border-primary/40 hover:text-white/60 transition-colors"
                >
                  {uploading ? (
                    <Loader2 className="size-5 animate-spin text-primary" />
                  ) : (
                    <Upload className="size-5" />
                  )}
                  {uploading ? "Uploading…" : "Tap to upload your photo"}
                </button>
              )}
            </div>
          ) : (
            <div>
              <label className="text-xs text-white/50 mb-1 block">HeyGen avatar ID</label>
              <Input
                placeholder="e.g. Abigail_expressive_20240922"
                value={avatarId}
                onChange={(e) => setAvatarId(e.target.value)}
                className="bg-white/5 border-white/10 text-sm"
              />
              <p className="text-xs text-white/30 mt-1">
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
            disabled={mut.isPending || (!photoUrl && charType === "talking_photo") || (!avatarId.trim() && charType === "avatar")}
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
            <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs text-green-400 font-medium">
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
    <div className="aurora-glass rounded-2xl p-5 flex flex-col gap-1">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{tpl.name}</p>
          <button
            onClick={copyId}
            className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors mt-0.5"
          >
            {copied ? <CheckCircle2 className="size-3 text-green-400" /> : <Copy className="size-3" />}
            <span className="font-mono truncate max-w-[200px]">{tpl.heygen_template_id}</span>
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

      <p className="text-xs text-white/30">
        Character slot: <span className="font-mono text-white/50">{tpl.character_variable_key}</span>
      </p>

      <GeneratePanel template={tpl} />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function HeyGenTemplatesPage() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const listFn = useServerFn(listAuroraTemplates);

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

      <section className="relative z-10 px-5 pt-24 pb-10 animate-fade-in max-w-2xl mx-auto">
        {/* Header */}
        <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-primary border border-primary/30 bg-primary/10 px-3 py-1 rounded-full">
          <Film className="size-3" /> HeyGen Templates
        </span>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight">
          One scene,{" "}
          <span className="aurora-gradient-text">any face</span>.
        </h1>
        <p className="mt-3 text-white/60 text-sm leading-relaxed">
          Paste any HeyGen template ID and Aurora will re-render it with your own
          photo or avatar — same scene, script, and layout, swapping just the character.
          Perfect for mass-producing a proven hook or ad with different creators.
        </p>

        {/* How it works */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          {[
            { icon: Copy, t: "1. Copy template ID", d: "From HeyGen Studio → Templates" },
            { icon: Plus, t: "2. Save in Aurora", d: "Paste ID, name it, done" },
            { icon: Sparkles, t: "3. Generate", d: `Upload a photo · ${TEMPLATE_COST} Aura` },
          ].map((s, i) => (
            <div
              key={s.t}
              className="aurora-glass rounded-2xl p-4 animate-fade-in"
              style={{ animationDelay: `${i * 100}ms`, animationFillMode: "both" }}
            >
              <s.icon className="size-4 text-primary" />
              <p className="mt-2 font-semibold text-xs">{s.t}</p>
              <p className="text-[11px] text-white/50 mt-0.5">{s.d}</p>
            </div>
          ))}
        </div>

        {/* Auth gate */}
        {!loading && !user && (
          <div className="mt-8 aurora-glass rounded-2xl p-6 text-center">
            <p className="text-sm text-white/60 mb-4">
              Sign in to save and generate from HeyGen templates.
            </p>
            <Link to="/auth">
              <Button>Sign in</Button>
            </Link>
          </div>
        )}

        {user && (
          <div className="mt-8 space-y-4">
            <AddTemplateForm onAdded={refresh} />

            {isLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="size-6 animate-spin text-primary/50" />
              </div>
            ) : templates.length === 0 ? (
              <div className="aurora-glass rounded-2xl p-8 text-center text-white/30 text-sm">
                No templates yet — add one above.
              </div>
            ) : (
              <div className="space-y-3">
                {templates.map((tpl) => (
                  <TemplateCard key={tpl.id} tpl={tpl} onDelete={refresh} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Find template IDs guide */}
        <div className="mt-8 aurora-glass rounded-2xl p-5 space-y-2">
          <p className="text-xs font-semibold text-white/70">How to find a HeyGen template ID</p>
          <ol className="text-xs text-white/40 space-y-1 list-decimal list-inside">
            <li>Go to <a href="https://app.heygen.com/templates" target="_blank" rel="noopener noreferrer" className="text-primary underline">app.heygen.com/templates</a></li>
            <li>Click any template you want to use</li>
            <li>Copy the ID from the URL — it's the part after <span className="font-mono">/templates/</span></li>
            <li>Paste it in the "Add a HeyGen Template" form above</li>
          </ol>
          <p className="text-xs text-white/30 pt-1">
            You can also paste the full URL — Aurora extracts the ID automatically.
          </p>
        </div>
      </section>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Accept raw IDs or full HeyGen template URLs. */
function extractTemplateId(input: string): string | null {
  if (!input) return null;
  // https://app.heygen.com/templates/abc123  or  /templates/abc123
  const m = input.match(/\/templates\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  // Bare ID — no slashes, reasonable length
  if (/^[a-zA-Z0-9_-]{4,128}$/.test(input)) return input;
  return null;
}
