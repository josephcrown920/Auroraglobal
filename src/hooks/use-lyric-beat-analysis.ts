import { useEffect, useMemo, useRef, useState } from "react";
import { lyricAnalysisMarkerAfterCleanup, lyricBeatGate } from "@/lib/music-video-prompts";
import { useBeatDetect } from "./use-beat-detect";

/**
 * Analyzes the song used by either Lyric Video entry point. `active` must be
 * tied to Lyric Video mode: leaving that mode cancels the current decode and
 * clears the URL marker, allowing a later return to analyze the song again.
 */
export function useLyricBeatAnalysis(audioUrl: string | null, active: boolean) {
  const { state, analyze, reset } = useBeatDetect();
  const analyzedUrlRef = useRef<string | null>(null);
  const [fetchFailed, setFetchFailed] = useState(false);

  // A prior song's completed result is never considered ready for a new URL
  // during the render before its cleanup effect runs.
  const isCurrentSong = analyzedUrlRef.current === audioUrl;
  const currentStatus = isCurrentSong ? state.status : "idle";
  const beatTimestamps =
    isCurrentSong && state.status === "done" && state.result.beatTimestamps.length > 0
      ? state.result.beatTimestamps
      : null;
  const gate = lyricBeatGate({
    hasAudio: !!audioUrl,
    beatStatus: currentStatus,
    analysisFailed: isCurrentSong && fetchFailed,
  });

  useEffect(() => {
    if (!audioUrl) {
      analyzedUrlRef.current = null;
      setFetchFailed(false);
      reset();
      return;
    }

    if (!active) {
      // Do not retain an analysis marker across a Lyric Video mode change.
      // Returning to the mode should get a fresh result for this song.
      analyzedUrlRef.current = null;
      setFetchFailed(false);
      reset();
      return;
    }

    if (analyzedUrlRef.current === audioUrl) return;

    analyzedUrlRef.current = audioUrl;
    setFetchFailed(false);
    reset();
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch(audioUrl);
        if (!response.ok) throw new Error(`song fetch ${response.status}`);
        const blob = await response.blob();
        if (cancelled) return;
        void analyze(new File([blob], "song", { type: blob.type || "audio/mpeg" }));
      } catch {
        // A fetch failure is a terminal analysis failure. The caller can
        // explicitly show and use the documented even-split fallback.
        if (!cancelled) setFetchFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      analyzedUrlRef.current = lyricAnalysisMarkerAfterCleanup(
        analyzedUrlRef.current,
        audioUrl,
      );
      reset();
    };
  }, [active, analyze, audioUrl, reset]);

  return useMemo(
    () => ({ state, beatTimestamps, gate }),
    [beatTimestamps, gate, state],
  );
}