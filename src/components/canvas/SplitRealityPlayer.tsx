import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Wand2, Loader2, AlertTriangle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

type Side = { url?: string; videoUrl?: string; label: string };

interface Props {
  ultra: Side;
  cinematic: Side;
  prompt?: string;
  hasAudio?: boolean;
  hasLipSync?: boolean;
  animating?: boolean;
  onAnimateBoth?: () => void;
}

export function SplitRealityPlayer({
  ultra,
  cinematic,
  prompt,
  hasAudio,
  hasLipSync,
  animating,
  onAnimateBoth,
}: Props) {
  const leftRef = useRef<HTMLVideoElement | null>(null);
  const rightRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const leftSrc = ultra.videoUrl ?? ultra.url;
  const rightSrc = cinematic.videoUrl ?? cinematic.url;
  const leftIsVideo = !!ultra.videoUrl;
  const rightIsVideo = !!cinematic.videoUrl;
  const anyVideo = leftIsVideo || rightIsVideo;

  const sync = (action: "play" | "pause" | "restart") => {
    [leftRef.current, rightRef.current].forEach((v) => {
      if (!v) return;
      if (action === "play") v.play().catch(() => {});
      if (action === "pause") v.pause();
      if (action === "restart") {
        v.currentTime = 0;
        v.play().catch(() => {});
      }
    });
    if (action === "pause") setPlaying(false);
    else setPlaying(true);
  };

  useEffect(() => {
    const v = (leftRef.current ?? rightRef.current);
    if (!v) return;
    const onTime = () => setProgress(v.duration ? v.currentTime / v.duration : 0);
    const onEnd = () => setPlaying(false);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("ended", onEnd);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("ended", onEnd);
    };
  }, [leftSrc, rightSrc]);

  const checklist = useMemo(() => {
    const items: { ok: boolean; label: string }[] = [
      { ok: !!ultra.url, label: "Ultra-realism still" },
      { ok: !!cinematic.url, label: "Cinematic still" },
      { ok: leftIsVideo, label: "Animate ultra side" },
      { ok: rightIsVideo, label: "Animate cinematic side" },
      { ok: !!prompt && prompt.length > 12, label: "Detailed base prompt (12+ chars)" },
      { ok: !!hasAudio, label: "Audio track wired in" },
      { ok: !!hasLipSync, label: "Lip-sync pass applied" },
    ];
    return items;
  }, [ultra.url, cinematic.url, leftIsVideo, rightIsVideo, prompt, hasAudio, hasLipSync]);
  const remaining = checklist.filter((c) => !c.ok).length;

  return (
    <div className="bg-black/40 border-t border-white/5">
      <div className="grid grid-cols-2 gap-px bg-white/5 relative">
        <div className="relative bg-black aspect-square">
          {leftSrc ? (
            leftIsVideo ? (
              <video ref={leftRef} src={leftSrc} muted playsInline className="w-full h-full object-cover" />
            ) : (
              <img src={leftSrc} alt="ultra" className="w-full h-full object-cover" />
            )
          ) : null}
          <span className="absolute top-1 left-1 text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/70 text-emerald-300 border border-emerald-400/30">
            {ultra.label}
          </span>
        </div>
        <div className="relative bg-black aspect-square">
          {rightSrc ? (
            rightIsVideo ? (
              <video ref={rightRef} src={rightSrc} muted playsInline className="w-full h-full object-cover" />
            ) : (
              <img src={rightSrc} alt="cinematic" className="w-full h-full object-cover" />
            )
          ) : null}
          <span className="absolute top-1 right-1 text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/70 text-amber-300 border border-amber-400/30">
            {cinematic.label}
          </span>
        </div>
      </div>

      <div className="p-2 space-y-2">
        <div className="flex items-center gap-1.5">
          {anyVideo ? (
            <>
              <Button size="sm" variant="ghost" className="h-7 px-2 nodrag" onClick={() => sync(playing ? "pause" : "play")}>
                {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2 nodrag" onClick={() => sync("restart")}>
                <RotateCcw className="size-3.5" />
              </Button>
              <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-400 to-amber-400 transition-all" style={{ width: `${progress * 100}%` }} />
              </div>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs nodrag border-white/15 bg-white/5 w-full"
              disabled={!ultra.url || !cinematic.url || animating}
              onClick={onAnimateBoth}
            >
              {animating ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Wand2 className="size-3.5 mr-1" />}
              {animating ? "Animating both sides…" : "Animate both for playback"}
            </Button>
          )}
        </div>

        <details className="rounded border border-white/10 bg-black/30 nodrag" onMouseDownCapture={(e) => e.stopPropagation()}>
          <summary className="px-2 py-1.5 text-[10px] font-mono uppercase tracking-wider cursor-pointer flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="size-3 text-amber-400" />
              Refinement checklist
            </span>
            <span className={remaining === 0 ? "text-emerald-300" : "text-amber-300"}>
              {remaining === 0 ? "shot complete" : `${remaining} left`}
            </span>
          </summary>
          <ul className="px-2 pb-2 pt-1 space-y-0.5">
            {checklist.map((c, i) => (
              <li key={i} className="flex items-center gap-1.5 text-[10px]">
                {c.ok ? (
                  <Check className="size-3 text-emerald-400" />
                ) : (
                  <span className="size-3 rounded-full border border-white/20 inline-block" />
                )}
                <span className={c.ok ? "text-foreground/70" : "text-foreground/50"}>{c.label}</span>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </div>
  );
}
