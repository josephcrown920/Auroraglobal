import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download, Trash2, Images } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { gallery, type GalleryItem } from "@/lib/studio-store";

export const Route = createFileRoute("/gallery")({
  head: () => ({
    meta: [
      { title: "Gallery — AI Studio" },
      { name: "description", content: "All your generated images in one grid." },
      { property: "og:title", content: "Gallery — AI Studio" },
      { property: "og:description", content: "All your generated images in one grid." },
    ],
  }),
  component: Gallery,
});

function Gallery() {
  const [items, setItems] = useState<GalleryItem[]>([]);

  useEffect(() => {
    setItems(gallery.list());
  }, []);

  function remove(id: string) {
    gallery.remove(id);
    setItems(gallery.list());
  }
  function download(item: GalleryItem) {
    const a = document.createElement("a");
    a.href = item.dataUrl;
    a.download = `${item.id}.png`;
    a.click();
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <header className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Gallery</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {items.length} {items.length === 1 ? "image" : "images"} stored locally
          </p>
        </div>
        {items.length > 0 && (
          <Button
            variant="secondary"
            onClick={() => {
              if (confirm("Clear the entire gallery?")) {
                gallery.clear();
                setItems([]);
                toast.success("Gallery cleared");
              }
            }}
          >
            Clear all
          </Button>
        )}
      </header>

      {items.length === 0 ? (
        <div className="glass rounded-2xl p-16 text-center">
          <Images className="mx-auto h-10 w-10 text-muted-foreground" />
          <div className="mt-4 text-lg font-medium">Nothing here yet</div>
          <div className="text-sm text-muted-foreground mt-1">
            Generate an image in the Playground.
          </div>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="group glass rounded-xl overflow-hidden border border-border/50"
            >
              <div className="aspect-square overflow-hidden">
                <img
                  src={item.dataUrl}
                  alt={item.prompt}
                  className="h-full w-full object-cover transition group-hover:scale-105"
                />
              </div>
              <div className="p-3">
                <div className="text-xs text-muted-foreground line-clamp-2 h-8">
                  {item.prompt}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => download(item)}>
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(item.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
