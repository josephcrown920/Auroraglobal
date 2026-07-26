import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Bookmark,
  Copy,
  Download,
  Plus,
  Star,
  Trash2,
  Upload,
  Search,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { prompts, uid, type PromptItem } from "@/lib/studio-store";

export const Route = createFileRoute("/prompts")({
  head: () => ({
    meta: [
      { title: "Prompt Library — AI Studio" },
      { name: "description", content: "Save, tag, and reuse your best prompts." },
      { property: "og:title", content: "Prompt Library — AI Studio" },
      { property: "og:description", content: "Save, tag, and reuse your best prompts." },
    ],
  }),
  component: Prompts,
});

function Prompts() {
  const [items, setItems] = useState<PromptItem[]>([]);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<PromptItem | null>(null);
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setItems(prompts.list());
  }, []);

  const filtered = useMemo(
    () =>
      items.filter(
        (p) =>
          !q ||
          p.title.toLowerCase().includes(q.toLowerCase()) ||
          p.body.toLowerCase().includes(q.toLowerCase()) ||
          p.category.toLowerCase().includes(q.toLowerCase()),
      ),
    [items, q],
  );

  function openNew() {
    setEditing({
      id: uid(),
      title: "",
      body: "",
      category: "General",
      favorite: false,
      createdAt: Date.now(),
    });
    setOpen(true);
  }

  function save() {
    if (!editing) return;
    if (!editing.title.trim() || !editing.body.trim()) {
      toast.error("Title and body required");
      return;
    }
    prompts.save(editing);
    setItems(prompts.list());
    setOpen(false);
    toast.success("Saved");
  }

  function exportAll() {
    const blob = new Blob([JSON.stringify(items, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prompts-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!Array.isArray(parsed)) throw new Error("Expected array");
        prompts.import(parsed);
        setItems(prompts.list());
        toast.success(`Imported ${parsed.length} prompts`);
      } catch (err) {
        toast.error(`Import failed: ${(err as Error).message}`);
      }
    };
    reader.readAsText(f);
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <header className="flex items-end justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Prompt Library</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {items.length} saved
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
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" /> Import
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={importFile}
          />
          <Button variant="secondary" onClick={exportAll} disabled={items.length === 0}>
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button onClick={openNew}>
            <Plus className="h-4 w-4" /> New
          </Button>
        </div>
      </header>

      {filtered.length === 0 ? (
        <div className="glass rounded-2xl p-16 text-center">
          <Bookmark className="mx-auto h-10 w-10 text-muted-foreground" />
          <div className="mt-3 text-sm">
            {items.length === 0 ? "No prompts yet. Add one to get started." : "No matches."}
          </div>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered
            .sort((a, b) => Number(b.favorite) - Number(a.favorite))
            .map((p) => (
              <div key={p.id} className="glass rounded-xl p-4 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{p.title}</div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
                      {p.category}
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      prompts.save({ ...p, favorite: !p.favorite });
                      setItems(prompts.list());
                    }}
                  >
                    <Star
                      className={
                        "h-4 w-4 " +
                        (p.favorite ? "fill-primary text-primary" : "text-muted-foreground")
                      }
                    />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-4 flex-1">
                  {p.body}
                </p>
                <div className="flex items-center gap-1 pt-1 border-t border-border/40">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard.writeText(p.body);
                      toast.success("Copied");
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditing(p);
                      setOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                  <div className="flex-1" />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      prompts.remove(p.id);
                      setItems(prompts.list());
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong">
          <DialogHeader>
            <DialogTitle>Edit prompt</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <Input
                placeholder="Title"
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              />
              <Input
                placeholder="Category"
                value={editing.category}
                onChange={(e) => setEditing({ ...editing, category: e.target.value })}
              />
              <Textarea
                placeholder="Prompt body…"
                value={editing.body}
                onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                className="h-40"
              />
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={save}>Save</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
