import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { UploadCloud, Trash2, Library, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { refs, uid, fileToDataUrl, type ReferenceItem } from "@/lib/studio-store";

export const Route = createFileRoute("/references")({
  head: () => ({
    meta: [
      { title: "References — AI Studio" },
      { name: "description", content: "Drag & drop moodboard for inspiration." },
      { property: "og:title", content: "References — AI Studio" },
      { property: "og:description", content: "Drag & drop moodboard for inspiration." },
    ],
  }),
  component: References,
});

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime";

function References() {
  const [items, setItems] = useState<ReferenceItem[]>([]);
  const [q, setQ] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setItems(refs.list());
  }, []);

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    for (const f of Array.from(files)) {
      if (f.size > 5 * 1024 * 1024) {
        toast.error(`${f.name} is >5MB — skipped (localStorage limit)`);
        continue;
      }
      try {
        const dataUrl = await fileToDataUrl(f);
        refs.add({
          id: uid(),
          name: f.name,
          dataUrl,
          mime: f.type,
          tags: [],
          createdAt: Date.now(),
        });
      } catch {
        toast.error(`Failed to read ${f.name}`);
      }
    }
    setItems(refs.list());
    toast.success("References added");
  }

  const filtered = items.filter(
    (r) =>
      !q.trim() ||
      r.name.toLowerCase().includes(q.toLowerCase()) ||
      r.tags.some((t) => t.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <header className="flex items-end justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">References</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Drag & drop images or videos to build your visual language.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search…"
              className="pl-8 w-56 glass"
            />
          </div>
          <Button onClick={() => inputRef.current?.click()}>
            <UploadCloud className="h-4 w-4" /> Upload
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            hidden
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      </header>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={
          "glass rounded-2xl p-6 border-2 border-dashed transition " +
          (dragging ? "border-primary bg-primary/10" : "border-border/50")
        }
      >
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <Library className="mx-auto h-10 w-10 text-muted-foreground" />
            <div className="mt-3 text-sm">
              {items.length === 0
                ? "Drop files here or click Upload."
                : "No matches for your search."}
            </div>
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
            {filtered.map((r) => (
              <div
                key={r.id}
                className="group relative aspect-square rounded-lg overflow-hidden border border-border/50"
              >
                {r.mime.startsWith("video") ? (
                  <video src={r.dataUrl} className="h-full w-full object-cover" muted />
                ) : (
                  <img
                    src={r.dataUrl}
                    alt={r.name}
                    className="h-full w-full object-cover"
                  />
                )}
                <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition">
                  <div className="text-[10px] text-white truncate">{r.name}</div>
                </div>
                <Button
                  size="icon"
                  variant="destructive"
                  className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition"
                  onClick={() => {
                    refs.remove(r.id);
                    setItems(refs.list());
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
