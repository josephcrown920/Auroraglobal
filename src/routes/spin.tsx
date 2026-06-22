import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Flame, Loader2, Check, Sparkles, ArrowLeft } from "lucide-react";
import { SPIN_PIECES } from "@/lib/spin.functions";

export const Route = createFileRoute("/spin")({
  component: SpinPage,
  validateSearch: (search: Record<string, unknown>) => ({
    prompt: typeof search.prompt === "string" ? search.prompt : undefined,
  }),
  errorComponent: ({ error }) => (
    <div className="p-8 text-white">Spin failed: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8 text-white">Not found.</div>,
  head: () => ({
    meta: [
      { title: "Spin 1 → 30 · Aurora" },
      { name: "description", content: "Turn one prompt into 30 scroll-stopping pieces for TikTok, Reels and Shorts." },
    ],
  }),
});

type Variant = {
  id: string;
  idx: number;
  label: string;
  status: "queued" | "running" | "done" | "error";
  url: string | null;
};

function SpinPage() {
  const search = Route.useSearch();

  const [prompt, setPrompt] = useState(search.prompt ?? "");
  const [jobId, setJobId] = useState<string | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const autoStartedRef = useRef(false);
  const startSpin = (p: string) => {
    const id = `local-${Date.now().toString(36)}`;
    setJobId(id);
    setErr(null);
    setBusy(true);
    const initial: Variant[] = SPIN_PIECES.map((label, idx) => ({
      id: `${id}-${idx}`,
      idx,
      label,
      status: "queued",
      url: null,
    }));
    setVariants(initial);
    // Progressive reveal: turn queued -> running -> done with placeholder tiles.
    initial.forEach((v) => {
      const runAt = 120 + v.idx * 140;
      const doneAt = runAt + 350 + Math.random() * 400;
      window.setTimeout(() => {
        setVariants((prev) => prev.map((x) => (x.id === v.id ? { ...x, status: "running" } : x)));
      }, runAt);
      window.setTimeout(() => {
        const seed = encodeURIComponent(`${id.slice(-6)}-${v.idx}-${p.slice(0, 16)}`);
        const url = `https://picsum.photos/seed/${seed}/512/768`;
        setVariants((prev) => prev.map((x) => (x.id === v.id ? { ...x, status: "done", url } : x)));
        if (v.idx === SPIN_PIECES.length - 1) setBusy(false);
      }, doneAt);
    });
  };

  // Auto-start when a prompt arrives via search params.
  useEffect(() => {
    if (autoStartedRef.current) return;
    if (!search.prompt || !search.prompt.trim()) return;
    autoStartedRef.current = true;
    startSpin(search.prompt.trim());
  }, [search.prompt]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    startSpin(prompt.trim());
  };

  const done = variants.filter((v) => v.status === "done").length;
  const total = variants.length || 30;
  const pct = Math.round((done / total) * 100);

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0a0512] via-[#0a0814] to-black text-white">
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-8 md:py-14">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white no-underline">
          <ArrowLeft className="size-4" /> Back
        </Link>

        <div className="mt-6 flex items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-pink-300/20 bg-pink-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-pink-200">
            <Flame className="size-3.5" /> Spin 1 → 30
          </span>
        </div>
        <h1 className="mt-3 text-4xl md:text-5xl font-extrabold tracking-tight">
          One prompt. <span className="bg-gradient-to-r from-pink-300 via-fuchsia-300 to-violet-300 bg-clip-text text-transparent">Thirty pieces.</span>
        </h1>
        <p className="mt-3 max-w-2xl text-white/70">
          Describe your idea once. Aurora fans it out across every format the For You page rewards — live below as each variant lands.
        </p>

        <form onSubmit={submit} className="mt-6 flex flex-col gap-3 md:flex-row">
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. Hot-pink cyclorama, magazine cover shoot, hair-flip hook"
            className="flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-pink-400 focus:outline-none"
            disabled={busy}
          />
          <button
            type="submit"
            disabled={busy || !prompt.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-400 to-fuchsia-500 px-6 py-3 font-bold text-white shadow-lg shadow-fuchsia-500/30 hover:opacity-95 disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Spin 30
          </button>
        </form>

        {err && <div className="mt-4 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{err}</div>}

        {jobId && (
          <section className="mt-10">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm text-white/70">
                <span className="font-semibold text-white">{done}</span> / {total} ready
              </div>
              <div className="text-xs text-white/50">job {jobId.slice(0, 8)}</div>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-gradient-to-r from-pink-400 to-fuchsia-500 transition-all" style={{ width: `${pct}%` }} />
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
              {(variants.length ? variants : Array.from({ length: 30 }).map((_, i) => ({ id: String(i), idx: i, label: "Queued", status: "queued" as const, url: null }))).map((v) => (
                <div key={v.id} className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] aspect-[2/3]">
                  {v.url ? (
                    <img src={v.url} alt={v.label} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center">
                      {v.status === "running" ? (
                        <Loader2 className="size-5 animate-spin text-pink-300" />
                      ) : (
                        <span className="size-2 rounded-full bg-white/30" />
                      )}
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/90 to-transparent p-2">
                    <span className="truncate text-[10px] font-medium text-white/90">{v.label}</span>
                    {v.status === "done" && <Check className="size-3 text-emerald-300" />}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}