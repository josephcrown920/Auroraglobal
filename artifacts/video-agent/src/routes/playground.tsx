import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Wand2,
  StopCircle,
  RefreshCw,
  Download,
  Copy,
  History,
  Loader2,
  Maximize2,
  Bookmark,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { streamImage } from "@/lib/streamImage";
import { gallery, prompts, uid, type GalleryItem } from "@/lib/studio-store";

export const Route = createFileRoute("/playground")({
  head: () => ({
    meta: [
      { title: "Playground — AI Studio" },
      {
        name: "description",
        content:
          "Generate images with streaming previews. Prompt, negative prompt, history, and one-click save.",
      },
      { property: "og:title", content: "Playground — AI Studio" },
      { property: "og:description", content: "Streaming image generation playground." },
    ],
  }),
  component: Playground,
});

function Playground() {
  const [prompt, setPrompt] = useState("");
  const [negative, setNegative] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [isFinal, setIsFinal] = useState(false);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [history, setHistory] = useState<GalleryItem[]>([]);
  const [fullscreen, setFullscreen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setHistory(gallery.list());
  }, []);

  function log(line: string) {
    setLogs((l) => [`${new Date().toLocaleTimeString()} · ${line}`, ...l].slice(0, 80));
  }

  async function generate(overridePrompt?: string) {
    const p = (overridePrompt ?? prompt).trim();
    if (!p) {
      toast.error("Enter a prompt first");
      return;
    }
    setImage(null);
    setIsFinal(false);
    setRunning(true);
    setElapsed(0);
    log(`▶ Generating: "${p.slice(0, 60)}${p.length > 60 ? "…" : ""}"`);
    const start = Date.now();
    timerRef.current = setInterval(() => setElapsed(Date.now() - start), 100);
    const controller = new AbortController();
    abortRef.current = controller;
    const composed = negative.trim()
      ? `${p}\n\nAvoid: ${negative.trim()}`
      : p;
    try {
      await streamImage(
        "/api/generate-image",
        composed,
        (url, final) => {
          setImage(url);
          if (final) {
            setIsFinal(true);
            log("✔ Completed");
            const item: GalleryItem = {
              id: uid(),
              prompt: p,
              dataUrl: url,
              createdAt: Date.now(),
              kind: "image",
            };
            gallery.add(item);
            setHistory(gallery.list());
          } else {
            log("… partial frame");
          }
        },
        controller.signal,
      );
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        log("■ Stopped");
      } else {
        const msg = (err as Error).message;
        log(`✖ ${msg}`);
        toast.error(msg);
      }
    } finally {
      setRunning(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  function download() {
    if (!image) return;
    const a = document.createElement("a");
    a.href = image;
    a.download = `studio-${Date.now()}.png`;
    a.click();
  }

  function savePrompt() {
    if (!prompt.trim()) return;
    prompts.save({
      id: uid(),
      title: prompt.slice(0, 60),
      body: prompt,
      category: "Playground",
      favorite: false,
      createdAt: Date.now(),
    });
    toast.success("Saved to Prompt Library");
  }

  return (
    <div className="flex h-[calc(100vh-3rem)]">
      {/* Left: controls */}
      <div className="w-[380px] shrink-0 border-r border-border/50 flex flex-col">
        <div className="p-4 border-b border-border/50">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            Prompt
          </div>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A cinematic portrait of a cyberpunk oracle, neon rim light…"
            className="mt-2 h-32 resize-none glass"
          />
          <div className="mt-3 text-xs uppercase tracking-widest text-muted-foreground">
            Negative
          </div>
          <Textarea
            value={negative}
            onChange={(e) => setNegative(e.target.value)}
            placeholder="blurry, low quality, extra fingers…"
            className="mt-2 h-16 resize-none glass"
          />
          <div className="mt-3 grid grid-cols-2 gap-2">
            {!running ? (
              <Button onClick={() => generate()} className="col-span-2 glow">
                <Wand2 className="h-4 w-4" /> Generate
              </Button>
            ) : (
              <Button onClick={stop} variant="destructive" className="col-span-2">
                <StopCircle className="h-4 w-4" /> Stop
              </Button>
            )}
            <Button
              variant="secondary"
              disabled={running || !prompt.trim()}
              onClick={() => generate()}
            >
              <RefreshCw className="h-4 w-4" /> Regenerate
            </Button>
            <Button variant="secondary" onClick={savePrompt} disabled={!prompt.trim()}>
              <Bookmark className="h-4 w-4" /> Save
            </Button>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {running ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Streaming
                </span>
              ) : (
                "Idle"
              )}
            </span>
            <span className="tabular-nums">{(elapsed / 1000).toFixed(1)}s</span>
          </div>
        </div>

        {/* History */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="px-4 pt-3 pb-1 flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <History className="h-3.5 w-3.5" /> History
          </div>
          <ScrollArea className="flex-1">
            <div className="grid grid-cols-3 gap-2 p-3">
              {history.length === 0 && (
                <div className="col-span-3 text-xs text-muted-foreground p-4 text-center">
                  Your generations appear here.
                </div>
              )}
              {history.map((h) => (
                <button
                  key={h.id}
                  onClick={() => {
                    setImage(h.dataUrl);
                    setIsFinal(true);
                    setPrompt(h.prompt);
                  }}
                  className="group relative aspect-square overflow-hidden rounded-md border border-border/50 hover:border-primary/50 transition"
                >
                  <img src={h.dataUrl} className="h-full w-full object-cover" alt="" />
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Logs */}
        <div className="border-t border-border/50 h-32 flex flex-col">
          <div className="px-4 pt-2 pb-1 text-xs uppercase tracking-widest text-muted-foreground">
            Logs
          </div>
          <ScrollArea className="flex-1">
            <div className="px-4 pb-3 text-[11px] font-mono text-muted-foreground space-y-0.5">
              {logs.length === 0 ? (
                <div>—</div>
              ) : (
                logs.map((l, i) => <div key={i}>{l}</div>)
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Right: preview */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex-1 min-h-0 flex items-center justify-center p-8 relative overflow-hidden bg-hero">
          {image ? (
            <div className="relative max-h-full max-w-full">
              <img
                src={image}
                alt="Generated"
                className={
                  "max-h-[calc(100vh-10rem)] max-w-full rounded-xl shadow-2xl transition-[filter] duration-500 " +
                  (isFinal ? "blur-0" : "blur-2xl")
                }
              />
              <Button
                size="icon"
                variant="secondary"
                onClick={() => setFullscreen(true)}
                className="absolute top-3 right-3"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl glass">
                <Wand2 className="h-8 w-8 text-primary" />
              </div>
              <div className="mt-4 text-lg font-medium">Nothing generated yet</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Write a prompt and hit Generate.
              </div>
            </div>
          )}
        </div>

        {image && (
          <div className="border-t border-border/50 p-3 flex items-center gap-2">
            <Button variant="secondary" onClick={download} disabled={!isFinal}>
              <Download className="h-4 w-4" /> Download
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                navigator.clipboard.writeText(prompt);
                toast.success("Prompt copied");
              }}
            >
              <Copy className="h-4 w-4" /> Copy prompt
            </Button>
            <div className="flex-1" />
            <span className="text-xs text-muted-foreground truncate max-w-[50%]">
              {prompt}
            </span>
          </div>
        )}
      </div>

      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-2 bg-background/95">
          {image && (
            <img src={image} alt="Fullscreen" className="max-h-[90vh] mx-auto rounded" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
