import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AutoplayVideo } from "@/components/ui/AutoplayVideo";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { listGallery, toggleFavorite } from "@/lib/studio.functions";
import { deleteGeneration } from "@/lib/gallery.functions";
import { ModelBadge } from "@/components/ModelBadge";
import { VisualEditDialog } from "@/components/gallery/VisualEditDialog";
import { Sparkles, Loader2, ArrowLeft, Star, Download, Film, Image as ImageIcon, Layers, Trash2, Wand2, Captions, Crown } from "lucide-react";
import { CaptionDialog } from "@/components/gallery/CaptionDialog";
import { toast } from "sonner";
import { saveAssetToDisk, isSplitRealityPrompt, splitRealityVariant } from "@/lib/save";
import auroraLogo from "@/assets/aurora-logo.png.asset.json";

export const Route = createFileRoute("/gallery")({
  component: GalleryPage,
  head: () => ({
    meta: [
      { title: "Gallery — Aurora" },
      { name: "description", content: "Your permanent Aurora gallery of generated photos and videos. Favorite, download and re-run any shot." },
      { property: "og:title", content: "Aurora Gallery" },
      { property: "og:description", content: "Your library of AI-generated photos, lip-sync clips and video shots." },
      { property: "og:url", content: "https://aurorastudiostar.lovable.app/gallery" },
    ],
    links: [{ rel: "canonical", href: "https://aurorastudiostar.lovable.app/gallery" }],
  }),
});

function GalleryPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listFn = useServerFn(listGallery);
  const favFn = useServerFn(toggleFavorite);
  const [filter, setFilter] = useState<"all" | "favorites" | "images" | "videos">("all");
  const [editing, setEditing] = useState<{ id: string; url: string } | null>(null);
  const [captioning, setCaptioning] = useState<{ id: string; url: string } | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  const { data, isLoading } = useQuery({
    queryKey: ["gallery"],
    queryFn: () => listFn(),
    enabled: !!user,
  });

  const favMut = useMutation({
    mutationFn: async (v: { id: string; favorite: boolean }) => favFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gallery"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

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

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  const items = (data?.items ?? []).filter((g) => {
    if (filter === "favorites") return g.is_favorite;
    if (filter === "images") return !!g.result_image_url;
    if (filter === "videos") return !!g.result_video_url;
    return true;
  });

  const favs = (data?.items ?? []).filter((g) => g.is_favorite).length;

  return (
    <main className="aurora-page-shell text-foreground">
      <span aria-hidden className="aurora-ambient" />
      <header className="relative z-10 flex items-center justify-between px-6 md:px-10 py-5 border-b border-border bg-background/80 backdrop-blur-xl">
        <Link to="/studio" className="flex items-center gap-2 font-semibold tracking-tight">
          <ArrowLeft className="size-4 text-muted-foreground" />
          <img src={auroraLogo.url} alt="Aurora" className="size-8 rounded-xl object-contain" />
          My Gallery
        </Link>
        <div className="text-sm text-muted-foreground">
          {data?.items.length ?? 0} total · <span className="text-foreground">{favs} starred</span>
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

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {items.map((g) => {
            const url = g.result_image_url || g.result_video_url;
            if (!url) return null;
            return (
              <div key={g.id} className="group relative rounded-2xl overflow-hidden border border-border bg-card/40">
                <div className="aspect-[4/5] bg-background/40">
                  {g.result_image_url ? (
                    <img
                      src={
                        (g as typeof g & { is_watermarked?: boolean }).is_watermarked
                          ? `/api/public/watermark-image?id=${g.id}`
                          : g.result_image_url
                      }
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <>
                      <AutoplayVideo src={g.result_video_url!} className="w-full h-full object-cover" autoPlay={false} playsInline preload="metadata" />
                      {(g as typeof g & { is_watermarked?: boolean }).is_watermarked && (
                        <div className="absolute inset-0 pointer-events-none flex items-end justify-start p-2">
                          <span className="text-[9px] font-bold tracking-[0.2em] text-white/80 bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded select-none uppercase">
                            AURORA
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
                {/* overlay actions */}
                <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => favMut.mutate({ id: g.id, favorite: !g.is_favorite })}
                    className={`size-8 rounded-full backdrop-blur-md flex items-center justify-center border transition-colors ${g.is_favorite ? "bg-amber-500/30 border-amber-400 text-amber-200" : "bg-background/70 border-border hover:bg-background"}`}
                    title={g.is_favorite ? "Unfavorite" : "Save to favourites"}
                  >
                    <Star className={`size-3.5 ${g.is_favorite ? "fill-current" : ""}`} />
                  </button>
                  {g.result_image_url && (
                    <button
                      type="button"
                      onClick={() => setEditing({ id: g.id, url: g.result_image_url! })}
                      className="size-8 rounded-full bg-background/70 backdrop-blur-md border border-border hover:bg-primary/20 hover:border-primary/50 flex items-center justify-center"
                      title="Visual edit"
                    >
                      <Wand2 className="size-3.5" />
                    </button>
                  )}
                  {g.result_video_url && (
                    <button
                      type="button"
                      onClick={() => setCaptioning({ id: g.id, url: g.result_video_url! })}
                      className="size-8 rounded-full bg-background/70 backdrop-blur-md border border-border hover:bg-primary/20 hover:border-primary/50 flex items-center justify-center"
                      title="Add captions"
                    >
                      <Captions className="size-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if ((g as typeof g & { is_watermarked?: boolean }).is_watermarked) {
                        toast("Watermarked export", {
                          description: "Upgrade to Aurora Pro to download without the watermark.",
                          action: { label: "Upgrade", onClick: () => { window.location.href = "/billing"; } },
                          duration: 6000,
                        });
                        return;
                      }
                      saveAssetToDisk(url, `aurora-${g.id.slice(0,8)}.${g.result_video_url ? "mp4" : "png"}`);
                    }}
                    className="size-8 rounded-full bg-background/70 backdrop-blur-md border border-border hover:bg-background flex items-center justify-center"
                    title="Download"
                  >
                    <Download className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Delete this generation permanently?")) delMut.mutate(g.id);
                    }}
                    disabled={delMut.isPending}
                    className="size-8 rounded-full bg-background/70 backdrop-blur-md border border-border hover:bg-destructive hover:text-destructive-foreground hover:border-destructive flex items-center justify-center disabled:opacity-50"
                    title="Delete"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                <div className="absolute top-2 left-2 flex flex-col gap-1.5">
                  {g.is_favorite && (
                    <div className="size-7 rounded-full bg-amber-500/40 border border-amber-400 backdrop-blur-md flex items-center justify-center">
                      <Star className="size-3.5 fill-current text-amber-100" />
                    </div>
                  )}
                  {isSplitRealityPrompt(g.prompt) && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/85 text-primary-foreground text-[9px] font-semibold uppercase tracking-widest shadow">
                      <Layers className="size-2.5" /> Split{splitRealityVariant(g.prompt) ? ` · ${splitRealityVariant(g.prompt)}` : ""}
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
    </main>
  );
}
