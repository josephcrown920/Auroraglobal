import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  getContentMachineData,
  saveProduct,
  deleteProduct,
  saveTemplate,
  deleteTemplate,
  startBatch,
  getBatchStatus,
} from "@/lib/cm-generation.functions";
import { COST_PER_VIDEO, MAX_BATCH_VIDEOS, batchEstimate } from "@/lib/cm.server";
import { generateProductDemo, getGenerationStatus } from "@/lib/ugc-generation.functions";
import { COST_PRODUCT_DEMO } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  Plus,
  X,
  Trash2,
  Download,
  Check,
  Wand2,
  Package,
  ShoppingBag,
  Smartphone,
  Coffee,
  Dumbbell,
  Camera,
  Sun,
  Film,
  Megaphone,
  ImagePlus,
  AlertTriangle,
  Boxes,
  BarChart3,
  Clapperboard,
  ChevronRight,
  Pencil,
  Music2,
  Presentation,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { saveAssetToDisk } from "@/lib/save";

export const Route = createLazyFileRoute("/content-machine")({ component: ContentMachinePage });

// ─── Small shared bits ────────────────────────────────────────────────────────

const ICONS: Record<string, LucideIcon> = {
  Smartphone,
  Package,
  Coffee,
  Dumbbell,
  Sparkles,
  Camera,
  Sun,
  Film,
  Megaphone,
  ShoppingBag,
};

function TIcon({ name, className }: { name: string | null; className?: string }) {
  const I = (name && ICONS[name]) || Sparkles;
  return <I className={className} />;
}

type Derived = "succeeded" | "failed" | "processing";

function StatusPill({ status }: { status: Derived }) {
  const map: Record<Derived, { label: string; cls: string }> = {
    succeeded: { label: "Ready", cls: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
    failed: { label: "Failed", cls: "text-destructive border-destructive/30 bg-destructive/10" },
    processing: { label: "Generating", cls: "text-primary border-primary/30 bg-primary/10" },
  };
  const m = map[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
        m.cls,
      )}
    >
      {status === "processing" && <Loader2 className="size-2.5 animate-spin" />}
      {m.label}
    </span>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="aurora-kicker">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-xl border border-border bg-card/30 px-3.5 py-2.5 text-sm focus:outline-none focus:border-primary/50";

// ─── Product editor ───────────────────────────────────────────────────────────

type ProductDTO = Awaited<ReturnType<typeof getContentMachineData>>["products"][number];
type TemplateDTO = Awaited<ReturnType<typeof getContentMachineData>>["templates"][number];

function ProductEditor({
  userId,
  initial,
  onSaved,
  onCancel,
}: {
  userId: string;
  initial: ProductDTO | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const saveFn = useServerFn(saveProduct);
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [brandVoice, setBrandVoice] = useState(initial?.brandVoice ?? "");
  const [audience, setAudience] = useState(initial?.audience ?? "");
  const [cta, setCta] = useState(initial?.cta ?? "");
  const [link, setLink] = useState(initial?.link ?? "");
  const [photos, setPhotos] = useState<string[]>(initial?.photos ?? []);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadPhoto = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Max 20MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userId}/uploads/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("studio")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data: signed, error: signErr } = await supabase.storage
        .from("studio")
        .createSignedUrl(path, 60 * 60 * 24 * 7);
      if (signErr || !signed?.signedUrl) throw signErr ?? new Error("Could not sign upload URL");
      setPhotos((p) => [...p, signed.signedUrl]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const mut = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Give your product a name");
      return saveFn({
        data: {
          id: initial?.id,
          name: name.trim(),
          description: description.trim() || null,
          brandVoice: brandVoice.trim() || null,
          audience: audience.trim() || null,
          cta: cta.trim() || null,
          link: link.trim() || null,
          photos,
        },
      });
    },
    onSuccess: () => {
      toast.success(initial ? "Product updated" : "Product saved");
      onSaved();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save product"),
  });

  return (
    <div className="aurora-panel p-4 space-y-3.5">
      <div className="flex items-center justify-between">
        <p className="aurora-kicker flex items-center gap-1.5">
          <Package className="size-3.5" /> {initial ? "Edit product" : "New product"}
        </p>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground p-1">
          <X className="size-4" />
        </button>
      </div>

      <Field label="Product name">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={160} className={inputCls} placeholder="e.g. GlowSerum vitamin-C" />
      </Field>
      <Field label="What is it?">
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={2000} className={cn(inputCls, "resize-none")} placeholder="A brightening vitamin-C face serum for sensitive skin." />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Brand voice">
          <input value={brandVoice} onChange={(e) => setBrandVoice(e.target.value)} maxLength={600} className={inputCls} placeholder="warm, confident" />
        </Field>
        <Field label="Audience">
          <input value={audience} onChange={(e) => setAudience(e.target.value)} maxLength={600} className={inputCls} placeholder="skincare beginners" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Call to action">
          <input value={cta} onChange={(e) => setCta(e.target.value)} maxLength={300} className={inputCls} placeholder="Tap the link to try it" />
        </Field>
        <Field label="Link (optional)">
          <input value={link} onChange={(e) => setLink(e.target.value)} maxLength={600} className={inputCls} placeholder="https://…" />
        </Field>
      </div>

      <Field label="Reference photos (optional)">
        <div className="flex flex-wrap gap-2">
          {photos.map((url) => (
            <div key={url} className="relative size-16 rounded-lg overflow-hidden border border-border">
              <img src={url} alt="" className="size-full object-cover" />
              <button
                onClick={() => setPhotos((p) => p.filter((u) => u !== url))}
                className="absolute top-0.5 right-0.5 rounded-full bg-background/80 p-0.5 text-muted-foreground hover:text-destructive"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="size-16 rounded-lg border border-dashed border-border bg-card/30 flex items-center justify-center text-muted-foreground hover:border-primary/40 hover:text-primary"
          >
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadPhoto(f);
              e.target.value = "";
            }}
          />
        </div>
      </Field>

      <Button variant="premium" disabled={mut.isPending} onClick={() => mut.mutate()} className="w-full h-11">
        {mut.isPending ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Check className="size-4 mr-2" />}
        {initial ? "Save changes" : "Save product"}
      </Button>
    </div>
  );
}

// ─── Template editor ──────────────────────────────────────────────────────────

function TemplateEditor({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const saveFn = useServerFn(saveTemplate);
  const [name, setName] = useState("");
  const [sceneHint, setSceneHint] = useState("");
  const [motionHint, setMotionHint] = useState("");
  const [scriptFormula, setScriptFormula] = useState("");
  const [duration, setDuration] = useState(8);

  const mut = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Name your template");
      if (sceneHint.trim().length < 2) throw new Error("Describe the visual style");
      return saveFn({
        data: {
          name: name.trim(),
          sceneHint: sceneHint.trim(),
          motionHint: motionHint.trim() || null,
          scriptFormula: scriptFormula.trim() || null,
          aspect: "9:16",
          duration,
          icon: "Sparkles",
        },
      });
    },
    onSuccess: () => {
      toast.success("Template saved");
      onSaved();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save template"),
  });

  return (
    <div className="aurora-panel p-4 space-y-3.5">
      <div className="flex items-center justify-between">
        <p className="aurora-kicker flex items-center gap-1.5">
          <Sparkles className="size-3.5" /> New template
        </p>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground p-1">
          <X className="size-4" />
        </button>
      </div>
      <Field label="Template name">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className={inputCls} placeholder="e.g. Desk flatlay demo" />
      </Field>
      <Field label="Visual style / scene">
        <textarea value={sceneHint} onChange={(e) => setSceneHint(e.target.value)} rows={2} maxLength={1000} className={cn(inputCls, "resize-none")} placeholder="Top-down flatlay on a marble desk, soft daylight, photoreal" />
      </Field>
      <Field label="Motion style (optional)">
        <input value={motionHint} onChange={(e) => setMotionHint(e.target.value)} maxLength={600} className={inputCls} placeholder="slow push-in with drifting light" />
      </Field>
      <Field label="Script / hook formula (optional)">
        <input value={scriptFormula} onChange={(e) => setScriptFormula(e.target.value)} maxLength={600} className={inputCls} placeholder="problem → reveal → CTA" />
      </Field>
      <Field label={`Duration · ${duration}s`}>
        <input type="range" min={3} max={12} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-full accent-primary" />
      </Field>
      <Button variant="premium" disabled={mut.isPending} onClick={() => mut.mutate()} className="w-full h-11">
        {mut.isPending ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Check className="size-4 mr-2" />}
        Save template
      </Button>
    </div>
  );
}

// ─── Pipeline graph (node-graph spirit) ───────────────────────────────────────

function PipelineGraph({
  videos,
  generated,
  processing,
  failed,
}: {
  videos: number;
  generated: number;
  processing: number;
  failed: number;
}) {
  const stages: { icon: LucideIcon; label: string }[] = [
    { icon: Boxes, label: "Product + template" },
    { icon: Wand2, label: "Script" },
    { icon: ImagePlus, label: "Styled still" },
    { icon: Clapperboard, label: "Animate" },
    { icon: Check, label: "Published" },
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-stretch gap-1 overflow-x-auto pb-1">
        {stages.map((s, i) => (
          <div key={s.label} className="flex items-center gap-1 shrink-0">
            <div className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card/40 px-3 py-2.5 w-[88px]">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <s.icon className="size-4" />
              </span>
              <span className="text-[10px] text-center leading-tight text-muted-foreground">{s.label}</span>
            </div>
            {i < stages.length - 1 && <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { k: "Queued", v: videos, cls: "text-foreground" },
          { k: "Published", v: generated, cls: "text-emerald-400" },
          { k: "Generating", v: processing, cls: "text-primary" },
          { k: "Failed", v: failed, cls: "text-destructive" },
        ].map((c) => (
          <div key={c.k} className="rounded-lg border border-border bg-card/30 py-2">
            <div className={cn("text-lg font-semibold tabular-nums", c.cls)}>{c.v}</div>
            <div className="aurora-kicker">{c.k}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function ContentMachinePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  const dataFn = useServerFn(getContentMachineData);
  const deleteProductFn = useServerFn(deleteProduct);
  const deleteTemplateFn = useServerFn(deleteTemplate);
  const startBatchFn = useServerFn(startBatch);
  const statusFn = useServerFn(getBatchStatus);

  const dataQ = useQuery({
    queryKey: ["cm-data"],
    queryFn: () => dataFn(),
    enabled: !!user,
  });
  const data = dataQ.data;
  const products = data?.products ?? [];
  const templates = data?.templates ?? [];
  const batches = data?.batches ?? [];
  const analytics = data?.analytics;

  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set());
  const [countPerTemplate, setCountPerTemplate] = useState(1);
  const [editingProduct, setEditingProduct] = useState<ProductDTO | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);

  // Product Demo (Task #276): generate a narrated HeyGen avatar walkthrough
  // straight from a saved product's name/description/photos.
  const genDemoFn = useServerFn(generateProductDemo);
  const genStatusFn = useServerFn(getGenerationStatus);
  const [demoProductId, setDemoProductId] = useState<string | null>(null);
  const [demoResultVideo, setDemoResultVideo] = useState<string | null>(null);
  const demoMut = useMutation({
    mutationFn: async (product: ProductDTO) => {
      setDemoProductId(product.id);
      setDemoResultVideo(null);
      const { generationId } = await genDemoFn({
        data: {
          productName: product.name,
          features: [
            {
              name: product.name,
              description: product.description || undefined,
              screenshotUrl: product.photos[0] || undefined,
            },
            ...product.photos.slice(1, 8).map((url, i) => ({
              name: `${product.name} — view ${i + 2}`,
              screenshotUrl: url,
            })),
          ],
          durationPresetId: "walkthrough" as const,
          audience: product.audience || undefined,
        },
      });
      for (let i = 0; i < 90; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        const s = await genStatusFn({ data: { generationId } });
        if (s.status === "succeeded") {
          if (s.videoUrl) return s.videoUrl;
          throw new Error("Demo finished but produced no video.");
        }
        if (s.status === "failed") throw new Error(s.error || "Product demo generation failed.");
      }
      throw new Error("Still rendering — check back in a moment.");
    },
    onSuccess: (videoUrl) => { setDemoResultVideo(videoUrl); toast.success("Product demo ready."); },
    onError: (e) => { setDemoProductId(null); toast.error(e instanceof Error ? e.message : "Could not generate the demo"); },
  });

  // Default the active product to the first one available.
  useEffect(() => {
    if (!selectedProductId && products.length) setSelectedProductId(products[0].id);
  }, [products, selectedProductId]);

  const templateCount = selectedTemplates.size;
  const maxCount = Math.max(1, Math.floor(MAX_BATCH_VIDEOS / Math.max(1, templateCount)));
  const effectiveCount = Math.min(countPerTemplate, maxCount);
  const estimate = batchEstimate(templateCount, effectiveCount);

  const toggleTemplate = (id: string) => {
    setSelectedTemplates((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const startMut = useMutation({
    mutationFn: async () => {
      if (!selectedProductId) throw new Error("Pick a product first");
      if (templateCount === 0) throw new Error("Pick at least one template");
      return startBatchFn({
        data: {
          productId: selectedProductId,
          templateIds: [...selectedTemplates],
          countPerTemplate: effectiveCount,
        },
      });
    },
    onSuccess: (r) => {
      setActiveBatchId(r.batchId);
      if (r.note) toast.message(r.note);
      else toast.success(`Batch queued — ${r.creditsReserved} Aura reserved for ${r.queued} videos.`);
      dataQ.refetch();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not start the batch"),
  });

  const statusQ = useQuery({
    queryKey: ["cm-batch", activeBatchId],
    queryFn: () => statusFn({ data: { batchId: activeBatchId! } }),
    enabled: !!activeBatchId,
    refetchInterval: (q) => {
      const c = q.state.data?.counts;
      return c && c.processing === 0 ? false : 4000;
    },
  });
  const active = statusQ.data;

  // Refresh analytics when the active batch finishes processing.
  useEffect(() => {
    if (active && active.counts.processing === 0) dataQ.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dataQ.refetch is a stable TanStack Query method; dep narrowed to processing count to avoid spurious fetches
  }, [active?.counts.processing]);

  const deleteProductMut = useMutation({
    mutationFn: (id: string) => deleteProductFn({ data: { id } }),
    onSuccess: (_r, id) => {
      if (selectedProductId === id) setSelectedProductId(null);
      toast.success("Product deleted");
      dataQ.refetch();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not delete"),
  });

  const deleteTemplateMut = useMutation({
    mutationFn: (id: string) => deleteTemplateFn({ data: { id } }),
    onSuccess: (_r, id) => {
      setSelectedTemplates((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.success("Template deleted");
      dataQ.refetch();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not delete"),
  });

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="aurora-page-shell text-foreground">
      <span aria-hidden className="aurora-ambient" />
      <header className="relative z-10 flex items-center justify-between px-6 md:px-10 py-4 border-b border-border bg-background/80 backdrop-blur-xl">
        <Link to="/studio" className="flex items-center gap-2 font-semibold tracking-tight">
          <ArrowLeft className="size-4 text-muted-foreground" />
          <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
            <span className="inline-block size-2.5 rounded-full bg-primary" />
          </span>
          Content Machine
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <Link to="/studio" className="text-muted-foreground hover:text-foreground">
            Studio
          </Link>
          <Link to="/gallery" className="text-muted-foreground hover:text-foreground">
            Gallery
          </Link>
        </div>
      </header>

      <div className="relative z-10 max-w-7xl mx-auto p-5 md:p-10 grid lg:grid-cols-[1fr_1.1fr] gap-10">
        {/* LEFT — build a batch */}
        <section className="space-y-7">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              One product, a <span className="aurora-gradient-text">wall of faceless videos.</span>
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Save a product, choose reusable content templates, set how many you want, and Aurora
              batch-generates native 9:16 TikTok-style videos — no faces, just your product.{" "}
              {COST_PER_VIDEO} Aura per video.
            </p>
          </div>

          {/* Products */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="aurora-kicker flex items-center gap-1.5">
                <Package className="size-3.5" /> 1. Choose a product
              </p>
              {!showProductForm && (
                <button
                  onClick={() => {
                    setEditingProduct(null);
                    setShowProductForm(true);
                  }}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <Plus className="size-3.5" /> New
                </button>
              )}
            </div>

            {showProductForm ? (
              <ProductEditor
                userId={user.id}
                initial={editingProduct}
                onSaved={() => {
                  setShowProductForm(false);
                  setEditingProduct(null);
                  dataQ.refetch();
                }}
                onCancel={() => {
                  setShowProductForm(false);
                  setEditingProduct(null);
                }}
              />
            ) : products.length === 0 ? (
              <p className="text-xs text-muted-foreground rounded-xl border border-dashed border-border bg-card/30 px-3.5 py-4 text-center">
                No products yet. Add your first product to start generating.
              </p>
            ) : (
              <div className="grid gap-2">
                {products.map((p) => {
                  const activeSel = selectedProductId === p.id;
                  return (
                    <div
                      key={p.id}
                      className={cn(
                        "rounded-xl border px-3.5 py-3 transition-colors",
                        activeSel
                          ? "border-primary/60 bg-primary/10 ring-1 ring-primary/30"
                          : "border-border bg-card/30 hover:border-primary/40",
                      )}
                    >
                      <button onClick={() => setSelectedProductId(p.id)} className="flex w-full items-start gap-3 text-left">
                        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-background/60 overflow-hidden">
                          {p.photos[0] ? (
                            <img src={p.photos[0]} alt="" className="size-full object-cover" />
                          ) : (
                            <Package className="size-4 text-muted-foreground" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="text-sm font-medium flex items-center gap-1.5">
                            {activeSel && <Check className="size-3.5 text-primary" />}
                            {p.name}
                          </span>
                          {p.description && (
                            <span className="block text-[11px] text-muted-foreground truncate">{p.description}</span>
                          )}
                        </span>
                      </button>
                      <div className="mt-2 flex items-center gap-3 pl-12 text-[11px]">
                        <button
                          onClick={() => {
                            setEditingProduct(p);
                            setShowProductForm(true);
                          }}
                          className="text-muted-foreground hover:text-foreground flex items-center gap-1"
                        >
                          <Pencil className="size-3" /> Edit
                        </button>
                        <button
                          onClick={() => deleteProductMut.mutate(p.id)}
                          className="text-muted-foreground hover:text-destructive flex items-center gap-1"
                        >
                          <Trash2 className="size-3" /> Delete
                        </button>
                        <button
                          onClick={() => demoMut.mutate(p)}
                          disabled={demoMut.isPending && demoProductId === p.id}
                          className="text-muted-foreground hover:text-primary flex items-center gap-1"
                        >
                          {demoMut.isPending && demoProductId === p.id ? (
                            <><Loader2 className="size-3 animate-spin" /> Producing…</>
                          ) : (
                            <><Presentation className="size-3" /> Product demo · {COST_PRODUCT_DEMO} Aura</>
                          )}
                        </button>
                      </div>
                      {demoProductId === p.id && demoResultVideo && (
                        <div className="mt-3 pl-12">
                          <video
                            src={demoResultVideo}
                            controls
                            loop
                            className="w-full max-w-[220px] rounded-lg border border-border aspect-[9/16] object-cover"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Templates */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="aurora-kicker flex items-center gap-1.5">
                <Sparkles className="size-3.5" /> 2. Pick content templates
              </p>
              {!showTemplateForm && (
                <button
                  onClick={() => setShowTemplateForm(true)}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <Plus className="size-3.5" /> New
                </button>
              )}
            </div>

            {showTemplateForm && (
              <TemplateEditor
                onSaved={() => {
                  setShowTemplateForm(false);
                  dataQ.refetch();
                }}
                onCancel={() => setShowTemplateForm(false)}
              />
            )}

            <div className="grid grid-cols-2 gap-2">
              {templates.map((t: TemplateDTO) => {
                const sel = selectedTemplates.has(t.id);
                return (
                  <div
                    key={t.id}
                    className={cn(
                      "relative rounded-xl border p-3 transition-colors",
                      sel
                        ? "border-primary/60 bg-primary/10 ring-1 ring-primary/30"
                        : "border-border bg-card/30 hover:border-primary/40",
                    )}
                  >
                    <button onClick={() => toggleTemplate(t.id)} className="block w-full text-left">
                      <span className="flex items-center gap-2">
                        <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <TIcon name={t.icon} className="size-3.5" />
                        </span>
                        <span className="text-sm font-medium truncate flex items-center gap-1">
                          {sel && <Check className="size-3 text-primary shrink-0" />}
                          {t.name}
                        </span>
                      </span>
                      {t.description && (
                        <span className="mt-1.5 block text-[11px] text-muted-foreground leading-snug line-clamp-2">
                          {t.description}
                        </span>
                      )}
                      <span className="mt-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <span className="rounded border border-border px-1 py-0.5">{t.aspect}</span>
                        <span className="rounded border border-border px-1 py-0.5">{t.duration}s</span>
                        {t.isSystem ? (
                          <span className="rounded border border-border px-1 py-0.5">Built-in</span>
                        ) : (
                          <span className="rounded border border-primary/30 text-primary px-1 py-0.5">Yours</span>
                        )}
                      </span>
                    </button>
                    {!t.isSystem && (
                      <button
                        onClick={() => deleteTemplateMut.mutate(t.id)}
                        className="absolute top-2 right-2 text-muted-foreground hover:text-destructive p-0.5"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Count + estimate + generate */}
          <div className="space-y-3">
            <p className="aurora-kicker">3. How many of each?</p>
            <div className="aurora-panel p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Videos per template</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setCountPerTemplate((c) => Math.max(1, c - 1))}
                    disabled={effectiveCount <= 1}
                    className="size-8 rounded-lg border border-border bg-card/30 flex items-center justify-center disabled:opacity-40 hover:border-primary/40"
                  >
                    –
                  </button>
                  <span className="w-6 text-center text-base font-semibold tabular-nums">{effectiveCount}</span>
                  <button
                    onClick={() => setCountPerTemplate((c) => Math.min(maxCount, c + 1))}
                    disabled={effectiveCount >= maxCount}
                    className="size-8 rounded-lg border border-border bg-card/30 flex items-center justify-center disabled:opacity-40 hover:border-primary/40"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
                <span className="text-muted-foreground">
                  {estimate.totalItems} {estimate.totalItems === 1 ? "video" : "videos"}
                  {templateCount > 0 && ` · ${templateCount} template${templateCount === 1 ? "" : "s"}`}
                </span>
                <span className="font-semibold">
                  <span className="aurora-gradient-text">{estimate.totalCredits} Aura</span>
                </span>
              </div>

              {templateCount > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Up to {MAX_BATCH_VIDEOS} videos per batch. Each renders independently — if you run
                  out of Aura mid-batch, the rest simply won't queue.
                </p>
              )}

              <Button
                variant="premium"
                disabled={!selectedProductId || templateCount === 0 || estimate.totalItems < 1 || startMut.isPending}
                onClick={() => startMut.mutate()}
                className="w-full h-14 text-base font-medium"
              >
                {startMut.isPending ? (
                  <>
                    <Loader2 className="size-5 mr-2 animate-spin" /> Queuing the batch…
                  </>
                ) : (
                  <>
                    <Wand2 className="size-5 mr-2" /> Generate {estimate.totalItems || ""} videos
                  </>
                )}
              </Button>
            </div>
          </div>
        </section>

        {/* RIGHT — results + pipeline + analytics */}
        <section className="space-y-7">
          {/* Active batch */}
          {active && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="aurora-kicker flex items-center gap-1.5">
                  <Clapperboard className="size-3.5" /> This batch · {active.productName}
                </p>
                <button onClick={() => setActiveBatchId(null)} className="text-xs text-muted-foreground hover:text-foreground">
                  Start another
                </button>
              </div>
              {active.note && (
                <p className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
                  <AlertTriangle className="size-3.5 shrink-0 mt-0.5" /> {active.note}
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                {active.items.map((it) => (
                  <div key={it.id} className="rounded-xl border border-border bg-card/30 overflow-hidden">
                    <div className="relative aspect-[9/16] bg-background/60 flex items-center justify-center">
                      {it.status === "succeeded" && it.videoUrl ? (
                        <video src={it.videoUrl} poster={it.imageUrl ?? undefined} controls playsInline className="size-full object-cover" />
                      ) : it.status === "failed" ? (
                        <div className="flex flex-col items-center gap-1 px-3 text-center text-destructive">
                          <AlertTriangle className="size-5" />
                          <span className="text-[10px] leading-tight">{it.error ?? "Render failed"}</span>
                        </div>
                      ) : it.imageUrl ? (
                        <>
                          <img src={it.imageUrl} alt="" className="size-full object-cover opacity-60" />
                          <Loader2 className="absolute size-6 animate-spin text-primary" />
                        </>
                      ) : (
                        <Loader2 className="size-6 animate-spin text-primary" />
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                      <span className="text-[10px] text-muted-foreground truncate">{it.templateName}</span>
                      {it.status === "succeeded" && it.videoUrl ? (
                        <button
                          onClick={() => saveAssetToDisk(it.videoUrl!, `${active.productName ?? "video"}-${it.seq + 1}.mp4`)}
                          className="shrink-0 text-muted-foreground hover:text-primary"
                          title="Download"
                        >
                          <Download className="size-3.5" />
                        </button>
                      ) : (
                        <StatusPill status={it.status} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pipeline */}
          <div className="space-y-3">
            <p className="aurora-kicker flex items-center gap-1.5">
              <BarChart3 className="size-3.5" /> Generation pipeline
            </p>
            <div className="aurora-panel p-4">
              <PipelineGraph
                videos={active ? active.counts.total : analytics?.videos ?? 0}
                generated={active ? active.counts.generated : analytics?.generated ?? 0}
                processing={active ? active.counts.processing : analytics?.processing ?? 0}
                failed={active ? active.counts.failed : analytics?.failed ?? 0}
              />
            </div>
          </div>

          {/* Analytics */}
          <div className="space-y-3">
            <p className="aurora-kicker flex items-center gap-1.5">
              <BarChart3 className="size-3.5" /> Analytics
            </p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { k: "Batches", v: analytics?.batches ?? 0 },
                { k: "Videos", v: analytics?.videos ?? 0 },
                { k: "Published", v: analytics?.generated ?? 0 },
                { k: "Generating", v: analytics?.processing ?? 0 },
                { k: "Failed", v: analytics?.failed ?? 0 },
                { k: "Aura spent", v: analytics?.creditsSpent ?? 0 },
              ].map((c) => (
                <div key={c.k} className="rounded-xl border border-border bg-card/30 px-3 py-3">
                  <div className="text-xl font-semibold tabular-nums">{c.v}</div>
                  <div className="aurora-kicker mt-0.5">{c.k}</div>
                </div>
              ))}
            </div>

            {/* Per-batch list */}
            {batches.length > 0 && (
              <div className="aurora-panel divide-y divide-border">
                {batches.map((b) => {
                  const pct = b.totalItems ? Math.round((b.counts.generated / b.totalItems) * 100) : 0;
                  return (
                    <button
                      key={b.id}
                      onClick={() => setActiveBatchId(b.id)}
                      className="flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-accent/30 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium truncate">{b.productName ?? "Batch"}</span>
                          <span className="text-[11px] text-muted-foreground tabular-nums">
                            {b.counts.generated}/{b.totalItems}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 rounded-full bg-background/60 overflow-hidden">
                          <div className="h-full rounded-full bg-[image:var(--gradient-hero)]" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                          {b.counts.processing > 0 && <span className="text-primary">{b.counts.processing} generating</span>}
                          {b.counts.failed > 0 && <span className="text-destructive">{b.counts.failed} failed</span>}
                          <span>{b.creditsSpent} Aura spent</span>
                        </div>
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
                    </button>
                  );
                })}
              </div>
            )}

            {/* TikTok metrics — dependent task, clearly marked */}
            <div className="aurora-panel p-4 opacity-90">
              <div className="flex items-center justify-between">
                <p className="aurora-kicker flex items-center gap-1.5">
                  <Music2 className="size-3.5" /> TikTok performance
                </p>
                <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                  Coming soon
                </span>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground leading-snug">
                Views, watch-time and engagement for posted videos will appear here once TikTok
                metrics are connected (tracked as a separate task).
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {["Views", "Avg. watch", "Engagement"].map((k) => (
                  <div key={k} className="rounded-lg border border-dashed border-border bg-card/20 px-3 py-3 text-center">
                    <div className="text-lg font-semibold text-muted-foreground/40">—</div>
                    <div className="aurora-kicker mt-0.5">{k}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
