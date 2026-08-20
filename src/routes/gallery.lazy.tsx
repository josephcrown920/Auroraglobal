import { authNextSearch } from "@/lib/auth-return-path";
import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AutoplayVideo } from "@/components/ui/AutoplayVideo";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { listGallery, toggleFavorite } from "@/lib/studio.functions";
import { deleteGeneration, hideGeneration } from "@/lib/gallery.functions";
import { ModelBadge } from "@/components/ModelBadge";
import { VisualEditDialog } from "@/components/gallery/VisualEditDialog";
import { Loader2, ArrowLeft, Star, Download, Film, Image as ImageIcon, Layers, Trash2, Wand2, Captions, Lock, CheckCheck, Check, EyeOff, Eye } from "lucide-react";
import { PageSpinner } from "@/components/PageSpinner";
import { AuthRedirect } from "@/components/AuthRedirect";
import { CaptionDialog } from "@/components/gallery/CaptionDialog";
import { toast } from "sonner";
import { saveAssetToDisk } from "@/lib/save";
import { ShareMenu } from "@/components/share/ShareMenu";
import { publishGeneration } from "@/lib/share.functions";
import { bulkDeleteGenerations } from "@/lib/gallery.functions";

export const Route = createLazyFileRoute("/gallery")({ component: GalleryPage });

function GalleryPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listFn = useServerFn(listGallery);
  const favFn = useServerFn(toggleFavorite);
  const hideFn = useServerFn(hideGeneration);
  const publishFn = useServerFn(publishGeneration);
  const [filter, setFilter] = useState<"all" | "favorites" | "images" | "videos" | "hidden">("all");
  const [editing, setEditing] = useState<{ id: string; url: string } | null>(null);
  const [captioning, setCaptioning] = useState<{ id: string; url: string } | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: authNextSearch() });
  }, [user, loading, navigate]);

  const showHidden = filter === "hidden";
  const { data, isLoading } = useQuery({
    queryKey: ["gallery", showHidden],
    queryFn: () => listFn({ data: { showHidden } }),
    enabled: !!user,
  });

  const favMut = useMutation({
    mutationFn: async (v: { id: string; favorite: boolean }) => favFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gallery"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const hideMut = useMutation({
    mutationFn: async (v: { id: string; hidden: boolean }) => hideFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gallery", false] });
      qc.invalidateQueries({ queryKey: ["gallery", true] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const exitSelectMode = () => { setSelectMode(false); setSelectedIds(new Set()); };

  const delFn = useServerFn(deleteGeneration);
  const delMut = useMutation({
    mutationFn: async (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["gallery"] });
      qc.invalidateQueries({ queryKey: ["gens"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  const bulkDelFn = useServerFn(bulkDeleteGenerations);
  const bulkDelMut = useMutation({
    mutationFn: async (ids: string[]) => bulkDelFn({ data: { ids } }),
    onSuccess: (result) => {
      toast.success(`Deleted ${result.deleted} item${result.deleted !== 1 ? "s" : ""}`);
      exitSelectMode();
      qc.invalidateQueries({ queryKey: ["gallery"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Bulk delete failed"),
  });

  if (loading) return <PageSpinner />;
  if (!user) return <AuthRedirect />;

  const items = (data?.items ?? []).filter((g) => {
    if (filter === "favorites") return g.is_favorite;
    if (filter === "images") return !!g.result_image_url;
    if (filter === "videos") return !!g.result_video_url;
    return true;
  });

  const favs = (data?.items ?? []).filter((g) => g.is_favorite).length;

  const groups = groupByDate(items);

  return (
    <main className="aurora-page-shell text-foreground">
      <span aria-hidden className="aurora-ambient" />
      <header className="relative z-10 flex items-center justify-between pl-5 pr-5 py-5 border-b border-border bg-background/80 backdrop-blur-xl">
        <Link to="/studio" className="flex items-center gap-2 font-semibold tracking-tight">
          <ArrowLeft className="size-4 text-muted-foreground" />
          <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20"><span className="inline-block size-2.5 rounded-full bg-primary" /></span>
          My Gallery
        </Link>
        <div className="flex items-center gap-3">
          <div className="text-sm text-muted-foreground">
            {data?.items.length ?? 0} total · <span className="text-foreground">{favs} starred</span>
          </div>
          {(data?.items.length ?? 0) > 0 && (
            <button
              type="button"
              onClick={() => { setSelectMode((m) => !m); setSelectedIds(new Set()); }}
              className={`px-3 py-1.5 text-xs rounded-full border transition-colors font-medium ${selectMode ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground hover:border-primary/50"}`}
            >
              {selectMode ? "Cancel" : "Select"}
            </button>
          )}
        </div>
      </header>

      <div className="relative z-10 max-w-7xl mx-auto p-6 md:p-10 space-y-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Your permanent library</h1>
          <p className="text-muted-foreground mt-1">Every generation is stored forever. Star your favourites to keep them at the top.</p>
        </div>

        <div className="flex gap-2 border-b border-border">
          {([
            { v: "all", l: "All" },
            { v: "favorites", l: "★ Favourites" },
            { v: "images", l: "Photos" },
            { v: "videos", l: "Videos" },
            { v: "hidden", l: "Hidden" },
          ] as const).map((t) => (
            <button
              key={t.v}
              onClick={() => setFilter(t.v)}
              className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${filter === t.v ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {t.l}
            </button>
          ))}
        </div>

        {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}

        {items.length === 0 && !isLoading && (
          <div className="rounded-2xl border border-dashed border-border bg-card/30 p-12 text-center">
            <ImageIcon className="size-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No generations here yet. Head back to the studio.</p>
            <Link to="/studio" className="inline-block mt-4 px-4 py-2 rounded-full text-sm bg-[image:var(--gradient-hero)] shadow-[var(--shadow-glow-soft)]">Open Studio</Link>
          </div>
        )}

        {groups.map((group) => (
          <div key={group.label} className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {group.label} <span className="text-muted-foreground/50">· {group.items.length}</span>
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5">
              {group.items.map((g) => {
            // watermark_display_url replaces result_image_url for free-tier items
            const isWatermarked = !!(g as { is_watermarked?: boolean }).is_watermarked;
            // Display URL: watermark proxy for Free images, raw URL for Pro images/videos.
            // result_video_url is null for watermarked items (server-side masked).
            const displayImageUrl = (g as { watermark_display_url?: string | null }).watermark_display_url ?? g.result_image_url;
            const displayVideoUrl = g.result_video_url; // null for watermarked
            const hasContent = displayImageUrl || displayVideoUrl || isWatermarked;
            if (!hasContent) return null;
            // URL used for download / captions (raw, only available for Pro)
            const rawUrl = g.result_image_url || g.result_video_url;
            return (
              <div
                key={g.id}
                className={`group relative rounded-xl overflow-hidden transition-all ${selectMode ? "cursor-pointer" : ""} ${selectedIds.has(g.id) ? "ring-2 ring-primary/60" : ""}`}
                style={{ background: "oklch(0.10 0.012 272)", border: `1px solid ${selectedIds.has(g.id) ? "oklch(0.58 0.22 295)" : "oklch(1 0 0 / 0.06)"}` }}
                onClick={selectMode ? () => toggleSelect(g.id) : undefined}
              >
                {selectMode && (
                  <div className="absolute top-2 left-2 z-20 pointer-events-none">
                    <div className={`size-6 rounded-full flex items-center justify-center border-2 transition-colors ${selectedIds.has(g.id) ? "bg-primary border-primary" : "bg-background/70 border-border"}`}>
                      {selectedIds.has(g.id) && <Check className="size-3.5 text-primary-foreground" />}
                    </div>
                  </div>
                )}
                <div className="aspect-[4/5] bg-background/40 relative">
                  {displayImageUrl ? (
                    <img
                      src={displayImageUrl}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : displayVideoUrl ? (
                    <AutoplayVideo src={displayVideoUrl} className="w-full h-full object-cover" autoPlay={false} playsInline preload="metadata" />
                  ) : isWatermarked ? (
                    /* Watermarked item with no URLs yet (pending/failed edge case) */
                    <div className="w-full h-full flex flex-col items-center justify-center bg-background/60 gap-2">
                      <Lock className="size-8 text-amber-400/70" />
                      <p className="text-[10px] text-white/50 text-center px-3 leading-tight">Upgrade to Pro to remove watermark</p>
                      <Link to="/billing" className="text-[9px] text-amber-400 hover:text-amber-300 font-medium transition-colors">
                        View plans →
                      </Link>
                    </div>
                  ) : null}
                </div>
                {/* overlay actions — hidden in select mode so tap goes to selection */}
                <div className={`absolute top-2 right-2 flex gap-1 transition-opacity ${selectMode ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
                  <button
                    type="button"
                    onClick={() => favMut.mutate({ id: g.id, favorite: !g.is_favorite })}
                    className={`size-7 rounded-full backdrop-blur-md flex items-center justify-center border transition-colors ${g.is_favorite ? "bg-amber-500/30 border-amber-400 text-amber-200" : "bg-background/70 border-border hover:bg-background"}`}
                    title={g.is_favorite ? "Unfavorite" : "Save to favourites"}
                  >
                    <Star className={`size-3 ${g.is_favorite ? "fill-current" : ""}`} />
                  </button>
                  {/* Visual edit only available for Pro users (result_image_url is null for watermarked) */}
                  {g.result_image_url && !isWatermarked && (
                    <button
                      type="button"
                      onClick={() => setEditing({ id: g.id, url: g.result_image_url! })}
                      className="size-7 rounded-full bg-background/70 backdrop-blur-md border border-border hover:bg-primary/20 hover:border-primary/50 flex items-center justify-center"
                      title="Visual edit"
                    >
                      <Wand2 className="size-3" />
                    </button>
                  )}
                  {/* Captions only available when raw video URL exists (Pro only) */}
                  {displayVideoUrl && !isWatermarked && (
                    <button
                      type="button"
                      onClick={() => setCaptioning({ id: g.id, url: displayVideoUrl })}
                      className="size-7 rounded-full bg-background/70 backdrop-blur-md border border-border hover:bg-primary/20 hover:border-primary/50 flex items-center justify-center"
                      title="Add captions"
                    >
                      <Captions className="size-3" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (isWatermarked) {
                        toast("Watermarked export", {
                          description: "Upgrade to Aurora Pro to download without the watermark.",
                          action: { label: "Upgrade", onClick: () => { window.location.href = "/billing"; } },
                          duration: 6000,
                        });
                        return;
                      }
                      if (rawUrl) saveAssetToDisk(rawUrl, `aurora-${g.id.slice(0, 8)}.${g.result_video_url ? "mp4" : "png"}`);
                    }}
                    className="size-7 rounded-full bg-background/70 backdrop-blur-md border border-border hover:bg-background flex items-center justify-center"
                    title="Download"
                  >
                    <Download className="size-3" />
                  </button>
                  {!isWatermarked && rawUrl && (
                    <ShareMenu
                      compact
                      adsHref={`/ads?generationId=${encodeURIComponent(g.id)}`}
                      triggerClassName="size-7 rounded-full bg-background/70 backdrop-blur-md border border-border hover:bg-primary/20 hover:border-primary/50 flex items-center justify-center"
                      getShareTarget={async () => {
                        const r = await publishFn({ data: { id: g.id } });
                        return {
                          url: `${window.location.origin}${r.url}`,
                          text: g.prompt ?? undefined,
                          assetUrl: rawUrl,
                          filename: `aurora-${g.id.slice(0, 8)}.${g.result_video_url ? "mp4" : "png"}`,
                        };
                      }}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => hideMut.mutate({ id: g.id, hidden: !showHidden })}
                    disabled={hideMut.isPending}
                    className="size-7 rounded-full bg-background/70 backdrop-blur-md border border-border hover:bg-background flex items-center justify-center disabled:opacity-50"
                    title={showHidden ? "Unhide" : "Hide from gallery"}
                  >
                    {showHidden ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Delete this generation permanently?")) delMut.mutate(g.id);
                    }}
                    disabled={delMut.isPending}
                    className="size-7 rounded-full bg-background/70 backdrop-blur-md border border-border hover:bg-destructive hover:text-destructive-foreground hover:border-destructive flex items-center justify-center disabled:opacity-50"
                    title="Delete"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
                <div className="absolute top-2 left-2 flex flex-col gap-1.5 items-start">
                  {g.is_favorite && (
                    <div className="size-7 rounded-full bg-amber-500/40 border border-amber-400 backdrop-blur-md flex items-center justify-center">
                      <Star className="size-3.5 fill-current text-amber-100" />
                    </div>
                  )}
                  {(g.tags as string[] | null)?.includes("demo") && (
                    <span
                      className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold tracking-wide uppercase bg-violet-500/40 border border-violet-400 text-violet-100 backdrop-blur-md"
                      title="Made with our sample face — upload a selfie to star in your own"
                    >
                      Demo
                    </span>
                  )}
                </div>
                <div className="p-2 space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <ModelBadge model={g.model} size="xs" />
                    <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                      {g.result_video_url ? <Film className="size-2.5" /> : <ImageIcon className="size-2.5" />}
                      {new Date(g.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground line-clamp-2">{g.prompt}</p>
                </div>
              </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {editing && (
        <VisualEditDialog
          open={!!editing}
          onOpenChange={(v) => { if (!v) setEditing(null); }}
          sourceId={editing.id}
          sourceUrl={editing.url}
        />
      )}
      {captioning && (
        <CaptionDialog
          open={!!captioning}
          onOpenChange={(v) => { if (!v) setCaptioning(null); }}
          videoUrl={captioning.url}
          generationId={captioning.id}
          onDone={() => {
            qc.invalidateQueries({ queryKey: ["gallery"] });
          }}
        />
      )}

      {/* Bulk-select floating action bar */}
      {selectMode && (
        <div className="fixed bottom-20 inset-x-0 flex justify-center z-50 px-4 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-3 bg-card/95 border border-border rounded-2xl px-4 py-3 shadow-2xl backdrop-blur-xl">
            <button
              type="button"
              onClick={() => {
                const allIds = items.map((g) => g.id);
                const allSelected = allIds.every((id) => selectedIds.has(id));
                setSelectedIds(allSelected ? new Set() : new Set(allIds));
              }}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <CheckCheck className="size-4" />
              {items.every((g) => selectedIds.has(g.id)) ? "Deselect all" : `Select all (${items.length})`}
            </button>
            <div className="w-px h-5 bg-border" />
            <button
              type="button"
              disabled={selectedIds.size === 0 || bulkDelMut.isPending}
              onClick={() => {
                if (selectedIds.size === 0) return;
                if (confirm(`Permanently delete ${selectedIds.size} item${selectedIds.size !== 1 ? "s" : ""}?`)) {
                  bulkDelMut.mutate([...selectedIds]);
                }
              }}
              className="flex items-center gap-1.5 text-sm font-medium text-destructive hover:text-destructive/80 disabled:opacity-40 transition-colors"
            >
              <Trash2 className="size-4" />
              {bulkDelMut.isPending ? "Deleting…" : `Delete${selectedIds.size > 0 ? ` ${selectedIds.size}` : ""}`}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

type GalleryItem = { created_at: string; [key: string]: unknown };

function groupByDate<T extends GalleryItem>(items: T[]): { label: string; items: T[] }[] {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = startOfDay(now);
  const yesterday = today - 86_400_000;
  const weekAgo = today - 6 * 86_400_000;

  const buckets: Record<string, T[]> = {
    Today: [],
    Yesterday: [],
    "This week": [],
    Older: [],
  };

  for (const item of items) {
    const day = startOfDay(new Date(item.created_at));
    if (day === today) buckets.Today.push(item);
    else if (day === yesterday) buckets.Yesterday.push(item);
    else if (day >= weekAgo) buckets["This week"].push(item);
    else buckets.Older.push(item);
  }

  return Object.entries(buckets)
    .filter(([, list]) => list.length > 0)
    .map(([label, list]) => ({ label, items: list }));
}
