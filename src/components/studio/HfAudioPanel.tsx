import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Loader2, Mic2, Volume2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { transcribeAudio, synthesizeSpeech } from "@/lib/hf.functions";

/**
 * Hugging Face audio tools panel for the Studio.
 *   • Transcribe: record from mic OR upload an audio file → Whisper text
 *   • Speak:      text → Bark MP3, with playback + reuse-as-lipsync-audio handler
 */
export function HfAudioPanel({ onAudioReady }: { onAudioReady?: (url: string) => void }) {
  const transcribeFn = useServerFn(transcribeAudio);
  const speakFn = useServerFn(synthesizeSpeech);

  const [transcript, setTranscript] = useState("");
  const [copied, setCopied] = useState(false);
  const [ttsText, setTtsText] = useState("");
  const [ttsUrl, setTtsUrl] = useState<string | null>(null);

  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);

  const transcribeMut = useMutation({
    mutationFn: async (file: Blob) => {
      const buf = await file.arrayBuffer();
      // base64 encode
      const u8 = new Uint8Array(buf);
      let bin = "";
      const chunk = 0x8000;
      for (let i = 0; i < u8.length; i += chunk) {
        bin += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + chunk)));
      }
      const base64 = btoa(bin);
      return transcribeFn({ data: { base64, mime: file.type } });
    },
    onSuccess: (r) => {
      setTranscript(r.text || "(no speech detected)");
      toast.success("Transcribed");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Transcription failed"),
  });

  const speakMut = useMutation({
    mutationFn: async () => speakFn({ data: { text: ttsText } }),
    onSuccess: (r) => {
      setTtsUrl(r.url);
      toast.success("Speech ready");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "TTS failed"),
  });

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        transcribeMut.mutate(blob);
      };
      rec.start();
      recRef.current = rec;
      setRecording(true);
    } catch {
      toast.error("Microphone permission denied");
    }
  }
  function stopRecording() {
    recRef.current?.stop();
    setRecording(false);
  }

  async function copyTranscript() {
    if (!transcript) return;
    await navigator.clipboard.writeText(transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Mic2 className="size-4 text-primary" />
        <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Voice tools · Whisper + Bark
        </h3>
      </div>

      {/* TRANSCRIBE */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Record or upload audio → get a transcript. Useful for lip-sync scripts and captions.</p>
        <div className="flex flex-wrap gap-2">
          {recording ? (
            <Button size="sm" variant="destructive" onClick={stopRecording}>
              <span className="size-2 rounded-full bg-white animate-pulse mr-2" /> Stop & transcribe
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={startRecording} disabled={transcribeMut.isPending}>
              <Mic2 className="size-3.5 mr-2" /> Record from mic
            </Button>
          )}
          <label className="inline-flex items-center text-xs px-3 py-1.5 rounded-md border border-border bg-background/60 cursor-pointer hover:border-primary/40">
            Upload file
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) transcribeMut.mutate(f);
                e.target.value = "";
              }}
            />
          </label>
          {transcribeMut.isPending && (
            <span className="inline-flex items-center text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin mr-1.5" /> Whisper transcribing…
            </span>
          )}
        </div>
        {transcript && (
          <div className="rounded-lg border border-border bg-background/60 p-3 text-sm whitespace-pre-wrap">
            {transcript}
            <button
              onClick={copyTranscript}
              className="ml-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
              type="button"
            >
              {copied ? <Check className="size-3" /> : <Copy className="size-3" />} {copied ? "Copied" : "Copy"}
            </button>
          </div>
        )}
      </div>

      {/* TTS */}
      <div className="space-y-2 pt-3 border-t border-border/60">
        <div className="flex items-center gap-2">
          <Volume2 className="size-4 text-primary" />
          <p className="text-sm font-medium">Text to speech</p>
        </div>
        <p className="text-xs text-muted-foreground">Type a line, hit Speak — get a Bark audio file you can pipe into Lip Sync.</p>
        <textarea
          value={ttsText}
          onChange={(e) => setTtsText(e.target.value.slice(0, 1000))}
          rows={2}
          placeholder="e.g. Floatin' over the city, head in the clouds…"
          className="w-full text-sm rounded-md border border-border bg-background/60 p-2 outline-none focus:border-primary/60"
        />
        <div className="flex flex-wrap gap-2 items-center">
          <Button size="sm" onClick={() => speakMut.mutate()} disabled={!ttsText.trim() || speakMut.isPending}>
            {speakMut.isPending ? <><Loader2 className="size-3.5 mr-2 animate-spin" /> Synthesizing…</> : <><Volume2 className="size-3.5 mr-2" /> Speak</>}
          </Button>
          {ttsUrl && onAudioReady && (
            <Button size="sm" variant="secondary" type="button" onClick={() => { onAudioReady(ttsUrl); toast.success("Loaded into lip sync"); }}>
              Use for lip sync →
            </Button>
          )}
        </div>
        {ttsUrl && <audio src={ttsUrl} controls className="w-full mt-1" />}
      </div>
    </div>
  );
}
