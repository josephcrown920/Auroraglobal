import { Camera, Film, Wand2, Megaphone, Activity, Workflow, Image as ImageIcon, Palette, CreditCard, Flame } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { AutoplayVideo } from "@/components/landing/AutoplayVideo";
import demo1 from "@/assets/demo-1.mov.asset.json";
import demo2 from "@/assets/demo-2.mov.asset.json";

type ServicePreview = "spin" | "lipsync" | "imagegen" | "colors" | "motion" | "canvas" | "video";

const SERVICES: {
  icon: React.ElementType;
  title: string;
  desc: string;
  to: "/" | "/spin" | "/lipsync" | "/ugc" | "/studio" | "/colors" | "/motion" | "/canvas";
  accent: string;
  preview: ServicePreview;
  videoUrl?: string;
}[] = [
  { icon: Flame, title: "Spin 1 → 30 Posts", desc: "Type one prompt. Aurora spins it into 30 high-variation posts — same face, endless looks, captions and styles all different.", to: "/spin", accent: "from-orange-500/30 to-amber-500/10", preview: "spin" },
  { icon: Wand2, title: "Music Video Lip Sync", desc: "Frame-accurate Sync 1.9 lip-sync. Drop your track — get a music video that looks like you really sang it.", to: "/lipsync", accent: "from-emerald-500/30 to-teal-500/10", preview: "lipsync" },
  { icon: Megaphone, title: "UGC Ads Factory", desc: "Pick an AI creator, drop your product, ship iPhone-real UGC ads in seconds — scroll-stopping content, no camera needed.", to: "/ugc", accent: "from-rose-500/30 to-pink-500/10", preview: "video", videoUrl: demo1.url },
  { icon: Film, title: "Video Generation", desc: "Cinematic 5–10s performance clips. Seedance 2.0 and Kling 3.0 in one canvas.", to: "/studio", accent: "from-indigo-500/30 to-violet-500/10", preview: "video", videoUrl: demo2.url },
  { icon: ImageIcon, title: "Image Generation", desc: "Cover art and press shots from a selfie. Seedream 4.5, Nano Banana Pro.", to: "/studio", accent: "from-violet-500/30 to-fuchsia-500/10", preview: "imagegen" },
  { icon: Palette, title: "Colors Studio", desc: "Pick a color, pick a studio. Pro mic, pro lighting, single-cover-grade portraits.", to: "/colors", accent: "from-amber-500/30 to-orange-500/10", preview: "colors" },
  { icon: Activity, title: "Perform Anywhere", desc: "Record yourself performing on your phone, then drop your AI-generated photo — Aurora transfers your motion into the scene.", to: "/motion", accent: "from-cyan-500/30 to-blue-500/10", preview: "motion" },
  { icon: Workflow, title: "Canvas", desc: "Wire your song, selfie, outfit and prompt nodes. Save, share, re-run.", to: "/canvas", accent: "from-fuchsia-500/30 to-purple-500/10", preview: "canvas" },
];

function SpinPreview() {
  const colors = [
    "from-orange-500/60 to-amber-600/40",
    "from-rose-500/60 to-pink-600/40",
    "from-violet-500/60 to-fuchsia-600/40",
    "from-cyan-500/60 to-teal-600/40",
    "from-emerald-500/60 to-green-600/40",
    "from-brand-red/60 to-rose-600/40",
  ];
  return (
    <div className="w-full h-full bg-gradient-to-br from-orange-950/80 to-amber-950/60 flex items-center justify-center p-3 gap-1.5">
      {colors.map((c, i) => (
        <div
          key={i}
          className={`flex-1 rounded-lg bg-gradient-to-b ${c} border border-white/10 flex flex-col items-center justify-end pb-1.5 gap-0.5`}
          style={{
            animation: `tile-bob ${1.2 + i * 0.15}s ease-in-out infinite alternate`,
            animationDelay: `${i * 0.12}s`,
            height: `${62 + (i % 3) * 8}%`,
            alignSelf: "flex-end",
          }}
        >
          <span className="block w-4 h-0.5 rounded-full bg-white/50" />
          <span className="block w-3 h-0.5 rounded-full bg-white/30" />
        </div>
      ))}
      <style>{`@keyframes tile-bob{from{transform:translateY(0)}to{transform:translateY(-6px)}}`}</style>
    </div>
  );
}

function LipSyncPreview() {
  return (
    <div className="w-full h-full relative overflow-hidden bg-black">
      <video
        src="/videos/photo2-lipsync-sample.mp4"
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition"
        style={{ imageRendering: "auto" }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
      <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/90 text-[9px] font-bold uppercase tracking-widest text-white">
        <span className="size-1 rounded-full bg-white animate-pulse" /> Lip-sync
      </div>
    </div>
  );
}

function ImageGenPreview() {
  return (
    <div className="w-full h-full relative overflow-hidden bg-gradient-to-br from-violet-950 via-fuchsia-950 to-purple-950 flex items-center justify-center">
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 30%, oklch(0.42 0.18 300 / 0.35) 0%, transparent 65%)" }} />
      <div className="relative w-[52%] aspect-[3/4] rounded-2xl overflow-hidden border border-white/15 shadow-2xl"
        style={{ background: "linear-gradient(160deg, oklch(0.28 0.08 290) 0%, oklch(0.14 0.04 270) 100%)" }}>
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 35%, oklch(0.68 0.18 305 / 0.25) 0%, transparent 60%)" }} />
        <div className="absolute bottom-0 inset-x-0 h-[55%]" style={{ background: "linear-gradient(to top, oklch(0.18 0.06 285 / 0.8), transparent)" }} />
        <div className="absolute bottom-3 inset-x-0 flex flex-col items-center gap-1">
          <div className="w-10 h-1 rounded-full bg-white/30" />
          <div className="w-7 h-0.5 rounded-full bg-white/20" />
        </div>
        <div className="absolute top-3 left-3 right-3 h-2 rounded-full bg-white/10" style={{ animation: "shimmer 2.4s ease-in-out infinite" }} />
      </div>
      <div className="absolute top-2.5 right-2.5 flex flex-col gap-1.5">
        {["from-violet-400 to-fuchsia-500", "from-cyan-400 to-blue-500", "from-rose-400 to-pink-500"].map((g, i) => (
          <div key={i} className={`size-4 rounded-full bg-gradient-to-br ${g} border border-white/20 shadow`} />
        ))}
      </div>
      <style>{`@keyframes shimmer{0%,100%{opacity:.4}50%{opacity:.9}}`}</style>
    </div>
  );
}

function ColorsPreview() {
  const swatches = [
    { bg: "oklch(0.58 0.22 24)", label: "Fire" },
    { bg: "oklch(0.72 0.20 300)", label: "Violet" },
    { bg: "oklch(0.65 0.18 185)", label: "Teal" },
    { bg: "oklch(0.78 0.18 85)", label: "Gold" },
    { bg: "oklch(0.60 0.20 260)", label: "Indigo" },
  ];
  return (
    <div className="w-full h-full bg-gradient-to-br from-amber-950/80 to-orange-950/60 flex flex-col items-center justify-center gap-3 p-4">
      <div className="flex items-end gap-2">
        {swatches.map((s, i) => (
          <div
            key={i}
            className="rounded-xl border border-white/20 shadow-lg flex-shrink-0"
            style={{
              background: s.bg,
              width: "32px",
              height: `${36 + i * 5 - Math.abs(i - 2) * 8}px`,
              animation: `swatch-rise 1.8s ease-in-out ${i * 0.15}s infinite alternate`,
            }}
          />
        ))}
      </div>
      <div className="w-28 h-1.5 rounded-full overflow-hidden" style={{ background: "linear-gradient(to right, oklch(0.58 0.22 24), oklch(0.72 0.20 300), oklch(0.65 0.18 185), oklch(0.78 0.18 85))" }} />
      <style>{`@keyframes swatch-rise{from{transform:translateY(0)}to{transform:translateY(-5px)}}`}</style>
    </div>
  );
}

function MotionPreview() {
  return (
    <div className="w-full h-full relative overflow-hidden bg-gradient-to-br from-cyan-950 via-blue-950 to-indigo-950 flex items-center justify-center">
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 40% 50%, oklch(0.45 0.16 210 / 0.25) 0%, transparent 60%)" }} />
      <svg viewBox="0 0 120 80" className="w-3/4 opacity-80" style={{ filter: "drop-shadow(0 0 8px cyan)" }}>
        <path d="M20 60 Q40 20 60 40 Q80 60 100 20" stroke="oklch(0.68 0.13 185)" strokeWidth="1.5" fill="none" strokeLinecap="round"
          style={{ strokeDasharray: 120, strokeDashoffset: 0, animation: "dash 2.4s ease-in-out infinite" }} />
        <path d="M15 65 Q35 30 55 45 Q75 65 95 25" stroke="oklch(0.72 0.20 300 / 0.5)" strokeWidth="1" fill="none" strokeLinecap="round"
          style={{ strokeDasharray: 120, strokeDashoffset: 0, animation: "dash 2.4s ease-in-out 0.4s infinite" }} />
        <circle cx="60" cy="40" r="4" fill="oklch(0.68 0.13 185)" style={{ animation: "pulse-dot 1.2s ease-in-out infinite" }} />
        <circle cx="60" cy="40" r="8" fill="none" stroke="oklch(0.68 0.13 185 / 0.3)" strokeWidth="1" style={{ animation: "pulse-ring 1.2s ease-in-out infinite" }} />
      </svg>
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="w-0.5 rounded-full bg-cyan-400/60"
            style={{ height: `${8 + Math.abs(Math.sin(i)) * 20}px`, animation: `bar-bounce 0.9s ease-in-out ${i * 0.08}s infinite alternate` }} />
        ))}
      </div>
      <style>{`
        @keyframes dash{0%{stroke-dashoffset:120}100%{stroke-dashoffset:-120}}
        @keyframes pulse-dot{0%,100%{r:4}50%{r:5.5}}
        @keyframes pulse-ring{0%,100%{r:8;opacity:0.3}50%{r:12;opacity:0}}
        @keyframes bar-bounce{from{transform:scaleY(0.4)}to{transform:scaleY(1)}}
      `}</style>
    </div>
  );
}

function CanvasPreview() {
  const nodes = [
    { x: 18, y: 28, label: "Selfie" },
    { x: 18, y: 54, label: "Song" },
    { x: 50, y: 40, label: "Aurora" },
    { x: 82, y: 28, label: "Video" },
    { x: 82, y: 54, label: "Posts" },
  ];
  const edges = [[0, 2], [1, 2], [2, 3], [2, 4]];
  return (
    <div className="w-full h-full relative overflow-hidden bg-gradient-to-br from-fuchsia-950 via-purple-950 to-violet-950">
      <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle, oklch(1 0 0 / 0.06) 1px, transparent 1px)", backgroundSize: "18px 18px" }} />
      <svg viewBox="0 0 100 80" className="absolute inset-0 w-full h-full">
        {edges.map(([a, b], i) => (
          <line key={i}
            x1={`${nodes[a].x}%`} y1={`${nodes[a].y}%`}
            x2={`${nodes[b].x}%`} y2={`${nodes[b].y}%`}
            stroke="oklch(0.72 0.20 300 / 0.4)" strokeWidth="0.8"
            strokeDasharray="3 2"
          />
        ))}
        {nodes.map((n, i) => (
          <g key={i}>
            <rect x={`${n.x - 8}%`} y={`${n.y - 5}%`} width="16%" height="10%"
              rx="1.5" fill="oklch(0.18 0.05 280)" stroke="oklch(0.72 0.20 300 / 0.5)" strokeWidth="0.6"
              style={{ animation: `node-glow ${1.4 + i * 0.2}s ease-in-out infinite alternate` }}
            />
            <text x={`${n.x}%`} y={`${n.y + 1.5}%`} textAnchor="middle"
              fontSize="3.5" fill="oklch(0.85 0.08 300)" fontFamily="sans-serif">{n.label}</text>
          </g>
        ))}
      </svg>
      <style>{`@keyframes node-glow{from{fill:oklch(0.18 0.05 280)}to{fill:oklch(0.22 0.08 290)}}`}</style>
    </div>
  );
}

function renderPreview(s: typeof SERVICES[number]) {
  if (s.preview === "video" && s.videoUrl) {
    return (
      <div className="aspect-video bg-black/40 overflow-hidden border-b border-border">
        <AutoplayVideo
          src={s.videoUrl}
          loop
          playsInline
          preload="metadata"
          onLoadedMetadata={(e) => {
            (e.currentTarget as HTMLVideoElement).playbackRate = 1.6;
          }}
          style={{ imageRendering: "auto" }}
          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition [filter:contrast(1.05)_saturate(1.08)]"
        />
      </div>
    );
  }
  const previewMap: Record<ServicePreview, React.ReactNode> = {
    spin: <SpinPreview />,
    lipsync: <LipSyncPreview />,
    imagegen: <ImageGenPreview />,
    colors: <ColorsPreview />,
    motion: <MotionPreview />,
    canvas: <CanvasPreview />,
    video: null,
  };
  const node = previewMap[s.preview];
  if (!node) return null;
  return (
    <div className="aspect-video overflow-hidden border-b border-border">
      {node}
    </div>
  );
}

export function ServicesGrid() {
  return (
    <section id="services" className="relative z-10 px-6 md:px-12 py-20">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <p className="aurora-kicker mb-2">Our services</p>
        <h2 className="text-3xl md:text-5xl font-semibold tracking-tight">Eight tools. One studio.</h2>
        <p className="text-white/65 mt-4">
          Everything an artist needs to turn a song into a viral video — lip-sync, beat-sync remixes, cover art, performance clips and more. One studio, no shoot day.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {SERVICES.map((s, i) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.title}
              to={s.to}
              className="group relative aurora-card aurora-card-hover overflow-hidden no-underline animate-fade-in"
              style={{ animationDelay: `${i * 60}ms`, animationFillMode: "backwards" }}
            >
              {renderPreview(s)}
              <div className="relative p-5">
                <div className={`absolute -inset-20 blur-3xl opacity-40 bg-gradient-to-br ${s.accent} group-hover:opacity-70 transition-opacity pointer-events-none`} />
                <div className="relative">
                  <span className="inline-flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/30 to-fuchsia-500/10 border border-border mb-4">
                    <Icon className="size-5 text-primary" />
                  </span>
                  <h3 className="text-base font-semibold text-white">{s.title}</h3>
                  <p className="text-sm text-white/60 mt-1.5 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs text-white/50">
        <span className="inline-flex items-center gap-1.5"><CreditCard className="size-3.5 text-primary" /> Aura-based · no per-model surcharge</span>
        <span className="hidden sm:inline text-white/20">·</span>
        <span className="inline-flex items-center gap-1.5"><Camera className="size-3.5 text-primary" /> Commercial license on every plan</span>
      </div>
    </section>
  );
}
