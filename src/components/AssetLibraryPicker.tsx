import { useEffect, useState } from "react";
import { Shirt, Mountain, Loader2, Search, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type AssetCategory = "outfit" | "scene";

type AssetPack = {
  id: string;
  category: AssetCategory;
  title: string;
  image_url: string;
  tags: string[];
  notes: string | null;
  is_published: boolean;
};

type Props = {
  category?: AssetCategory;
  selectedId?: string | null;
  onSelect?: (pack: AssetPack) => void;
  className?: string;
};

const CATEGORY_ICONS: Record<AssetCategory, React.ReactNode> = {
  outfit: <Shirt className="size-4" />,
  scene:  <Mountain className="size-4" />,
};

export function AssetLibraryPicker({ category, selectedId, onSelect, className }: Props) {
  const [packs, setPacks] = useState<AssetPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<AssetCategory | "all">(category ?? "all");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const fetch = async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- admin_asset_packs not yet in generated types.ts; cast until next type regen
      const sb = supabase as any;
      let req = sb
        .from("admin_asset_packs")
        .select("id, category, title, image_url, tags, notes, is_published")
        .eq("is_published", true)
        .order("sort_order", { ascending: true });
      if (activeCategory !== "all") req = req.eq("category", activeCategory);
      const { data, error } = await req;
      if (cancelled) return;
      if (error) { toast.error("Couldn't load asset library"); setLoading(false); return; }
      setPacks((data as unknown as AssetPack[]) ?? []);
      setLoading(false);
    };
    fetch();
    return () => { cancelled = true; };
  }, [activeCategory]);

  const filtered = query.trim()
    ? packs.filter((p) => p.title.toLowerCase().includes(query.toLowerCase()) || p.tags.some((t) => t.toLowerCase().includes(query.toLowerCase())))
    : packs;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Search + category filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search assets…"
            className="pl-8"
          />
        </div>
        {!category && (
          <div className="flex rounded-xl border border-border overflow-hidden">
            {(["all", "outfit", "scene"] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors",
                  activeCategory === cat
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {cat !== "all" && CATEGORY_ICONS[cat]}
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          {query ? "No assets match your search" : "No assets published yet"}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {filtered.map((pack) => {
            const isSelected = selectedId === pack.id;
            return (
              <button
                key={pack.id}
                onClick={() => onSelect?.(pack)}
                className={cn(
                  "group relative text-left rounded-2xl border overflow-hidden transition-all",
                  isSelected
                    ? "border-primary shadow-[0_0_16px_-4px_oklch(0.72_0.2_300_/_0.3)]"
                    : "border-border hover:border-primary/40",
                )}
              >
                <div className="aspect-square bg-zinc-900 overflow-hidden">
                  {pack.image_url ? (
                    <img
                      src={pack.image_url}
                      alt={pack.title}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      {CATEGORY_ICONS[pack.category]}
                    </div>
                  )}
                </div>
                <div className="p-2.5">
                  <p className="text-xs font-semibold truncate">{pack.title}</p>
                  {pack.tags.length > 0 && (
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">{pack.tags.join(", ")}</p>
                  )}
                </div>
                {isSelected && (
                  <div className="absolute top-2 right-2 size-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="size-3 text-white" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
