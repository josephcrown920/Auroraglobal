import { useRef, useState, useEffect, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Captions, Pencil, CheckCircle2, Download } from "lucide-react";
import { transcribeVideoForCaptions, type CaptionSegment } from "@/lib/hf.functions";
import { burnCaptions } from "@/lib/captions.functions";
import { saveAssetToDisk } from "@/lib/save";

const CAPTION_COST = 2;

type Step = "idle" | "transcribing" | "preview" | "burning" | "done";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  videoUrl: string;
  generationId?: string;
  onDone?: (newVideoUrl: string) => void;
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60).toString().padStart(2, "0");
  const ms = Math.round((s % 1) * 10);
  return `${m}:${ss}.${ms}`;
}

function CaptionOverlay({ segments, currentTime }: { segments: CaptionSegment[]; currentTime: number }) {
  const active = segments.find((s) => currentTime >= s.start && currentTime <= s.end);
  if (!active) return null;
  return (
    <div className="absolute bottom-8 left-0 right-0 flex justify-center px-4 pointer-events-none">
      <span className="bg-black/75 text-white text-sm font-medium px-3 py-1.5 rounded-lg text-center leading-snug max-w-[90%]">
        {active.text}
      </span>
    </div>
  );
}

export function CaptionDialog({ open, onOpenChange, videoUrl, generationId, onDone }: Props) {
  const [step, setStep] = useState<Step>("idle");
  const [segments, setSegments] = useState<CaptionSegment[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [doneUrl, setDoneUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const transcribeFn = useServerFn(transcribeVideoForCaptions);
  const burnFn = useServerFn(burnCaptions);

  const transcribeMut = useMutation({
    mutationFn: () => transcribeFn({ data: { videoUrl } }),
    onSuccess: (res) => {
      setSegments(res.segments);
      setStep("preview");
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Transcription failed");
      setStep("idle");
    },
  });

  const burnMut = useMutation({
    mutationFn: () =>
      burnFn({
        data: {
          videoUrl,
          segments,
          sourceGenerationId: generationId,
        },
      }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error ?? "Caption burn failed");
        setStep("preview");
        return;
      }
      setDoneUrl(res.videoUrl);
      setStep("done");
      onDone?.(res.videoUrl);
      toast.success("Captions burned into video");
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Caption burn failed");
      setStep("preview");
    },
  });

  const handleTranscribe = useCallback(() => {
    setStep("transcribing");
    transcribeMut.mutate();
  }, [transcribeMut]);

  const handleBurn = useCallback(() => {
    setStep("burning");
    burnMut.mutate();
  }, [burnMut]);

  const handleEditStart = (idx: number) => {
    setEditingIdx(idx);
    setEditText(segments[idx].text);
  };

  const handleEditSave = () => {
    if (editingIdx === null) return;
    setSegments((prev) =>
      prev.map((s, i) => (i === editingIdx ? { ...s, text: editText } : s))
    );
    setEditingIdx(null);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
  };

  useEffect(() => {
    if (!open) {
      setStep("idle");
      setSegments([]);
      setCurrentTime(0);
      setEditingIdx(null);
      setDoneUrl(null);
    }
  }, [open]);

  useEffect(() => {
    if (editingIdx === null || !listRef.current) return;
    const el = listRef.current.querySelectorAll("[data-seg-idx]")[editingIdx] as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [editingIdx]);

  const isBusy = step === "transcribing" || step === "burning";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isBusy) onOpenChange(v); }}>
      <DialogContent className="max-w-2xl w-full gap-0 p-0 overflow-hidden bg-card border border-border">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Captions className="size-4 text-primary" />
            Add Captions
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {step === "idle" && "Transcribe your video's audio then review and edit captions before burning them in."}
            {step === "transcribing" && "Transcribing audio with Whisper — this may take 20–40 seconds…"}
            {step === "preview" && `${segments.length} caption segments — edit any text, then burn in for ${CAPTION_COST} Aura.`}
            {step === "burning" && "Burning captions into video — dispatched to your GPU worker…"}
            {step === "done" && "Done! Your captioned video has been saved to the gallery."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 p-5">
          <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
            <video
              ref={videoRef}
              src={step === "done" && doneUrl ? doneUrl : videoUrl}
              className="w-full h-full object-contain"
              controls
              playsInline
              onTimeUpdate={handleTimeUpdate}
            />
            {step === "preview" && segments.length > 0 && (
              <CaptionOverlay segments={segments} currentTime={currentTime} />
            )}
          </div>

          {(step === "transcribing" || step === "burning") && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-primary flex-shrink-0" />
              {step === "transcribing" ? "Transcribing with Whisper…" : "GPU worker burning captions…"}
            </div>
          )}

          {step === "preview" && segments.length > 0 && (
            <div
              ref={listRef}
              className="max-h-52 overflow-y-auto space-y-1.5 rounded-xl border border-border bg-background/50 p-2"
            >
              {segments.map((seg, i) => (
                <div
                  key={i}
                  data-seg-idx={i}
                  className={`flex gap-2 items-start rounded-lg px-2.5 py-2 transition-colors ${
                    currentTime >= seg.start && currentTime <= seg.end
                      ? "bg-primary/10 border border-primary/30"
                      : "hover:bg-accent/50 border border-transparent"
                  }`}
                >
                  <span className="text-[10px] text-muted-foreground tabular-nums mt-0.5 flex-shrink-0">
                    {formatTime(seg.start)}–{formatTime(seg.end)}
                  </span>
                  {editingIdx === i ? (
                    <div className="flex-1 flex gap-1.5">
                      <input
                        autoFocus
                        className="flex-1 text-xs bg-background border border-border rounded px-2 py-0.5 outline-none focus:border-primary"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleEditSave();
                          if (e.key === "Escape") setEditingIdx(null);
                        }}
                      />
                      <button
                        onClick={handleEditSave}
                        className="text-primary hover:text-primary/80"
                        title="Save"
                      >
                        <CheckCircle2 className="size-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      className="flex-1 text-xs text-left hover:text-primary transition-colors group flex items-start gap-1"
                      onClick={() => handleEditStart(i)}
                    >
                      <span className="flex-1">{seg.text}</span>
                      <Pencil className="size-3 opacity-0 group-hover:opacity-60 flex-shrink-0 mt-0.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {step === "preview" && segments.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No speech detected in this video.
            </p>
          )}

          {step === "done" && doneUrl && (
            <p className="text-xs text-muted-foreground text-center">
              The captioned video was saved to your gallery automatically.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            {step === "idle" && (
              <>
                <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleTranscribe}>
                  <Captions className="size-3.5 mr-1.5" />
                  Transcribe Audio
                </Button>
              </>
            )}

            {step === "preview" && (
              <>
                <Button variant="ghost" size="sm" onClick={() => setStep("idle")}>
                  Re-transcribe
                </Button>
                <Button
                  size="sm"
                  disabled={segments.length === 0}
                  onClick={handleBurn}
                >
                  Confirm & Burn Captions · {CAPTION_COST} Aura
                </Button>
              </>
            )}

            {step === "done" && doneUrl && (
              <>
                <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => saveAssetToDisk(doneUrl, `aurora-captioned-${Date.now()}.mp4`)}
                >
                  <Download className="size-3.5 mr-1.5" />
                  Download
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
