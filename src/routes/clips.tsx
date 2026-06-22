import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

import joshCloseup from "@/assets/video-josh-closeup.mp4.asset.json";
import joshLowangle from "@/assets/video-josh-lowangle.mp4.asset.json";
import joshProfile from "@/assets/video-josh-profile.mp4.asset.json";
import copsA from "@/assets/video-cops-run-a.mp4.asset.json";
import copsB from "@/assets/video-cops-run-b.mp4.asset.json";
import stillV1 from "@/assets/josh-performance-still-v1.jpg";

type Clip = {
  id: string;
  title: string;
  group: "Performance Still" | "Performance Video" | "Cops Loop";
  url: string;
  duration: string;
  notes: string;
  isImage?: boolean;
  identity: "locked" | "off" | "n/a";
  framing: string;
  motion: string;
  lighting: string;
  vibe: string;
};

const clips: Clip[] = [
  { id: "still-v1", title: "Josh — Performance Still v1", group: "Performance Still", url: stillV1, duration: "still", notes: "Identity-locked from new refs.", isImage: true, identity: "locked", framing: "Tight close-up, 16:9", motion: "Still frame", lighting: "Teal/red night, rim light", vibe: "Cinematic music-video" },
  
  { id: "perf-closeup", title: "Josh — Close-up", group: "Performance Video", url: joshCloseup.url, duration: "5s", notes: "Tight portrait.", identity: "off", framing: "Tight close-up", motion: "Locked-off, micro breathing", lighting: "Hard rim light", vibe: "Portrait intimate" },
  { id: "perf-low", title: "Josh — Low-angle Hero", group: "Performance Video", url: joshLowangle.url, duration: "5s", notes: "Low hero, golden flare.", identity: "off", framing: "Low-angle hero", motion: "Slight push", lighting: "Golden-hour flare", vibe: "Dominant hero" },
  { id: "perf-profile", title: "Josh — Profile Track", group: "Performance Video", url: joshProfile.url, duration: "5s", notes: "Side dolly w/ neon streaks.", identity: "off", framing: "Side profile", motion: "Sideways dolly", lighting: "Teal shadow + sodium", vibe: "Neon street" },
  { id: "cops-a", title: "Cops — Run A", group: "Cops Loop", url: copsA.url, duration: "5s", notes: "Two officers.", identity: "n/a", framing: "Wide street", motion: "Forward run (not treadmill)", lighting: "Teal/amber night", vibe: "Chase energy" },
  { id: "cops-b", title: "Cops — Run B", group: "Cops Loop", url: copsB.url, duration: "5s", notes: "Three officers, wet asphalt.", identity: "n/a", framing: "Wide parking lot", motion: "Forward run (not treadmill)", lighting: "Cyan + red/blue cruiser", vibe: "Dystopian chase" },
];

const FRAMING_OPTS = ["", "Tight close-up", "Medium close-up", "Low-angle hero", "Wide full-body", "Side profile", "Over-the-shoulder"];
const EXPRESSION_OPTS = ["", "Mid-rap mouth open", "Cold stare", "Smirk", "Snarl / aggressive", "Eyes closed in flow", "Lip-sync energy"];
const LIGHTING_OPTS = ["", "Teal/red cruiser night", "Hard rim + deep shadow", "Golden-hour flare", "Neon storefront streaks", "Studio key light", "Underlit moody"];

type Tweak = { framing: string; expression: string; lighting: string; extra: string };
type Status = "idle" | "queued" | "approved";

export const Route = createFileRoute("/clips")({
  component: ClipsPage,
  head: () => ({
    meta: [
      { title: "Clip Preview — Generated Assets" },
      { name: "description", content: "Preview, compare, tweak, and approve generated clips." },
    ],
  }),
});

const DIFF_KEYS = [
  { key: "identity", label: "Identity match" },
  { key: "framing", label: "Framing" },
  { key: "motion", label: "Motion" },
  { key: "lighting", label: "Lighting" },
  { key: "vibe", label: "Vibe" },
  { key: "duration", label: "Duration" },
] as const;

const STORAGE_KEY = "clip-controls-v1";

function ClipsPage() {
  const groups = ["Performance Still", "Performance Video", "Cops Loop"] as const;
  const [compareOn, setCompareOn] = useState(false);
  const [leftId, setLeftId] = useState(clips[0].id);
  const [rightId, setRightId] = useState(clips[1].id);
  const leftRef = useRef<HTMLVideoElement>(null);
  const rightRef = useRef<HTMLVideoElement>(null);

  const [tweaks, setTweaks] = useState<Record<string, Tweak>>({});
  const [status, setStatus] = useState<Record<string, Status>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setTweaks(parsed.tweaks ?? {});
        setStatus(parsed.status ?? {});
      }
    } catch {}
  }, []);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ tweaks, status }));
  }, [tweaks, status]);

  const left = useMemo(() => clips.find((c) => c.id === leftId)!, [leftId]);
  const right = useMemo(() => clips.find((c) => c.id === rightId)!, [rightId]);

  const getTweak = (id: string): Tweak => tweaks[id] ?? { framing: "", expression: "", lighting: "", extra: "" };
  const setTweak = (id: string, patch: Partial<Tweak>) =>
    setTweaks((t) => ({ ...t, [id]: { ...getTweak(id), ...patch } }));

  const queueRegen = (id: string) => setStatus((s) => ({ ...s, [id]: "queued" }));
  const toggleApprove = (id: string) =>
    setStatus((s) => ({ ...s, [id]: s[id] === "approved" ? "idle" : "approved" }));

  const syncPlay = () => [leftRef, rightRef].forEach((r) => { if (r.current) { r.current.currentTime = 0; r.current.play().catch(() => {}); } });
  const syncPause = () => [leftRef, rightRef].forEach((r) => r.current?.pause());

  const queued = clips.filter((c) => status[c.id] === "queued");
  const approved = clips.filter((c) => status[c.id] === "approved");

  return (
    <main className="min-h-screen bg-background text-foreground p-6 md:p-10">
      <header className="max-w-7xl mx-auto mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Clip Preview Gallery</h1>
          <p className="text-muted-foreground mt-2">Tweak framing, expression, lighting per clip. Queue regen + approve picks.</p>
        </div>
        <button onClick={() => setCompareOn((v) => !v)} className="px-4 py-2 rounded-lg border border-border bg-card hover:bg-accent transition">
          {compareOn ? "Exit Compare" : "Compare Mode"}
        </button>
      </header>

      {(queued.length > 0 || approved.length > 0) && (
        <div className="max-w-7xl mx-auto mb-8 rounded-xl border border-border bg-card p-4 text-sm">
          {approved.length > 0 && (
            <p><span className="text-emerald-500 font-semibold">Approved ({approved.length}):</span>{" "}
              <span className="text-muted-foreground">{approved.map((c) => c.title).join(" · ")}</span></p>
          )}
          {queued.length > 0 && (
            <p className="mt-1"><span className="text-amber-500 font-semibold">Queued for regen ({queued.length}):</span>{" "}
              <span className="text-muted-foreground">{queued.map((c) => c.title).join(" · ")}</span>
              <span className="block text-xs mt-1 text-muted-foreground">Tell me "run the queue" and I'll regenerate these with your tweaks.</span></p>
          )}
        </div>
      )}

      {compareOn && (
        <section className="max-w-7xl mx-auto mb-12 rounded-2xl border border-border bg-card p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              { side: "Left", clip: left, setId: setLeftId, ref: leftRef },
              { side: "Right", clip: right, setId: setRightId, ref: rightRef },
            ].map(({ side, clip, setId, ref }) => (
              <div key={side}>
                <label className="text-xs uppercase tracking-wider text-muted-foreground">{side}</label>
                <select value={clip.id} onChange={(e) => setId(e.target.value)} className="w-full mt-1 mb-3 px-3 py-2 rounded-md bg-background border border-border">
                  {clips.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
                <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                  {clip.isImage
                    ? <img src={clip.url} alt={clip.title} className="w-full h-full object-cover" />
                    : <video key={clip.id} ref={ref} src={clip.url} className="w-full h-full object-cover" controls muted loop playsInline preload="metadata" />}
                  <span className="absolute bottom-2 right-2 text-xs px-2 py-1 rounded bg-black/70 text-white font-mono">{clip.duration}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={syncPlay} className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground">Sync Play</button>
            <button onClick={syncPause} className="px-3 py-1.5 text-sm rounded-md border border-border">Pause Both</button>
          </div>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2 pr-4 font-medium">Attribute</th>
                  <th className="py-2 pr-4 font-medium">{left.title}</th>
                  <th className="py-2 pr-4 font-medium">{right.title}</th>
                  <th className="py-2 font-medium">Match</th>
                </tr>
              </thead>
              <tbody>
                {DIFF_KEYS.map(({ key, label }) => {
                  const lv = String((left as any)[key]);
                  const rv = String((right as any)[key]);
                  const same = lv === rv;
                  return (
                    <tr key={key} className="border-b border-border/50">
                      <td className="py-2 pr-4 font-medium">{label}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{lv}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{rv}</td>
                      <td className="py-2"><span className={same ? "text-emerald-500" : "text-amber-500"}>{same ? "✓ same" : "✕ differs"}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="max-w-7xl mx-auto space-y-12">
        {groups.map((g) => (
          <section key={g}>
            <h2 className="text-xl font-semibold mb-4 uppercase tracking-wider text-muted-foreground">{g}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {clips.filter((c) => c.group === g).map((c) => {
                const t = getTweak(c.id);
                const st = status[c.id] ?? "idle";
                return (
                  <article key={c.id} className={`rounded-xl overflow-hidden border bg-card transition ${st === "approved" ? "border-emerald-500/60 ring-1 ring-emerald-500/40" : st === "queued" ? "border-amber-500/60" : "border-border"}`}>
                    <div className="relative aspect-video bg-black">
                      {c.isImage
                        ? <img src={c.url} alt={c.title} className="w-full h-full object-cover" />
                        : <video src={c.url} className="w-full h-full object-cover" controls muted loop playsInline preload="metadata" />}
                      <span className="absolute bottom-2 right-2 text-xs px-2 py-1 rounded bg-black/70 text-white font-mono">{c.duration}</span>
                      {st !== "idle" && (
                        <span className={`absolute top-2 left-2 text-xs px-2 py-1 rounded font-medium ${st === "approved" ? "bg-emerald-500 text-white" : "bg-amber-500 text-black"}`}>
                          {st === "approved" ? "Approved" : "Queued"}
                        </span>
                      )}
                    </div>
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-medium">{c.title}</h3>
                          <p className="text-sm text-muted-foreground mt-1">{c.notes}</p>
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          <button onClick={() => { setLeftId(c.id); setCompareOn(true); }} className="text-xs px-2 py-1 rounded border border-border hover:bg-accent">A</button>
                          <button onClick={() => { setRightId(c.id); setCompareOn(true); }} className="text-xs px-2 py-1 rounded border border-border hover:bg-accent">B</button>
                        </div>
                      </div>

                      <div className="mt-3 space-y-2">
                        <div className="grid grid-cols-3 gap-2">
                          <label className="text-[10px] uppercase tracking-wider text-muted-foreground col-span-3">Tweaks</label>
                          <select value={t.framing} onChange={(e) => setTweak(c.id, { framing: e.target.value })} className="text-xs px-2 py-1.5 rounded bg-background border border-border">
                            {FRAMING_OPTS.map((o) => <option key={o} value={o}>{o || "Framing…"}</option>)}
                          </select>
                          <select value={t.expression} onChange={(e) => setTweak(c.id, { expression: e.target.value })} className="text-xs px-2 py-1.5 rounded bg-background border border-border">
                            {EXPRESSION_OPTS.map((o) => <option key={o} value={o}>{o || "Expression…"}</option>)}
                          </select>
                          <select value={t.lighting} onChange={(e) => setTweak(c.id, { lighting: e.target.value })} className="text-xs px-2 py-1.5 rounded bg-background border border-border">
                            {LIGHTING_OPTS.map((o) => <option key={o} value={o}>{o || "Lighting…"}</option>)}
                          </select>
                        </div>
                        <input
                          value={t.extra}
                          onChange={(e) => setTweak(c.id, { extra: e.target.value })}
                          placeholder="Extra notes (wardrobe, props, mood)…"
                          className="w-full text-xs px-2 py-1.5 rounded bg-background border border-border"
                        />
                        <div className="flex gap-2 pt-1">
                          <button onClick={() => queueRegen(c.id)} className="flex-1 text-xs px-3 py-1.5 rounded bg-amber-500 text-black font-medium hover:bg-amber-400">
                            {st === "queued" ? "Re-queue" : "Regenerate"}
                          </button>
                          <button onClick={() => toggleApprove(c.id)} className={`flex-1 text-xs px-3 py-1.5 rounded font-medium ${st === "approved" ? "bg-emerald-500/20 text-emerald-500 border border-emerald-500/40" : "bg-emerald-500 text-white hover:bg-emerald-400"}`}>
                            {st === "approved" ? "✓ Approved" : "Approve"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
