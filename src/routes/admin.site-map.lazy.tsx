import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Archive, Download, ExternalLink, FilePenLine, LayoutList, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminGate, useAdminAutoUnlock } from "@/components/AdminGate";
import { useAuth } from "@/hooks/use-auth";
import {
  getSiteMap, removeSiteMapItem, reorderSiteMap, seedSiteMap, setSiteMapArchive, updateSiteMapItem,
  type SiteMapItem, type SiteMapKind,
} from "@/lib/site-map.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createLazyFileRoute("/admin/site-map")({ component: SiteMapAdminPage });

const FILTERS: Array<{ value: "all" | SiteMapKind; label: string }> = [
  { value: "all", label: "All pages" },
  { value: "public", label: "Public" },
  { value: "internal", label: "Internal" },
  { value: "admin", label: "Admin" },
  { value: "archived", label: "Archived" },
];

const KIND_STYLE: Record<SiteMapKind, string> = {
  public: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  internal: "border-sky-400/30 bg-sky-400/10 text-sky-300",
  admin: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  archived: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300",
};

function SiteMapAdminPage() {
  const { user } = useAuth();
  const [unlocked, setUnlocked] = useAdminAutoUnlock(!!user);
  if (!unlocked) return <AdminGate onUnlocked={() => setUnlocked(true)} />;
  return <SiteMapManager />;
}

function SiteMapManager() {
  const getFn = useServerFn(getSiteMap);
  const seedFn = useServerFn(seedSiteMap);
  const updateFn = useServerFn(updateSiteMapItem);
  const reorderFn = useServerFn(reorderSiteMap);
  const archiveFn = useServerFn(setSiteMapArchive);
  const removeFn = useServerFn(removeSiteMapItem);
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | SiteMapKind>("all");
  const [selected, setSelected] = useState<SiteMapItem | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const mapQuery = useQuery({ queryKey: ["site-map"], queryFn: () => getFn() });
  const items = mapQuery.data ?? [];
  const visible = useMemo(() => filter === "all" ? items : items.filter((item) => item.kind === filter), [filter, items]);
  const persistRefresh = () => qc.invalidateQueries({ queryKey: ["site-map"] });

  const seed = useMutation({
    mutationFn: () => seedFn(),
    onSuccess: (result) => {
      toast.success(result.seeded ? "Page catalog created" : "Page catalog is already ready");
      persistRefresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not create page catalog"),
  });
  const update = useMutation({
    mutationFn: (data: { id: string; title: string; path: string; description: string }) => updateFn({ data }),
    onSuccess: () => { toast.success("Page details updated"); setEditing(false); persistRefresh(); },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Update failed"),
  });
  const archive = useMutation({
    mutationFn: (data: { id: string; archived: boolean }) => archiveFn({ data }),
    onSuccess: () => { toast.success("Page status updated"); setSelected(null); persistRefresh(); },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Status update failed"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => removeFn({ data: { id } }),
    onSuccess: () => { toast.success("Page removed from this map"); setSelected(null); setConfirmRemove(false); persistRefresh(); },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Removal failed"),
  });

  function move(item: SiteMapItem, direction: -1 | 1) {
    const index = items.findIndex((entry) => entry.id === item.id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= items.length || item.id.startsWith("default-")) return;
    const reordered = [...items];
    [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
    reorderFn({ data: { ids: reordered.map((entry) => entry.id) } })
      .then(() => { toast.success("Flow order saved"); persistRefresh(); })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Could not reorder pages"));
  }

  if (mapQuery.isLoading) return <div className="min-h-screen bg-background grid place-items-center text-sm text-muted-foreground">Loading page map…</div>;

  const usesPreview = items[0]?.id.startsWith("default-");
  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" /> Admin</Link>
            <span className="text-muted-foreground/40">/</span>
            <LayoutList className="size-4 text-primary" />
            <span className="font-semibold">Site Map</span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/Aurora-Site-Layout-Map.pdf"
              download
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <Download className="size-3.5" /> Download PDF
            </a>
            <span className="text-xs text-muted-foreground">{items.length} catalogued routes</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <section className="aurora-page-shell relative overflow-hidden rounded-3xl border border-primary/20 p-6 md:p-8">
          <div className="aurora-ambient pointer-events-none" />
          <div className="relative z-10 max-w-2xl">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Navigation planning</p>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Control Aurora’s page flow.</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">Inventory every public, private, operator and retired surface. Reordering changes this planning flow only—not the live router—so it is safe to design and review before navigation work begins.</p>
          </div>
        </section>

        {usesPreview && (
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-400/25 bg-amber-400/5 px-5 py-4">
            <p className="text-sm text-amber-100/90">You’re viewing the built-in route inventory. Save it once to enable editing, archive state, and persistent ordering.</p>
            <Button onClick={() => seed.mutate()} disabled={seed.isPending}>{seed.isPending ? "Saving…" : "Initialize editable catalog"}</Button>
          </section>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((item) => <Button key={item.value} size="sm" variant={filter === item.value ? "default" : "outline"} onClick={() => setFilter(item.value)}>{item.label}</Button>)}
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1"><h2 className="text-sm font-medium">Visual flow</h2><span className="text-xs text-muted-foreground">Use arrows to change order</span></div>
            <div className="space-y-2">
              {visible.map((item) => {
                const fullIndex = items.findIndex((entry) => entry.id === item.id);
                return <article key={item.id} className={`group flex items-center gap-3 rounded-2xl border p-4 transition-colors ${selected?.id === item.id ? "border-primary/60 bg-primary/5" : "border-border bg-card/40 hover:border-primary/30"}`}>
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-background text-xs font-mono text-muted-foreground">{String(fullIndex + 1).padStart(2, "0")}</span>
                  <button className="min-w-0 flex-1 text-left" onClick={() => { setSelected(item); setEditing(false); setConfirmRemove(false); }}>
                    <div className="flex items-center gap-2"><span className="truncate font-medium">{item.title}</span><span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${KIND_STYLE[item.kind]}`}>{item.kind}</span></div>
                    <p className="mt-1 truncate text-xs text-muted-foreground"><code>{item.path}</code> · {item.description}</p>
                  </button>
                  <div className="hidden shrink-0 items-center gap-1 sm:flex">
                    <Button variant="ghost" size="icon" disabled={usesPreview || fullIndex === 0} onClick={() => move(item, -1)} aria-label={`Move ${item.title} up`}><ArrowUp className="size-4" /></Button>
                    <Button variant="ghost" size="icon" disabled={usesPreview || fullIndex === items.length - 1} onClick={() => move(item, 1)} aria-label={`Move ${item.title} down`}><ArrowDown className="size-4" /></Button>
                  </div>
                </article>;
              })}
              {visible.length === 0 && <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No pages match this filter.</div>}
            </div>
          </section>

          <aside className="h-fit rounded-2xl border border-border bg-card/50 p-5 lg:sticky lg:top-24">
            {!selected ? <div className="py-12 text-center text-sm text-muted-foreground">Choose a page in the flow to inspect or manage it.</div> : (
              <PageInspector item={selected} editable={!usesPreview} editing={editing} setEditing={setEditing} confirmRemove={confirmRemove} setConfirmRemove={setConfirmRemove}
                onUpdate={(data) => update.mutate(data)} onArchive={(archived) => archive.mutate({ id: selected.id, archived })} onRemove={() => remove.mutate(selected.id)}
                pending={update.isPending || archive.isPending || remove.isPending} />
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}

function PageInspector({ item, editable, editing, setEditing, confirmRemove, setConfirmRemove, onUpdate, onArchive, onRemove, pending }: {
  item: SiteMapItem; editable: boolean; editing: boolean; setEditing: (value: boolean) => void; confirmRemove: boolean; setConfirmRemove: (value: boolean) => void;
  onUpdate: (data: { id: string; title: string; path: string; description: string }) => void; onArchive: (archived: boolean) => void; onRemove: () => void; pending: boolean;
}) {
  const [title, setTitle] = useState(item.title);
  const [path, setPath] = useState(item.path);
  const [description, setDescription] = useState(item.description);
  const changeMode = (value: boolean) => { setEditing(value); if (value) { setTitle(item.title); setPath(item.path); setDescription(item.description); } };
  return <div className="space-y-5">
    <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Page details</p><h2 className="mt-1 text-xl font-semibold">{item.title}</h2></div>
    {editing ? <div className="space-y-3">
      <Input value={title} onChange={(event) => setTitle(event.target.value)} aria-label="Page title" />
      <Input value={path} onChange={(event) => setPath(event.target.value)} aria-label="Page path" />
      <textarea value={description} onChange={(event) => setDescription(event.target.value)} className="min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30" aria-label="Page description" />
      <div className="flex gap-2"><Button size="sm" disabled={pending} onClick={() => onUpdate({ id: item.id, title, path, description })}>Save changes</Button><Button size="sm" variant="outline" onClick={() => changeMode(false)}>Cancel</Button></div>
    </div> : <div className="space-y-3 text-sm"><p className="break-all font-mono text-primary">{item.path}</p><p className="leading-6 text-muted-foreground">{item.description}</p><a href={item.path} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">Open route <ExternalLink className="size-3.5" /></a></div>}
    <div className="space-y-2 border-t border-border pt-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Actions</p>
      <Button className="w-full justify-start" variant="outline" disabled={!editable || pending} onClick={() => changeMode(!editing)}><FilePenLine className="size-4" /> {editing ? "Close editor" : "Edit page details"}</Button>
      {item.kind === "archived"
        ? <Button className="w-full justify-start" variant="outline" disabled={!editable || pending} onClick={() => onArchive(false)}><RotateCcw className="size-4" /> Restore as internal</Button>
        : <Button className="w-full justify-start" variant="outline" disabled={!editable || pending} onClick={() => onArchive(true)}><Archive className="size-4" /> Archive from active flow</Button>}
      {confirmRemove ? <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3"><p className="mb-3 text-xs text-muted-foreground">This removes the catalog entry only; it does not delete the real route.</p><div className="flex gap-2"><Button size="sm" variant="destructive" disabled={pending} onClick={onRemove}>Remove entry</Button><Button size="sm" variant="outline" onClick={() => setConfirmRemove(false)}>Cancel</Button></div></div>
        : <Button className="w-full justify-start text-destructive hover:text-destructive" variant="ghost" disabled={!editable || pending} onClick={() => setConfirmRemove(true)}><Trash2 className="size-4" /> Remove from map</Button>}
    </div>
  </div>;
}