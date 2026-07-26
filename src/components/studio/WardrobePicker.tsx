/**
 * WardrobePicker — a compact, reusable outfit selector.
 *
 * Shows saved wardrobe looks as clickable thumbnails in a horizontal scroll
 * row.  Includes an "Add look" upload button that:
 *   1. Uploads the file to the user's `studio` bucket under the
 *      `{userId}/wardrobe/` prefix.
 *   2. Persists the storage_path via addWardrobeItem.
 *   3. Immediately selects the new look.
 *
 * Usage:
 *   <WardrobePicker userId={user.id} value={outfit} onChange={setOutfit} />
 */

import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { listWardrobeItems, addWardrobeItem, deleteWardrobeItem } from "@/lib/wardrobe.functions";
import { cn } from "@/lib/utils";
import { ImagePlus, Loader2, Shirt, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  userId: string;
  value: string | null;
  onChange: (url: string | null) => void;
  /** Optional extra class applied to the wrapper element. */
  className?: string;
};

export function WardrobePicker({ userId, value, onChange, className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const qc = useQueryClient();

  const listFn = useServerFn(listWardrobeItems);
  const addFn = useServerFn(addWardrobeItem);
  const deleteFn = useServerFn(deleteWardrobeItem);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["wardrobe-items"],
    queryFn: () => listFn(),
    staleTime: 60_000,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: (_r, id) => {
      // If the deleted item was selected, clear the selection.
      const wasSelected = items.find((i) => i.id === id)?.url === value;
      if (wasSelected) onChange(null);
      qc.invalidateQueries({ queryKey: ["wardrobe-items"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  async function onPickFile(file: File) {
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Max 20 MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userId}/wardrobe/${crypto.randomUUID()}.${ext}`;

      // 1. Upload to studio bucket
      const { error: uploadErr } = await supabase.storage.from("studio").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (uploadErr) throw uploadErr;

      // 2. Persist storage_path to wardrobe_items
      await addFn({ data: { storagePath: path, label: file.name.replace(/\.[^.]+$/, "") } });

      // 3. Generate a 24-h signed URL and immediately select this look
      const { data: signed, error: signErr } = await supabase.storage
        .from("studio")
        .createSignedUrl(path, 24 * 60 * 60);
      if (signErr || !signed?.signedUrl) throw signErr ?? new Error("Could not sign URL");
      onChange(signed.signedUrl);

      await qc.invalidateQueries({ queryKey: ["wardrobe-items"] });
      toast.success("Look saved to your wardrobe");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <Shirt className="size-3.5" /> Virtual Wardrobe
        </span>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Scrollable thumbnail row + upload button */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {/* Upload / Add new look */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={cn(
            "shrink-0 relative flex flex-col items-center justify-center gap-1",
            "size-16 rounded-xl border-2 border-dashed border-border hover:border-primary/50",
            "bg-card/60 hover:bg-card text-muted-foreground hover:text-primary transition-all",
            "disabled:opacity-50",
          )}
          title="Add outfit to wardrobe"
        >
          {uploading ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <>
              <ImagePlus className="size-5" />
              <span className="text-[9px] font-semibold uppercase tracking-wide">Add</span>
            </>
          )}
        </button>

        {isLoading && (
          <div className="flex items-center justify-center size-16 shrink-0">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Saved looks */}
        {items.map((item) => {
          const isActive = item.url === value;
          return (
            <div key={item.id} className="relative shrink-0 group">
              <button
                type="button"
                onClick={() => onChange(isActive ? null : item.url)}
                className={cn(
                  "size-16 rounded-xl overflow-hidden border-2 transition-all",
                  isActive
                    ? "border-primary shadow-[0_0_0_2px_var(--color-primary)/30]"
                    : "border-border hover:border-primary/40",
                )}
                title={item.label || "Saved look"}
              >
                <img
                  src={item.url}
                  alt={item.label || "Saved look"}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>

              {/* Selection badge */}
              {isActive && (
                <CheckCircle2 className="absolute -top-1 -right-1 size-4 text-primary bg-background rounded-full shadow" />
              )}

              {/* Delete button (visible on hover) */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteMut.mutate(item.id);
                }}
                disabled={deleteMut.isPending}
                className={cn(
                  "absolute -bottom-1 -right-1 size-4 rounded-full flex items-center justify-center",
                  "bg-destructive/90 text-white opacity-0 group-hover:opacity-100 transition-opacity shadow",
                )}
                title="Remove from wardrobe"
              >
                <Trash2 className="size-2.5" />
              </button>
            </div>
          );
        })}

        {!isLoading && items.length === 0 && (
          <p className="text-[11px] text-muted-foreground shrink-0 pl-1">
            No saved looks yet — upload your first outfit.
          </p>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPickFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
