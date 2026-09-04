import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { ArrowLeft, Plus, Trash2, Loader2, Shirt, Mountain, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createLazyFileRoute("/admin/assets")({
  component: AdminAssetsPage,
});

type Category = "outfit" | "scene";

type Pack = {
  id: string;
  category: Category;
  title: string;
  image_url: string;
  tags: string[];
  notes: string | null;
  is_published: boolean;
  sort_order: number;
  created_at: string;
};

function AdminAssetsPage() {
  const [tab, setTab] = useState<Category>("outfit");
  const [packs, setPacks] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [tableMissing, setTableMissing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("admin_asset_packs" as never)
      .select("*")
      .eq("category", tab)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) {
      if (/relation .* does not exist/i.test(error.message) || error.code === "42P01") {
        setTableMissing(true);
      } else {
        toast.error(error.message);
      }
      setPacks([]);
    } else {
      setTableMissing(false);
      setPacks((data ?? []) as Pack[]);
    }
    setLoading(false);
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !title.trim()) return toast.error("Title and image required");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `admin-packs/${tab}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("studio").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("studio").getPublicUrl(path);
      const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
      const { error: insErr } = await supabase.from("admin_asset_packs" as never).insert({
        category: tab, title: title.trim(), image_url: pub.publicUrl, tags, notes: notes.trim() || null,
      } as never);
      if (insErr) throw insErr;
      toast.success("Added to pack");
      setTitle(""); setNotes(""); setTagsInput(""); setFile(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this preset?")) return;
    const { error } = await supabase.from("admin_asset_packs" as never).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removed");
    load();
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border/40 aurora-glass">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/admin" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Admin
          </Link>
          <h1 className="text-lg font-semibold">Asset Library</h1>
          <div className="w-16" />
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        <div className="flex gap-2">
          {(["outfit", "scene"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setTab(c)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                tab === c ? "bg-primary text-primary-foreground" : "aurora-glass hover:bg-accent/40"
              }`}
            >
              {c === "outfit" ? <Shirt className="size-4" /> : <Mountain className="size-4" />}
              {c === "outfit" ? "Outfits" : "Scenes / Environments"}
            </button>
          ))}
        </div>

        {tableMissing ? (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-6 space-y-3">
            <h2 className="font-semibold text-amber-200">One-time setup required</h2>
            <p className="text-sm text-amber-100/80">
              The <code>admin_asset_packs</code> table doesn&apos;t exist yet. Run the pending migrations in your Supabase project, then reload this page.
            </p>
          </div>
        ) : (
          <>
            <form onSubmit={handleUpload} className="rounded-xl aurora-glass p-5 space-y-3">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Plus className="size-4" /> Add {tab === "outfit" ? "outfit sheet" : "environment"}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  className="rounded-lg bg-background/60 border border-border/60 px-3 py-2 text-sm"
                  placeholder="Title (e.g. 90s Streetwear Sheet)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                <input
                  className="rounded-lg bg-background/60 border border-border/60 px-3 py-2 text-sm"
                  placeholder="Tags (comma separated)"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                />
              </div>
              <textarea
                className="w-full rounded-lg bg-background/60 border border-border/60 px-3 py-2 text-sm"
                placeholder="Notes (optional)"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <div className="flex items-center gap-3">
                <label className="flex-1 flex items-center gap-2 rounded-lg border border-dashed border-border/60 px-3 py-2 text-sm cursor-pointer hover:bg-accent/20">
                  <Upload className="size-4" />
                  <span className="truncate">{file ? file.name : "Choose image"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                <button
                  type="submit"
                  disabled={uploading}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="size-4 animate-spin" /> : "Add to pack"}
                </button>
              </div>
            </form>

            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
              </div>
            ) : packs.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                No {tab === "outfit" ? "outfits" : "environments"} yet.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {packs.map((p) => (
                  <div key={p.id} className="group relative rounded-xl overflow-hidden aurora-glass">
                    <img src={p.image_url} alt={p.title} className="aspect-square w-full object-cover" />
                    <div className="p-2">
                      <div className="text-xs font-medium truncate">{p.title}</div>
                      {p.tags.length > 0 && (
                        <div className="text-[10px] text-muted-foreground truncate">{p.tags.join(" · ")}</div>
                      )}
                    </div>
                    <button
                      onClick={() => remove(p.id)}
                      className="absolute top-2 right-2 rounded-md bg-destructive/90 p-1.5 opacity-0 group-hover:opacity-100 transition"
                      aria-label="Delete"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
