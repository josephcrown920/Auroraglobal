import { useState } from "react";
import { Loader2, Play, Upload } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { runFlow } from "@/lib/run-flow.functions";

export function FlowsPanel({ seedImage }: { seedImage?: string | null }) {
  const run = useServerFn(runFlow);
  const [prompt, setPrompt] = useState("Create a cinematic variation of this scene with the same environment and no people.");
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  return <section className="grid gap-5 rounded-2xl border border-white/10 bg-black/20 p-4 lg:grid-cols-[1fr_1.2fr]"><div><div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-white/55"><Play className="size-4 text-primary" /> Creative flow</div><p className="mb-4 text-xs leading-relaxed text-white/45">Turn the active frame into a focused one-step variation. The flow keeps your reference attached.</p><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} className="min-h-28 w-full rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-white/75 outline-none focus:border-primary" /><button disabled={!seedImage || busy} onClick={async () => { if (!seedImage) return; setBusy(true); try { const result = await run({ data: { prompt, images: [seedImage] } }); setOutput(result.imageDataUrl); } finally { setBusy(false); } }} className="mt-3 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">{busy ? <Loader2 className="size-4 animate-spin" /> : <><Upload className="mr-1 inline size-3.5" />Run flow</>}</button></div><div className="flex min-h-52 items-center justify-center overflow-hidden rounded-xl border border-white/8 bg-black/30">{output ? <img src={output} alt="Flow output" className="h-full w-full object-contain" /> : <span className="text-xs text-white/35">Your flow output appears here.</span>}</div></section>;
}