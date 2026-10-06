import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from "@google/genai";
import { Loader2, Mic, MicOff, Sparkles, Square } from "lucide-react";
import { toast } from "sonner";
import {
  convertLiveTranscriptToShotBrief,
  createMultishotLiveToken,
  getMultishotGeminiCapabilities,
  planMultishotWithGemini,
  type GeminiShotBrief,
} from "@/lib/multishot-gemini.functions";

type DirectorProps = {
  style: string;
  identityAnchor: string;
  aspectRatio: string;
  shotCount: number;
  referenceUrls: string[];
  audioReferenceUrl: string | null;
  onApply: (plan: GeminiShotBrief) => void;
};

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
  }
  return btoa(binary);
}

function pcm16Base64(channel: Float32Array) {
  const bytes = new Uint8Array(channel.length * 2);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < channel.length; index++) {
    const sample = Math.max(-1, Math.min(1, channel[index]));
    view.setInt16(index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return bytesToBase64(bytes);
}

function resample(channel: Float32Array, inputRate: number, outputRate: number) {
  if (inputRate === outputRate) return channel;
  const ratio = inputRate / outputRate;
  const result = new Float32Array(Math.max(1, Math.round(channel.length / ratio)));
  for (let outputIndex = 0; outputIndex < result.length; outputIndex++) {
    const start = Math.floor(outputIndex * ratio);
    const end = Math.min(channel.length, Math.max(start + 1, Math.floor((outputIndex + 1) * ratio)));
    let sum = 0;
    for (let inputIndex = start; inputIndex < end; inputIndex++) sum += channel[inputIndex];
    result[outputIndex] = sum / (end - start);
  }
  return result;
}

function decodePcm16(base64: string) {
  const binary = atob(base64);
  const samples = new Float32Array(Math.floor(binary.length / 2));
  for (let index = 0; index < samples.length; index++) {
    const low = binary.charCodeAt(index * 2);
    const high = binary.charCodeAt(index * 2 + 1);
    const value = (high << 8) | low;
    const signed = value >= 0x8000 ? value - 0x10000 : value;
    samples[index] = signed / 0x8000;
  }
  return samples;
}

function messageTranscript(message: LiveServerMessage, side: "input" | "output") {
  const transcription = side === "input"
    ? message.serverContent?.inputTranscription
    : message.serverContent?.outputTranscription;
  return transcription?.text?.trim() ?? "";
}

export function GeminiMultishotDirector(props: DirectorProps) {
  const capabilitiesFn = useServerFn(getMultishotGeminiCapabilities);
  const planFn = useServerFn(planMultishotWithGemini);
  const tokenFn = useServerFn(createMultishotLiveToken);
  const transcriptFn = useServerFn(convertLiveTranscriptToShotBrief);
  const [direction, setDirection] = useState("");
  const [planning, setPlanning] = useState(false);
  const [liveState, setLiveState] = useState<"idle" | "connecting" | "live" | "stopping">("idle");
  const [transcript, setTranscript] = useState("");
  const [latestBrief, setLatestBrief] = useState<GeminiShotBrief | null>(null);
  const [provenance, setProvenance] = useState<{
    provider: string;
    requestedModel: string;
    servingModel: string;
    transport: string;
  } | null>(null);
  const [capabilities, setCapabilities] = useState<Awaited<ReturnType<typeof capabilitiesFn>> | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const playbackCursorRef = useRef(0);
  const deadlineRef = useRef<number | null>(null);
  const transcriptRef = useRef("");

  useEffect(() => {
    void capabilitiesFn().then(setCapabilities).catch(() => undefined);
  }, [capabilitiesFn]);

  function cleanup() {
    if (deadlineRef.current) window.clearTimeout(deadlineRef.current);
    deadlineRef.current = null;
    processorRef.current?.disconnect();
    processorRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void contextRef.current?.close();
    contextRef.current = null;
    playbackCursorRef.current = 0;
    const session = sessionRef.current;
    sessionRef.current = null;
    session?.close();
  }

  useEffect(() => cleanup, []);

  async function planFromReferences() {
    setPlanning(true);
    try {
      const result = await planFn({
        data: {
          direction,
          style: props.style,
          identityAnchor: props.identityAnchor,
          aspectRatio: props.aspectRatio as "16:9",
          shotCount: props.shotCount,
          referenceUrls: props.referenceUrls,
          audioReferenceUrl: props.audioReferenceUrl,
        },
      });
      setProvenance(result.provenance);
      setLatestBrief(result);
      props.onApply(result);
      toast.success(`Gemini planned ${result.shots.length} editable shots`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gemini planning failed");
    } finally {
      setPlanning(false);
    }
  }

  function receiveLiveMessage(message: LiveServerMessage) {
    const input = messageTranscript(message, "input");
    const output = messageTranscript(message, "output");
    if (input || output) {
      setTranscript((current) => {
        const next = `${current}${input ? `\nDirector: ${input}` : ""}${output ? `\nGemini: ${output}` : ""}`.trim();
        transcriptRef.current = next;
        return next;
      });
    }
    const audio = message.serverContent?.modelTurn?.parts?.find((part) =>
      part.inlineData?.data && part.inlineData.mimeType?.startsWith("audio/pcm")
    )?.inlineData?.data;
    const audioContext = contextRef.current;
    if (audio && audioContext) {
      const samples = decodePcm16(audio);
      const buffer = audioContext.createBuffer(1, samples.length, 24_000);
      buffer.copyToChannel(samples, 0);
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      const startsAt = Math.max(audioContext.currentTime, playbackCursorRef.current);
      source.start(startsAt);
      playbackCursorRef.current = startsAt + buffer.duration;
    }
  }

  async function startLive() {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("This browser does not support microphone capture");
      return;
    }
    setLiveState("connecting");
    setTranscript("");
    transcriptRef.current = "";
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      const auth = await tokenFn({ data: { purpose: "multishot_voice_director" } });
      const client = new GoogleGenAI({
        apiKey: auth.token,
        httpOptions: { apiVersion: "v1alpha" },
      });
      const session = await client.live.connect({
        model: auth.model,
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onmessage: receiveLiveMessage,
          onerror: () => {
            cleanup();
            setLiveState("idle");
            toast.error("Google Live Voice connection failed");
          },
          onclose: () => {
            cleanup();
            setLiveState("idle");
          },
        },
      });
      sessionRef.current = session;
      const audioContext = new AudioContext({ sampleRate: 16_000 });
      contextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(2048, 1, 1);
      processorRef.current = processor;
      processor.onaudioprocess = (event) => {
        if (!sessionRef.current) return;
        const mono16Khz = resample(event.inputBuffer.getChannelData(0), audioContext.sampleRate, 16_000);
        sessionRef.current.sendRealtimeInput({
          audio: { mimeType: "audio/pcm;rate=16000", data: pcm16Base64(mono16Khz) },
        });
      };
      source.connect(processor);
      processor.connect(audioContext.destination);
      setLiveState("live");
      deadlineRef.current = window.setTimeout(() => void stopLive(), auth.sessionLimitMinutes * 60_000);
    } catch (error) {
      cleanup();
      setLiveState("idle");
      const denied = error instanceof DOMException && error.name === "NotAllowedError";
      toast.error(denied ? "Microphone permission was denied" : error instanceof Error ? error.message : "Could not start Live Voice");
    }
  }

  async function stopLive() {
    if (!sessionRef.current && !streamRef.current) return;
    setLiveState("stopping");
    const session = sessionRef.current;
    processorRef.current?.disconnect();
    processorRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    session?.sendRealtimeInput({ audioStreamEnd: true });
    await new Promise((resolve) => window.setTimeout(resolve, 700));
    cleanup();
    const captured = transcriptRef.current.trim();
    if (captured.length < 4) {
      setLiveState("idle");
      toast.info("No usable speech transcript was received");
      return;
    }
    try {
      const result = await transcriptFn({
        data: {
          transcript: captured,
          direction,
          style: props.style,
          identityAnchor: props.identityAnchor,
          aspectRatio: props.aspectRatio as "16:9",
          shotCount: props.shotCount,
        },
      });
      setProvenance(result.provenance);
      setLatestBrief(result);
      props.onApply(result);
      toast.success("Live direction applied as editable shot briefs");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not apply Live transcript");
    } finally {
      setLiveState("idle");
    }
  }

  const live = capabilities?.liveVoice;
  return (
    <section className="rounded-2xl border border-prime/20 bg-prime/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-ink"><Sparkles className="size-4 text-prime" /> Gemini multimodal director</div>
          <p className="mt-1 text-xs text-ink-dim">
            Google {capabilities?.planning.model ?? "capability loading"} inspects owned images and audio, then returns editable briefs.
          </p>
        </div>
        <span className="rounded-md border border-line/50 px-2 py-1 text-[10px] text-ink-dim">
          {provenance ? `${provenance.provider} · ${provenance.servingModel}` : "Serving provenance shown after planning"}
        </span>
      </div>
      <textarea
        className="previs-editable-textarea mt-3"
        rows={2}
        value={direction}
        onChange={(event) => setDirection(event.target.value)}
        placeholder="Creative intent, story beat, must-have action, or questions for the voice director…"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="previs-analyze-btn" disabled={planning || capabilities?.planning.access === "not_configured"} onClick={() => void planFromReferences()}>
          {planning ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Plan from references
        </button>
        {live?.access === "available" ? (
          liveState === "idle"
            ? <button className="previs-plate-action-btn previs-plate-action-btn--premium" onClick={() => void startLive()}><Mic className="size-3" /> Start Live Voice</button>
            : <button className="previs-plate-action-btn" disabled={liveState === "connecting" || liveState === "stopping"} onClick={() => void stopLive()}>
                {liveState === "live" ? <Square className="size-3" /> : <Loader2 className="size-3 animate-spin" />}
                {liveState === "live" ? "Stop & apply transcript" : liveState === "connecting" ? "Connecting…" : "Applying…"}
              </button>
        ) : (
          <span className="flex items-center gap-1 text-xs text-amber-300"><MicOff className="size-3" />{live?.reason ?? "Checking direct Google Live access…"}</span>
        )}
      </div>
      {live?.access === "available" && <p className="mt-2 text-[11px] text-ink-dim">
        Direct {live.provider} · {live.model} · microphone permission required · {live.sessionLimitMinutes}-minute maximum · {live.rateLimit}.
      </p>}
      {provenance && <p className="mt-2 text-[11px] text-ink-dim">
        Requested and served: {provenance.servingModel} via {provenance.transport}. No non-Google planning fallback was used.
      </p>}
      {latestBrief && <div className="mt-3 rounded-lg border border-line/40 bg-black/10 p-3">
        <p className="text-xs font-semibold text-ink">{latestBrief.brief}</p>
        <p className="mt-1 text-[11px] text-ink-dim">Continuity: {latestBrief.continuity || "No additional continuity note."}</p>
        <p className="mt-1 text-[11px] text-emerald-400">Applied to the editable shot fields below; saving or rendering still requires your explicit action.</p>
      </div>}
      {transcript && <div className="mt-3 max-h-32 overflow-y-auto rounded-lg border border-line/40 bg-black/10 p-3 text-xs whitespace-pre-wrap text-ink-dim">{transcript}</div>}
    </section>
  );
}