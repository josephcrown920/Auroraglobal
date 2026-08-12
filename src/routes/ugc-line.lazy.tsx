import { createLazyFileRoute } from "@tanstack/react-router";
import { FeatureGuard } from "@/components/FeatureVisibilityProvider";
import { useState, useRef, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import {
  generateUgcScriptArc,
  generateSceneVariationPrompts,
  generateSceneImagesFromRef,
  type UgcBrief,
} from "@/lib/ugc-line.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Layers,
  FileText,
  ImageIcon,
  Download,
  Copy,
  Check,
  Loader2,
  Upload,
  X,
  User,
  Package,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SiteFooter } from "@/components/SiteFooter";

// Artist-only mode: this feature is hidden from regular users by default.
// Admins always pass; regular users are redirected to /studio unless the
// owner has toggled the feature visible (see feature-visibility registry).
export const Route = createLazyFileRoute("/ugc-line")({
  component: () => (
    <FeatureGuard feature="content-line">
      <ContentLine />
    </FeatureGuard>
  ),
});

// ─── Arc position pill colours ───────────────────────────────────────────────
const ARC_COLOURS: Record<string, string> = {
  "pain-point":    "bg-red-500/15 text-red-400 border-red-500/30",
  discovery:       "bg-amber-500/15 text-amber-400 border-amber-500/30",
  transformation:  "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  "social-proof":  "bg-sky-500/15 text-sky-400 border-sky-500/30",
  fomo:            "bg-brand/15 text-brand border-brand/30",
  cta:             "bg-primary/15 text-primary border-primary/30",
};
function arcColour(pos: string) {
  for (const [k, v] of Object.entries(ARC_COLOURS)) {
    if (pos.toLowerCase().startsWith(k)) return v;
  }
  return "bg-white/10 text-white/50 border-white/20";
}

// ─── Hook angle chips ─────────────────────────────────────────────────────────
const ALL_ANGLES = ["testimonial", "before/after", "myth-bust", "unboxing", "day-in-life", "pov", "comparison", "tutorial", "reaction"];

// ─── Niche options ─────────────────────────────────────────────────────────────
const NICHES = ["Wellness / health", "Beauty / skincare", "Fitness", "Home / lifestyle", "Tech / gadget", "Fashion", "Food / beverage", "Finance / app", "Pet care", "Supplements"];

// ─── Script lengths ───────────────────────────────────────────────────────────
const LENGTHS = [
  { value: "15s", label: "~15 sec" },
  { value: "30s", label: "~30 sec" },
  { value: "45s", label: "~45 sec" },
];

// ─── Ticket card ─────────────────────────────────────────────────────────────
function TicketCard({ brief, index }: { brief: UgcBrief & { id: number }; index: number }) {
  const [copied, setCopied] = useState<"script" | "json" | null>(null);

  function copy(type: "script" | "json") {
    navigator.clipboard.writeText(type === "script" ? brief.script : JSON.stringify(brief, null, 2));
    setCopied(type);
    setTimeout(() => setCopied(null), 1600);
  }

  const arcPos = brief.arc_position?.split(" ")[0] ?? "";

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
      <div className="flex">
        {/* Stub */}
        <div className="w-14 shrink-0 bg-white/[0.02] border-r border-dashed border-white/10 flex flex-col items-center py-4 gap-2">
          <span className="text-sm text-white/40">{String(index + 1).padStart(2, "0")}</span>
          <span className="text-[9px] text-primary/70 uppercase tracking-widest [writing-mode:vertical-rl]">ready</span>
        </div>

        {/* Body */}
        <div className="flex-1 p-4 min-w-0">
          {/* Hook + tags */}
          <div className="flex items-start gap-3 mb-3">
            <p className="flex-1 text-sm font-medium text-white leading-snug">{brief.hook}</p>
            <div className="flex flex-col gap-1 items-end shrink-0">
              <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded border text-primary border-primary/40 bg-primary/10">
                {brief.angle}
              </span>
              {brief.arc_position && (
                <span className={cn("text-[9px] uppercase tracking-wider px-2 py-0.5 rounded border", arcColour(arcPos))}>
                  {arcPos}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2 text-[13px]">
            {[
              { k: "script",     v: brief.script,          highlight: true },
              { k: "scene",      v: brief.scene_direction,  highlight: false },
              { k: "on-screen",  v: brief.on_screen_text,   highlight: false },
              { k: "cta",        v: brief.cta,              highlight: false },
              { k: "caption",    v: brief.caption,           highlight: false },
            ].map(({ k, v, highlight }) => (
              <div key={k} className="grid grid-cols-[80px_1fr] gap-2 py-1.5 border-t border-white/5">
                <span className="text-[10px] uppercase tracking-wider text-white/30 pt-0.5">{k}</span>
                <span className={highlight ? "text-white/90" : "text-white/55"} style={{ lineHeight: 1.55 }}>{v}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-2 mt-3">
            <button
              onClick={() => copy("script")}
              className="flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white/70 bg-white/5 hover:bg-white/8 border border-white/10 px-2.5 py-1.5 rounded transition-colors"
            >
              {copied === "script" ? <Check className="size-3" /> : <Copy className="size-3" />}
              copy script
            </button>
            <button
              onClick={() => copy("json")}
              className="flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white/70 bg-white/5 hover:bg-white/8 border border-white/10 px-2.5 py-1.5 rounded transition-colors"
            >
              {copied === "json" ? <Check className="size-3" /> : <Copy className="size-3" />}
              copy JSON
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Variation card ───────────────────────────────────────────────────────────
function VarCard({ prompt, imageBase64, error }: { prompt: string; imageBase64: string | null; error: string | null }) {
  if (error) {
    return (
      <div className="bg-white/[0.03] border border-red-500/20 rounded-xl flex items-center justify-center min-h-[180px]">
        <p className="text-[11px] text-red-400 text-center px-3">{error}</p>
      </div>
    );
  }
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
      {imageBase64 ? (
        <img
          src={`data:image/png;base64,${imageBase64}`}
          alt={prompt}
          className="w-full aspect-[4/5] object-cover"
        />
      ) : (
        <div className="w-full aspect-[4/5] bg-white/5 flex items-center justify-center">
          <Loader2 className="size-5 text-white/20 animate-spin" />
        </div>
      )}
      <p className="px-2.5 py-2 text-[11px] text-white/40 leading-snug">{prompt}</p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
function ContentLine() {
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState<"scripts" | "variations">("scripts");

  // ── Scripts state ──
  const [product, setProduct] = useState("e.g. Aura — magnesium + L-theanine sleep gummies, $28/mo subscription");
  const [audience, setAudience] = useState("Women 25-40, tired of poor sleep, into wellness / self-care");
  const [niche, setNiche] = useState("Wellness / health");
  const [selectedAngles, setSelectedAngles] = useState<Set<string>>(new Set(["testimonial", "before/after", "myth-bust"]));
  const [length, setLength] = useState<"15s" | "30s" | "45s">("30s");
  const [count, setCount] = useState(6);
  const [briefs, setBriefs] = useState<(UgcBrief & { id: number })[]>([]);
  const counterRef = useRef(0);

  // ── Variations state ──
  const [inputType, setInputType] = useState<"person" | "product">("person");
  const [refFile, setRefFile] = useState<File | null>(null);
  const [refPreview, setRefPreview] = useState<string | null>(null);
  const [direction, setDirection] = useState("casual streetwear, neutral tones, everyday looks");
  const [productName, setProductName] = useState("");
  const [varCount, setVarCount] = useState(6);
  const [aspectRatio, setAspectRatio] = useState("4:5");
  const [consentChecked, setConsentChecked] = useState(false);
  const [varResults, setVarResults] = useState<{ prompt: string; imageBase64: string | null; error: string | null }[]>([]);

  const generateScriptFn = useServerFn(generateUgcScriptArc);
  const generatePromptsFn = useServerFn(generateSceneVariationPrompts);
  const generateImagesFn = useServerFn(generateSceneImagesFromRef);

  // ── Script generation ──
  const scriptMut = useMutation({
    mutationFn: async () => {
      if (!product.trim()) throw new Error("Add a product or offer first");
      if (selectedAngles.size === 0) throw new Error("Pick at least one hook angle");
      const { briefs: newBriefs } = await generateScriptFn({
        data: {
          product: product.trim(),
          audience: audience.trim(),
          niche,
          angles: Array.from(selectedAngles),
          length,
          count,
        },
      });
      return newBriefs;
    },
    onSuccess: (newBriefs) => {
      const withIds = newBriefs.map((b) => ({ ...b, id: ++counterRef.current }));
      setBriefs((prev) => [...prev, ...withIds]);
      toast.success(`${newBriefs.length} briefs added to queue`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Script generation failed"),
  });

  // ── Variation generation ──
  const varMut = useMutation({
    mutationFn: async () => {
      if (!refFile) throw new Error("Upload a reference photo first");
      if (inputType === "person" && !consentChecked)
        throw new Error("Please confirm consent to use this reference photo");

      const base64 = await fileToBase64(refFile);

      const { prompts } = await generatePromptsFn({
        data: {
          direction: direction.trim() || "lifestyle photo",
          count: varCount,
          inputType,
          productName: productName.trim() || undefined,
        },
      });

      const { results } = await generateImagesFn({
        data: {
          referenceBase64: base64,
          referenceMimeType: refFile.type,
          prompts,
          aspectRatio,
        },
      });
      return results;
    },
    onSuccess: (results) => {
      setVarResults(results);
      const ok = results.filter((r) => r.imageBase64).length;
      toast.success(`${ok} of ${results.length} variations generated`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Variation generation failed"),
  });

  function handleFileChange(file: File | null) {
    if (!file) return;
    setRefFile(file);
    const url = URL.createObjectURL(file);
    setRefPreview(url);
  }

  function exportBriefs() {
    if (briefs.length === 0) return toast.error("Queue is empty");
    const blob = new Blob([JSON.stringify(briefs, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "content-line-batch.json";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Batch exported");
  }

  function toggleAngle(angle: string) {
    setSelectedAngles((prev) => {
      const next = new Set(prev);
      if (next.has(angle)) next.delete(angle);
      else next.add(angle);
      return next;
    });
  }

  const isLoading = scriptMut.isPending || varMut.isPending;

  return (
    <div className="aurora-page-shell min-h-screen">
      {/* Ambient */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute top-1/2 -left-40 w-[400px] h-[400px] rounded-full bg-brand/4 blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-screen-xl mx-auto px-4 py-10 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg border border-primary/40 bg-primary/10 flex items-center justify-center">
              <Layers className="size-4 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white leading-none">Content Line</h1>
              <p className="text-[11px] text-white/35 uppercase tracking-wider mt-0.5">UGC batch generator</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-white/30 border border-white/10 px-3 py-1.5 rounded-full">
            <span className={cn("size-1.5 rounded-full", isLoading ? "bg-primary animate-pulse" : "bg-white/20")} />
            {isLoading ? "generating…" : "idle"}
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-2 mb-7">
          {[
            { id: "scripts",    label: "Scripts",           icon: FileText },
            { id: "variations", label: "Outfit Variations",  icon: ImageIcon },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as typeof activeTab)}
              className={cn(
                "flex items-center gap-2 text-[11.5px] uppercase tracking-wider px-3.5 py-2 rounded-lg border transition-colors",
                activeTab === id
                  ? "text-primary border-primary/40 bg-primary/8"
                  : "text-white/40 border-white/10 hover:text-white/60 hover:border-white/20",
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* ── SCRIPTS TAB ── */}
        {activeTab === "scripts" && (
          <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 items-start">
            {/* Form panel */}
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5">
              <p className="text-[10px] uppercase tracking-widest text-white/30 mb-4 flex items-center gap-2">
                Brief
                <span className="flex-1 h-px bg-white/8" />
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-[12px] text-white/50 mb-1.5">Product or offer</label>
                  <Textarea
                    value={product}
                    onChange={(e) => setProduct(e.target.value)}
                    rows={3}
                    className="bg-white/[0.04] border-white/10 text-sm text-white/90 resize-none focus:border-primary/40"
                  />
                </div>

                <div>
                  <label className="block text-[12px] text-white/50 mb-1.5">Target audience</label>
                  <Input
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    className="bg-white/[0.04] border-white/10 text-sm text-white/90 focus:border-primary/40"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] text-white/50 mb-1.5">Niche</label>
                    <select
                      value={niche}
                      onChange={(e) => setNiche(e.target.value)}
                      className="w-full bg-white/[0.04] border border-white/10 rounded-md text-[13px] text-white/80 px-3 py-2 focus:outline-none focus:border-primary/40"
                    >
                      {NICHES.map((n) => <option key={n}>{n}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[12px] text-white/50 mb-1.5">Batch size</label>
                    <select
                      value={count}
                      onChange={(e) => setCount(Number(e.target.value))}
                      className="w-full bg-white/[0.04] border border-white/10 rounded-md text-[13px] text-white/80 px-3 py-2 focus:outline-none focus:border-primary/40"
                    >
                      {[3, 6, 10, 15].map((n) => <option key={n} value={n}>{n} briefs</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] text-white/50 mb-2">Hook angles</label>
                  <div className="flex flex-wrap gap-1.5">
                    {ALL_ANGLES.map((angle) => (
                      <button
                        key={angle}
                        onClick={() => toggleAngle(angle)}
                        className={cn(
                          "text-[11px] px-2.5 py-1 rounded-full border transition-colors",
                          selectedAngles.has(angle)
                            ? "border-primary/50 text-primary bg-primary/10"
                            : "border-white/10 text-white/40 hover:border-white/20",
                        )}
                      >
                        {angle}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] text-white/50 mb-1.5">Script length</label>
                  <div className="flex gap-2">
                    {LENGTHS.map(({ value, label }) => (
                      <button
                        key={value}
                        onClick={() => setLength(value as typeof length)}
                        className={cn(
                          "flex-1 text-[11px] py-1.5 rounded-lg border transition-colors",
                          length === value
                            ? "border-primary/50 text-primary bg-primary/10"
                            : "border-white/10 text-white/40 hover:border-white/20",
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  className="w-full aurora-button-premium"
                  onClick={() => scriptMut.mutate()}
                  disabled={scriptMut.isPending}
                >
                  {scriptMut.isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Generating arc…
                    </>
                  ) : (
                    <>
                      <ChevronRight className="size-4" />
                      Generate {count} briefs
                    </>
                  )}
                </Button>

                {scriptMut.isPending && (
                  <p className="text-center text-[11px] text-white/30">
                    Building coordinated script arc…
                  </p>
                )}
              </div>
            </div>

            {/* Queue panel */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-semibold text-white">Batch queue</h2>
                  <p className="text-[11px] text-white/30 mt-0.5">
                    {briefs.length} {briefs.length === 1 ? "brief" : "briefs"} — coordinated arc
                  </p>
                </div>
                <div className="flex gap-2">
                  {briefs.length > 0 && (
                    <button
                      onClick={() => setBriefs([])}
                      className="text-[11px] text-white/30 hover:text-red-400 border border-white/10 hover:border-red-500/30 px-2.5 py-1.5 rounded-lg transition-colors"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    onClick={exportBriefs}
                    className="flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white/70 border border-white/10 hover:border-white/25 px-2.5 py-1.5 rounded-lg transition-colors"
                  >
                    <Download className="size-3.5" />
                    Export JSON
                  </button>
                </div>
              </div>

              {briefs.length === 0 ? (
                <div className="border border-dashed border-white/10 rounded-xl py-16 text-center">
                  <div className="text-xl text-white/10 mb-3">▢</div>
                  <p className="text-[13px] text-white/30">
                    Set your brief and generate a batch.<br />
                    Each brief is a distinct hook in a coordinated arc.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {briefs.map((brief, i) => (
                    <TicketCard key={brief.id} brief={brief} index={i} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── VARIATIONS TAB ── */}
        {activeTab === "variations" && (
          <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 items-start">
            {/* Form panel */}
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5">
              <p className="text-[10px] uppercase tracking-widest text-white/30 mb-4 flex items-center gap-2">
                Reference + prompts
                <span className="flex-1 h-px bg-white/8" />
              </p>

              {/* Input type toggle */}
              <div className="mb-4">
                <label className="block text-[12px] text-white/50 mb-2">Reference type</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "person",  label: "Person photo",  icon: User },
                    { value: "product", label: "Product photo", icon: Package },
                  ].map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      onClick={() => setInputType(value as typeof inputType)}
                      className={cn(
                        "flex items-center gap-2 text-[12px] py-2 px-3 rounded-lg border transition-colors",
                        inputType === value
                          ? "border-primary/50 text-primary bg-primary/10"
                          : "border-white/10 text-white/40 hover:border-white/20",
                      )}
                    >
                      <Icon className="size-3.5" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Consent (person only) */}
              {inputType === "person" && (
                <label className="flex items-start gap-2.5 mb-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentChecked}
                    onChange={(e) => setConsentChecked(e.target.checked)}
                    className="mt-0.5 accent-primary"
                  />
                  <span className="text-[11.5px] text-white/45 leading-snug">
                    I confirm this reference photo is my own likeness, or one I hold documented commercial consent to use.
                  </span>
                </label>
              )}

              {/* File upload */}
              <div
                className={cn(
                  "border border-dashed rounded-xl p-4 text-center mb-4 cursor-pointer transition-colors",
                  refFile ? "border-primary/30 bg-primary/5" : "border-white/10 hover:border-white/20",
                )}
                onClick={() => document.getElementById("refInput")?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files[0];
                  if (f) handleFileChange(f);
                }}
              >
                <input
                  id="refInput"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                />
                {refPreview ? (
                  <div className="relative">
                    <img src={refPreview} alt="Reference" className="max-h-40 mx-auto rounded-lg object-contain" />
                    <button
                      className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5"
                      onClick={(e) => { e.stopPropagation(); setRefFile(null); setRefPreview(null); }}
                    >
                      <X className="size-3 text-white" />
                    </button>
                    <p className="text-[11px] text-white/40 mt-2">{refFile?.name}</p>
                  </div>
                ) : (
                  <div className="py-4">
                    <Upload className="size-5 text-white/20 mx-auto mb-2" />
                    <p className="text-[12px] text-white/35">
                      {inputType === "person" ? "Drop your reference photo" : "Drop your product photo"}
                    </p>
                  </div>
                )}
              </div>

              {/* Product name (product mode) */}
              {inputType === "product" && (
                <div className="mb-4">
                  <label className="block text-[12px] text-white/50 mb-1.5">Product name (optional)</label>
                  <Input
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="e.g. Aura Sleep Gummies"
                    className="bg-white/[0.04] border-white/10 text-sm text-white/90 focus:border-primary/40"
                  />
                </div>
              )}

              {/* Direction */}
              <div className="mb-4">
                <label className="block text-[12px] text-white/50 mb-1.5">
                  {inputType === "person" ? "Outfit / style direction" : "Scene / usage direction"}
                </label>
                <Textarea
                  value={direction}
                  onChange={(e) => setDirection(e.target.value)}
                  rows={2}
                  placeholder={
                    inputType === "person"
                      ? "e.g. casual streetwear, neutral tones, everyday errands look"
                      : "e.g. lifestyle kitchen setting, natural light, minimalist"
                  }
                  className="bg-white/[0.04] border-white/10 text-sm text-white/90 resize-none focus:border-primary/40"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-[12px] text-white/50 mb-1.5">Variations</label>
                  <select
                    value={varCount}
                    onChange={(e) => setVarCount(Number(e.target.value))}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-md text-[13px] text-white/80 px-3 py-2 focus:outline-none focus:border-primary/40"
                  >
                    {[6, 12, 20, 30].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] text-white/50 mb-1.5">Aspect ratio</label>
                  <select
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-md text-[13px] text-white/80 px-3 py-2 focus:outline-none focus:border-primary/40"
                  >
                    <option value="4:5">4:5 (Portrait)</option>
                    <option value="9:16">9:16 (Reels/TikTok)</option>
                    <option value="1:1">1:1 (Square)</option>
                  </select>
                </div>
              </div>

              <Button
                className="w-full aurora-button-premium"
                onClick={() => varMut.mutate()}
                disabled={varMut.isPending}
              >
                {varMut.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <ImageIcon className="size-4" />
                    Generate {varCount} variations
                  </>
                )}
              </Button>

              {varMut.isPending && (
                <p className="text-center text-[11px] text-white/30 mt-3">
                  Generating {varCount} scenes — this can take a minute
                </p>
              )}
            </div>

            {/* Grid panel */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-semibold text-white">Variation grid</h2>
                  <p className="text-[11px] text-white/30 mt-0.5">
                    {inputType === "person" ? "From your consented reference photo" : "Lifestyle shots of your product"}
                  </p>
                </div>
                {varResults.length > 0 && (
                  <p className="text-[11px] text-white/30">
                    {varResults.filter((r) => r.imageBase64).length} / {varResults.length} generated
                  </p>
                )}
              </div>

              {varResults.length === 0 ? (
                <div className="border border-dashed border-white/10 rounded-xl py-16 text-center">
                  <div className="text-xl text-white/10 mb-3">▢</div>
                  <p className="text-[13px] text-white/30">
                    {inputType === "person"
                      ? "Upload a reference photo, confirm consent, and generate."
                      : "Upload a product photo and generate lifestyle variations."}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {varResults.map((r, i) => (
                    <VarCard key={i} {...r} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <SiteFooter />
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
