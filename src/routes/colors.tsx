import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { generatePerformanceShot, listGenerations } from "@/lib/studio.functions";
import {
  COLOR_PRESETS,
  SETUPS,
  SETUP_KINDS,
  WORKFLOWS,
  buildColorPrompt,
  describePerformance,
  type SetupKind,
} from "@/lib/colors.presets";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Palette, Wand2, ArrowLeft, Check, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TriedTestedShowcase } from "@/components/studio/TriedTestedShowcase";
import { ColorsShotsGallery } from "@/components/studio/ColorsShotsGallery";
import tutorialStudioRefs from "@/assets/tutorial-studio-refs.jpg.asset.json";
import tutorialColorsBlueFinal from "@/assets/tutorial-colors-blue-final.jpg.asset.json";

// Real performance reference photos shot on a hot-pink cyclorama.
// Tinted at render-time to match the chosen color via a mix-blend overlay.
import studioWideImg from "@/assets/colors-studio-wide.jpg";
import studioCloseupImg from "@/assets/colors-studio-closeup.jpg";
import studioSplitImg from "@/assets/colors-studio-split.jpg";
import studioNeonImg from "@/assets/colors-studio-neonbath.jpg";
import studioSmokeImg from "@/assets/colors-studio-smoke.jpg";

const SETUP_IMAGES: Record<string, string> = {
  wide: studioWideImg,
  closeup: studioCloseupImg,
  "split-color": studioSplitImg,
  "neon-bath": studioNeonImg,
  "color-smoke": studioSmokeImg,
};

export const Route = createFileRoute("/colors")({
  component: ColorsStudio,
  head: () => ({
    meta: [
      { title: "Colors Studio — Aurora" },
      { name: "description", content: "Studio-grade color portrait shoots: pick a color, pick a scene (studio, indoor, rooftop, street), generate in seconds." },
      { property: "og:title", content: "Colors Studio — Aurora" },
      { property: "og:description", content: "Pick a color and a scene — get a finished cinematic portrait." },
      { property: "og:url", content: "https://aurorastudiostar.lovable.app/colors" },
    ],
    links: [{ rel: "canonical", href: "https://aurorastudiostar.lovable.app/colors" }],
  }),
});

/** Tiny inline upload tile — much smaller than the full UploadSlot. */
function MiniUpload({
  userId,
  label,
  value,
  onChange,
}: {
  userId: string;
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) return toast.error("Max 20MB");
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userId}/uploads/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("studio").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (error) throw error;
      const { data: signed, error: signErr } = await supabase.storage
        .from("studio").createSignedUrl(path, 60 * 60);
      if (signErr || !signed?.signedUrl) throw signErr ?? new Error("Could not sign upload URL");
      onChange(signed.signedUrl);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      className={cn(
        "group relative h-16 rounded-xl border border-dashed flex items-center gap-3 px-3 transition-colors overflow-hidden text-left",
        value ? "border-primary/40 bg-card/60" : "border-border bg-card/30 hover:border-primary/40",
      )}
    >
      <div className="relative size-12 shrink-0 rounded-lg overflow-hidden bg-background/60 flex items-center justify-center">
        {value ? (
          <img src={value} alt={label} className="size-full object-cover" />
        ) : busy ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : (
          <ImagePlus className="size-4 text-muted-foreground group-hover:text-primary" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-xs text-foreground/80 truncate">{value ? "Uploaded" : "Tap to upload"}</div>
      </div>
      {value && (
        <span
          role="button"
          onClick={(e) => {
            e.stopPropagation();
            onChange(null);
          }}
          className="text-muted-foreground hover:text-destructive p-1"
        >
          <X className="size-3.5" />
        </span>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
        }}
      />
    </button>
  );
}

function ColorsStudio() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const genFn = useServerFn(generatePerformanceShot);
  const listFn = useServerFn(listGenerations);

  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [outfitUrl, setOutfitUrl] = useState<string | null>(null);
  const [color, setColor] = useState(COLOR_PRESETS[1].id); // royal blue — matches tried & tested
  const [kind, setKind] = useState<SetupKind>("performance");
  const [setup, setSetup] = useState("performance");
  const [workflow, setWorkflow] = useState(WORKFLOWS[0].id);
  const [tripletColors, setTripletColors] = useState<string[]>([
    COLOR_PRESETS[0].id,
    COLOR_PRESETS[1].id,
    COLOR_PRESETS[3].id,
  ]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  const refs = useMemo(() => [selfieUrl, outfitUrl].filter(Boolean) as string[], [selfieUrl, outfitUrl]);
  const filteredSetups = useMemo(() => SETUPS.filter((s) => s.kind === kind), [kind]);

  // Keep selected setup valid when kind changes.
  useEffect(() => {
    if (!filteredSetups.some((s) => s.id === setup)) {
      setSetup(filteredSetups[0]?.id ?? SETUPS[0].id);
    }
  }, [kind, filteredSetups, setup]);

  const { data: gens } = useQuery({
    queryKey: ["color-gens"],
    queryFn: () => listFn(),
    enabled: !!user,
    refetchInterval: 4000,
  });
  const recent = (gens?.items ?? []).filter((g) => g.result_image_url).slice(0, 8);

  const fire = async (colorId: string, setupId: string) => {
    if (refs.length === 0) throw new Error("Upload at least a selfie reference");
    const prompt = buildColorPrompt(colorId, setupId);
    return genFn({
      data: {
        prompt,
        imageUrls: refs,
        motionVideoUrl: null,
        model: "google/gemini-3.1-flash-image-preview",
      },
    });
  };

  const singleMut = useMutation({
    mutationFn: () => fire(color, setup),
    onSuccess: () => {
      toast.success("Color shot ready");
      qc.invalidateQueries({ queryKey: ["color-gens"] });
      qc.invalidateQueries({ queryKey: ["gens"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const tripletMut = useMutation({
    mutationFn: async () => Promise.all(tripletColors.map((c) => fire(c, setup))),
    onSuccess: () => {
      toast.success("Triptych complete");
      qc.invalidateQueries({ queryKey: ["color-gens"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const allSetupsMut = useMutation({
    mutationFn: async () => Promise.all(filteredSetups.map((s) => fire(color, s.id))),
    onSuccess: () => {
      toast.success("All setups complete");
      qc.invalidateQueries({ queryKey: ["color-gens"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const allColorsMut = useMutation({
    mutationFn: async () => {
      // Run sequentially in batches of 3 so we don't slam the gateway.
      const results: unknown[] = [];
      const ids = COLOR_PRESETS.map((c) => c.id);
      for (let i = 0; i < ids.length; i += 3) {
        const batch = ids.slice(i, i + 3);
        // eslint-disable-next-line no-await-in-loop
        const res = await Promise.all(batch.map((c) => fire(c, setup)));
        results.push(...res);
        toast.message(`Rendered ${Math.min(i + 3, ids.length)}/${ids.length}`);
      }
      return results;
    },
    onSuccess: () => {
      toast.success(`All ${COLOR_PRESETS.length} colors rendered`);
      qc.invalidateQueries({ queryKey: ["color-gens"] });
      qc.invalidateQueries({ queryKey: ["gens"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Bulk render failed"),
  });

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  const selectedColor = COLOR_PRESETS.find((c) => c.id === color)!;
  const selectedSetup = SETUPS.find((s) => s.id === setup) ?? filteredSetups[0];

  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between px-6 md:px-10 py-4 border-b border-border bg-card/40 backdrop-blur-xl">
        <Link to="/canvas" className="flex items-center gap-2 font-semibold tracking-tight">
          <ArrowLeft className="size-4 text-muted-foreground" />
          <span className="size-8 rounded-xl flex items-center justify-center" style={{ background: "var(--gradient-hero)" }}>
            <Palette className="size-4 text-primary-foreground" />
          </span>
          Colors Studio
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <Link to="/gallery" className="text-muted-foreground hover:text-foreground">Gallery</Link>
          <Link to="/studio" className="text-muted-foreground hover:text-foreground">Full Studio</Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-5 md:p-10 grid lg:grid-cols-[1fr_380px] gap-8">
        {/* LEFT — pickers */}
        <section className="space-y-7">
          {/* COMPACT references at top */}
          <div className="grid grid-cols-2 gap-3">
            <MiniUpload userId={user.id} label="Selfie · required" value={selfieUrl} onChange={setSelfieUrl} />
            <MiniUpload userId={user.id} label="Outfit · optional" value={outfitUrl} onChange={setOutfitUrl} />
          </div>

          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              Pick a <span style={{ background: "var(--gradient-hero)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>color</span>. Pick a scene. Shoot.
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Studio, indoor, rooftop, street — each scene previewed in your color.</p>
          </div>

          <TriedTestedShowcase
            accent="cyan"
            title="Blue performance studio — tried & tested"
            subtitle="One selfie + the royal-blue performance preset = this finished shot."
            refsImage={tutorialStudioRefs.url}
            refsCaption="Selfie · Outfit · Pose reference"
            finalImage={tutorialColorsBlueFinal.url}
            finalCaption="Royal-blue cyclorama · hanging vintage mic · red jersey + black puffer vest · ARRI rim light"
            prompt="Editorial music-video performance shot of the subject on a seamless deep royal-blue cyclorama studio — background and floor are one continuous royal-blue surface, no visible seams. Full-body side profile, leaning into an exact suspended vintage silver microphone hanging from a thin cable at chest level. Outfit: bright red performance jersey with graphic print under a black hooded puffer vest, distressed black stacked jeans, white chunky sneakers. ARRI softbox key from camera-left + softbox fill from camera-right, professional dual softbox stands visible at far frame edges, gentle floor shadow, clean cinematic rim light separating the subject from the cyclorama. Preserve exact facial likeness, red dreadlocks, sunglasses, skin tone, body proportions. ARRI Alexa look, 50mm, 4K photoreal, no text or logos."
          />

          {/* Real shoots gallery — apply these looks to your selfie */}
          <ColorsShotsGallery />





          {/* Colors */}
          <div>
            <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-3">Color</h2>
            <div className="grid grid-cols-6 md:grid-cols-8 gap-2.5">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setColor(c.id)}
                  aria-label={`Select ${c.name} color`}
                  aria-pressed={color === c.id}
                  className={`relative aspect-square rounded-xl border-2 transition-all overflow-hidden group ${color === c.id ? "border-primary scale-[1.05] shadow-[var(--shadow-glow)]" : "border-border hover:border-primary/40"}`}
                  style={{ background: c.swatch }}
                  title={c.name}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${c.glow} opacity-50 group-hover:opacity-80 transition-opacity`} />
                  {color === c.id && (
                    <div className="absolute top-1 right-1 size-4 rounded-full bg-background/90 flex items-center justify-center">
                      <Check className="size-2.5 text-primary" />
                    </div>
                  )}
                </button>
              ))}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1.5">{selectedColor.name}</div>
            {kind === "performance" && (
              <div className="mt-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-[11px] text-foreground/85">
                <span className="uppercase tracking-wider text-[9px] text-primary mr-1.5">Staging</span>
                {describePerformance(color)}
              </div>
            )}
          </div>

          {/* Scene kind tabs */}
          <div>
            <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-3">Scene type</h2>
            <div className="flex gap-2 flex-wrap">
              {SETUP_KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setKind(k.id)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors",
                    kind === k.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border bg-card/40 text-muted-foreground hover:text-foreground hover:border-primary/40",
                  )}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </div>

          {/* Setup visual cards */}
          <div>
            <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-3">Setup preview</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {filteredSetups.map((s) => {
                const active = setup === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSetup(s.id)}
                    className={cn(
                      "group rounded-xl border overflow-hidden text-left transition-all",
                      active ? "border-primary shadow-[var(--shadow-glow)]" : "border-border hover:border-primary/40",
                    )}
                  >
                    <div
                      className="relative aspect-[4/3] w-full overflow-hidden"
                      style={{ background: s.preview(selectedColor.swatch) }}
                    >
                      {SETUP_IMAGES[s.id] ? (
                        <>
                          <img
                            src={SETUP_IMAGES[s.id]}
                            alt={s.name}
                            loading="lazy"
                            className="absolute inset-0 size-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                          />
                          {/* Re-tint the hot-pink reference photo to whatever color is selected. */}
                          {selectedColor.id !== "hot-pink" && (
                            <div
                              aria-hidden
                              className="absolute inset-0 mix-blend-color pointer-events-none"
                              style={{ backgroundColor: selectedColor.swatch }}
                            />
                          )}
                          <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/70 to-transparent" />
                        </>
                      ) : (
                        <svg viewBox="0 0 80 60" className="absolute inset-0 size-full opacity-80 mix-blend-multiply">
                          <ellipse cx="40" cy="22" rx="6" ry="7" fill="rgba(0,0,0,0.55)" />
                          <path d="M28 60 Q28 40 40 38 Q52 40 52 60 Z" fill="rgba(0,0,0,0.55)" />
                        </svg>
                      )}
                      {active && (
                        <div className="absolute top-1.5 right-1.5 size-5 rounded-full bg-background/95 flex items-center justify-center z-10">
                          <Check className="size-3 text-primary" />
                        </div>
                      )}
                    </div>
                    <div className="px-2.5 py-2">
                      <div className="text-xs font-medium">{s.name}</div>
                      <div className="text-[10px] text-muted-foreground line-clamp-2">{s.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Workflows */}
          <div>
            <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-3">Workflow</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {WORKFLOWS.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setWorkflow(w.id)}
                  className={`rounded-xl border p-2.5 text-left transition-colors ${workflow === w.id ? "border-primary/60 bg-primary/10" : "border-border bg-card/40 hover:border-primary/30"}`}
                >
                  <div className="text-xs font-medium">{w.name}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{w.steps.join(" → ")}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Triplet picker */}
          {workflow === "triptych" && (
            <div className="rounded-xl border border-border bg-card/40 p-3 space-y-2.5">
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Triptych colors (pick 3)</div>
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map((c) => {
                  const selected = tripletColors.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        if (selected) setTripletColors(tripletColors.filter((x) => x !== c.id));
                        else if (tripletColors.length < 3) setTripletColors([...tripletColors, c.id]);
                      }}
                      className={`size-8 rounded-full border-2 transition-transform ${selected ? "border-primary scale-110" : "border-border"}`}
                      style={{ background: c.swatch }}
                      aria-label={`${selected ? "Remove" : "Add"} ${c.name} to triptych`}
                      aria-pressed={selected}
                      title={c.name}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Action */}
          <div className="rounded-2xl border border-border bg-card/60 p-4 space-y-3 sticky bottom-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="size-3 rounded-full" style={{ background: selectedColor.swatch }} />
              <span>{selectedColor.name} · {selectedSetup?.name}</span>
            </div>
            {workflow === "single" && (
              <Button disabled={singleMut.isPending || refs.length === 0} onClick={() => singleMut.mutate()} className="w-full h-11" style={{ background: "var(--gradient-hero)" }}>
                {singleMut.isPending ? <><Loader2 className="size-4 mr-2 animate-spin" /> Shooting…</> : <><Wand2 className="size-4 mr-2" /> Generate · 1 Aurora · ~15s</>}
              </Button>
            )}
            {workflow === "triptych" && (
              <Button disabled={tripletMut.isPending || refs.length === 0 || tripletColors.length !== 3} onClick={() => tripletMut.mutate()} className="w-full h-11" style={{ background: "var(--gradient-hero)" }}>
                {tripletMut.isPending ? <><Loader2 className="size-4 mr-2 animate-spin" /> Shooting 3×…</> : <><Wand2 className="size-4 mr-2" /> Generate triptych · 3 Aurora</>}
              </Button>
            )}
            {workflow === "all-setups" && (
              <Button disabled={allSetupsMut.isPending || refs.length === 0} onClick={() => allSetupsMut.mutate()} className="w-full h-11" style={{ background: "var(--gradient-hero)" }}>
                {allSetupsMut.isPending ? <><Loader2 className="size-4 mr-2 animate-spin" /> Shooting all…</> : <><Wand2 className="size-4 mr-2" /> Generate all {filteredSetups.length} setups</>}
              </Button>
            )}
          </div>
        </section>

        {/* RIGHT — recent */}
        <aside className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Recent shots</h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {recent.length === 0 && (
              <div className="col-span-2 rounded-xl border border-dashed border-border bg-card/30 p-8 text-center text-xs text-muted-foreground">
                Your color shots will appear here.
              </div>
            )}
            {recent.map((g) => (
              <a key={g.id} href={g.result_image_url!} target="_blank" rel="noreferrer" className="aspect-[4/5] rounded-xl overflow-hidden border border-border bg-background/40 hover:border-primary/40 transition-colors">
                <img src={g.result_image_url!} alt="" className="w-full h-full object-cover" />
              </a>
            ))}
          </div>
        </aside>
      </div>
    </main>
  );
}
