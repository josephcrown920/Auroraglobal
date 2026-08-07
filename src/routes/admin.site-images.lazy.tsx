import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getSiteImages, adminUpdateSiteImage, adminResetSiteImage, type SiteImageRow } from "@/lib/site-images.functions";
import { SITE_IMAGE_DEFAULTS, SITE_IMAGES_REFRESH_EVENT } from "@/components/landing/SiteImagesProvider";
import { AdminGate, useAdminAutoUnlock } from "@/components/AdminGate";
import { LandingLivePreview } from "@/components/admin/LandingLivePreview";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Image, ArrowLeft, ExternalLink, RotateCcw, Upload, Loader2, X } from "lucide-react";

export const Route = createLazyFileRoute("/admin/site-images")({ component: SiteImagesAdminPage });

const SECTION_LABELS: Record<string, string> = {
  hero_slides: "Hero Slideshow (9 slides)",
  hero:        "Hero / Creator Carousel",
  creator:     "Creator Carousel",
  tiktok:      "TikTok Section — Poster Images",
  process:     "Process Step Images",
  gallery:     "Gallery Marquee Rows",
  studio_examples: "Studio Example Strip",
};

function SiteImagesAdminPage() {
  const { user } = useAuth();
  const [unlocked, setUnlocked] = useAdminAutoUnlock(!!user);

  if (!unlocked) return <AdminGate onUnlocked={() => setUnlocked(true)} />;
  return <ImagesGrid />;
}

function ImagesGrid() {
  const getSiteImagesFn = useServerFn(getSiteImages);
  const updateFn        = useServerFn(adminUpdateSiteImage);
  const resetFn         = useServerFn(adminResetSiteImage);
  const qc              = useQueryClient();

  const { data: images, isLoading } = useQuery({
    queryKey: ["admin-site-images-page"],
    queryFn:  () => getSiteImagesFn(),
  });

  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  // Bumped after every successful change so the live preview drawer reloads.
  const [previewVersion, setPreviewVersion] = useState(0);
  // A picked-but-not-yet-published photo, staged for the confirm dialog.
  const [pending, setPending] = useState<{
    key: string; label: string; file: File; objectUrl: string; currentUrl: string;
  } | null>(null);

  function dispatchRefresh() {
    window.dispatchEvent(new CustomEvent(SITE_IMAGES_REFRESH_EVENT));
    setPreviewVersion((v) => v + 1);
  }

  function stagePick(img: SiteImageRow, file: File) {
    setPending((prev) => {
      if (prev) URL.revokeObjectURL(prev.objectUrl);
      return {
        key: img.key,
        label: img.label,
        file,
        objectUrl: URL.createObjectURL(file),
        currentUrl: img.url,
      };
    });
  }

  function discardPending() {
    setPending((prev) => {
      if (prev) URL.revokeObjectURL(prev.objectUrl);
      return null;
    });
  }

  async function handleUpload(key: string, file: File) {
    setUploading((p) => ({ ...p, [key]: true }));
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("key", key);

      // Prefer Supabase bearer token (works for role-unlocked admins).
      // Fall back to sessionStorage passcode for passcode-unlocked admins.
      const { data: session } = await supabase.auth.getSession();
      const bearerToken = session.session?.access_token ?? "";
      const passcode    = sessionStorage.getItem("aurora_admin_token") ?? "";
      const headers: Record<string, string> = bearerToken
        ? { Authorization: `Bearer ${bearerToken}` }
        : { "x-aurora-admin": passcode };

      const res = await fetch("/api/admin/upload-site-image", {
        method: "POST",
        headers,
        body: fd,
      });
      const json = (await res.json()) as { error?: string; url?: string };
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      toast.success("Image updated — live immediately");
      qc.invalidateQueries({ queryKey: ["admin-site-images-page"] });
      qc.invalidateQueries({ queryKey: ["admin-site-images"] });
      dispatchRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading((p) => ({ ...p, [key]: false }));
    }
  }

  const resetMut = useMutation({
    mutationFn: (key: string) => resetFn({ data: { key } }),
    onSuccess: (_r, key) => {
      toast.success(`Reset to default — ${key}`);
      qc.invalidateQueries({ queryKey: ["admin-site-images-page"] });
      qc.invalidateQueries({ queryKey: ["admin-site-images"] });
      dispatchRefresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  // Group by section; merge DB rows with known defaults so every slot appears
  const allKeys = Object.keys(SITE_IMAGE_DEFAULTS) as (keyof typeof SITE_IMAGE_DEFAULTS)[];
  const dbByKey  = new Map((images ?? []).map((r) => [r.key, r]));

  const rows: SiteImageRow[] = allKeys.map((key) => {
    const db  = dbByKey.get(key);
    const def = SITE_IMAGE_DEFAULTS[key];
    return db ?? {
      key,
      url:         def.url,
      label:       def.label,
      section:     def.section,
      default_url: def.url,
      updated_at:  "",
    };
  });

  // Group by section, preserving order
  const sectionOrder = ["hero_slides", "hero", "creator", "studio_examples", "tiktok", "process", "gallery"];
  const grouped = new Map<string, SiteImageRow[]>();
  for (const row of rows) {
    const sec = row.section;
    if (!grouped.has(sec)) grouped.set(sec, []);
    grouped.get(sec)!.push(row);
  }

  const orderedSections = [
    ...sectionOrder.filter((s) => grouped.has(s)),
    ...[...grouped.keys()].filter((s) => !sectionOrder.includes(s)),
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-4 border-b border-border bg-card/80 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Link to="/admin" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="size-3.5" /> Admin
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <div className="flex items-center gap-2">
            <Image className="size-4 text-primary" />
            <span className="text-sm font-semibold">Site Images</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary">
            {rows.length} slots
          </span>
        </div>
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Preview landing <ExternalLink className="size-3.5" />
        </a>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-10 space-y-12">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Landing page photos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload a new image for any slot — changes go live immediately with no redeploy.
            Click <strong>Reset</strong> to restore the original.
          </p>
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        )}

        {orderedSections.map((section) => {
          const sectionRows = grouped.get(section) ?? [];
          return (
            <section key={section} className="space-y-4">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                  {SECTION_LABELS[section] ?? section}
                </h2>
                <span className="text-[10px] text-muted-foreground">
                  {sectionRows.length} slot{sectionRows.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {sectionRows.map((img) => {
                  const isUp      = uploading[img.key];
                  const isCustom  = img.url !== img.default_url && img.url !== "";
                  const hasImage  = !!img.url;
                  return (
                    <SlotCard
                      key={img.key}
                      img={img}
                      isUp={!!isUp}
                      isCustom={isCustom}
                      hasImage={hasImage}
                      onUpload={(file) => stagePick(img, file)}
                      onReset={() => resetMut.mutate(img.key)}
                      resetting={resetMut.isPending && resetMut.variables === img.key}
                    />
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* Confirm-before-publish dialog */}
      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" onClick={discardPending}>
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Publish this photo?</h3>
              <button type="button" onClick={discardPending} className="rounded-md p-1 text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Slot: <span className="font-medium text-foreground">{pending.label}</span>
            </p>
            <div className="mb-4 grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Current</p>
                <div className="aspect-[3/4] overflow-hidden rounded-lg border border-border bg-zinc-900">
                  {pending.currentUrl ? (
                    <img src={pending.currentUrl} alt="Current" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground/50">empty</div>
                  )}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-[10px] uppercase tracking-wider text-primary">New</p>
                <div className="aspect-[3/4] overflow-hidden rounded-lg border border-primary/40 bg-zinc-900">
                  <img src={pending.objectUrl} alt="New" className="h-full w-full object-cover" />
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={discardPending}
                className="flex-1 rounded-xl border border-border py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const p = pending;
                  discardPending();
                  if (p) void handleUpload(p.key, p.file);
                }}
                className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.01]"
              >
                Publish — goes live now
              </button>
            </div>
          </div>
        </div>
      )}

      <LandingLivePreview version={previewVersion} />
    </div>
  );
}

function SlotCard({
  img, isUp, isCustom, hasImage, onUpload, onReset, resetting,
}: {
  img: SiteImageRow;
  isUp: boolean;
  isCustom: boolean;
  hasImage: boolean;
  onUpload: (f: File) => void;
  onReset: () => void;
  resetting: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/40 overflow-hidden flex flex-col">
      {/* Preview */}
      <div className="relative aspect-[3/4] bg-zinc-900 overflow-hidden">
        {hasImage ? (
          <img
            src={img.url}
            alt={img.label}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-muted-foreground/40">
            <Image className="size-6" />
            <span className="text-[9px] text-center px-2">No image yet — upload to set</span>
          </div>
        )}
        {isCustom && (
          <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[8px] font-bold uppercase tracking-wide">
            custom
          </span>
        )}
      </div>

      {/* Info + actions */}
      <div className="p-2 flex flex-col gap-1.5 flex-1">
        <div>
          <p className="text-[10px] font-medium text-foreground truncate leading-tight">{img.label}</p>
          <p className="text-[9px] text-muted-foreground font-mono truncate">{img.key}</p>
        </div>

        {/* Upload */}
        <label
          className={`flex items-center justify-center gap-1 text-[10px] py-1.5 rounded-md border border-dashed transition-colors cursor-pointer ${
            isUp
              ? "opacity-50 cursor-wait border-border text-muted-foreground"
              : "border-border text-muted-foreground hover:border-primary hover:text-foreground"
          }`}
        >
          {isUp ? <Loader2 className="size-3 animate-spin" /> : <Upload className="size-3" />}
          {isUp ? "Uploading…" : "Upload"}
          <input
            type="file"
            accept="image/*,image/webp"
            className="sr-only"
            disabled={isUp}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
              e.target.value = "";
            }}
          />
        </label>

        {/* Reset (only shown when custom) */}
        {isCustom && (
          <button
            type="button"
            onClick={onReset}
            disabled={resetting}
            className="flex items-center justify-center gap-1 text-[9px] py-1 rounded text-rose-400/70 hover:text-rose-400 transition-colors disabled:opacity-50"
          >
            <RotateCcw className="size-2.5" />
            {resetting ? "Resetting…" : "Reset to default"}
          </button>
        )}
      </div>
    </div>
  );
}
