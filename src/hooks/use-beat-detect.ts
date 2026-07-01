import { useCallback, useRef, useState } from "react";

export type BeatDetectResult = {
  bpm: number;
  beatTimestamps: number[];
  suggestedCuts: number;
  durationSeconds: number;
};

export type BeatDetectState =
  | { status: "idle" }
  | { status: "analyzing" }
  | { status: "done"; result: BeatDetectResult }
  | { status: "error"; message: string };

const ONSET_THRESHOLD = 0.35;
const ENERGY_WINDOW = 43;
const MIN_BEAT_GAP_MS = 200;

function detectOnsets(pcm: Float32Array, sampleRate: number): number[] {
  const HOP = 512;
  const frameCount = Math.floor(pcm.length / HOP);
  const energies: number[] = [];

  for (let i = 0; i < frameCount; i++) {
    let e = 0;
    const start = i * HOP;
    const end = Math.min(start + HOP, pcm.length);
    for (let j = start; j < end; j++) {
      e += pcm[j] * pcm[j];
    }
    energies.push(e / (end - start));
  }

  const onsets: number[] = [];
  for (let i = ENERGY_WINDOW; i < energies.length - 1; i++) {
    const windowSlice = energies.slice(i - ENERGY_WINDOW, i);
    const localMean = windowSlice.reduce((a, b) => a + b, 0) / windowSlice.length;
    const threshold = localMean * (1 + ONSET_THRESHOLD);
    if (
      energies[i] > threshold &&
      energies[i] >= energies[i - 1] &&
      energies[i] >= energies[i + 1]
    ) {
      const timeMs = ((i * HOP) / sampleRate) * 1000;
      if (onsets.length === 0 || timeMs - onsets[onsets.length - 1] >= MIN_BEAT_GAP_MS) {
        onsets.push(timeMs);
      }
    }
  }
  return onsets;
}

function estimateBpm(timestamps: number[], durationMs: number): number {
  if (timestamps.length < 2) return 0;
  if (timestamps.length >= 4) {
    const gaps: number[] = [];
    for (let i = 1; i < timestamps.length; i++) {
      gaps.push(timestamps[i] - timestamps[i - 1]);
    }
    gaps.sort((a, b) => a - b);
    const mid = Math.floor(gaps.length / 2);
    const medianGap =
      gaps.length % 2 === 0 ? (gaps[mid - 1] + gaps[mid]) / 2 : gaps[mid];
    if (medianGap > 0) return Math.round(60000 / medianGap);
  }
  return Math.round((timestamps.length / durationMs) * 60000);
}

export function useBeatDetect() {
  const [state, setState] = useState<BeatDetectState>({ status: "idle" });
  const abortRef = useRef(false);

  const analyze = useCallback(async (file: File) => {
    setState({ status: "analyzing" });
    abortRef.current = false;

    try {
      const arrayBuffer = await file.arrayBuffer();
      if (abortRef.current) return;

      type WebkitAudio = { webkitAudioContext?: typeof AudioContext };
      const AudioCtxClass =
        window.AudioContext ?? (window as Window & WebkitAudio).webkitAudioContext;
      if (!AudioCtxClass) throw new Error("Web Audio API not supported in this browser");

      const ctx = new AudioCtxClass({ sampleRate: 22050 });
      const decoded = await ctx.decodeAudioData(arrayBuffer);
      await ctx.close();
      if (abortRef.current) return;

      const pcm = decoded.getChannelData(0);
      const sampleRate = decoded.sampleRate;
      const durationMs = decoded.duration * 1000;

      const timestamps = detectOnsets(pcm, sampleRate);
      const bpm = estimateBpm(timestamps, durationMs);
      const beatTimestampsSeconds = timestamps.map((t) => Math.round(t) / 1000);
      const suggestedCuts = Math.min(timestamps.length, Math.floor(decoded.duration / 2));

      setState({
        status: "done",
        result: {
          bpm,
          beatTimestamps: beatTimestampsSeconds,
          suggestedCuts,
          durationSeconds: Math.round(decoded.duration),
        },
      });
    } catch (e) {
      setState({
        status: "error",
        message: e instanceof Error ? e.message : "Analysis failed",
      });
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current = true;
    setState({ status: "idle" });
  }, []);

  return { state, analyze, reset };
}
