import { ArrowRight, CheckCircle, EyeOff, Lock, ShieldCheck, Sparkles, Star, Zap } from "lucide-react";

const BASE = import.meta.env.BASE_URL ?? "/aurora-adult/";

// ── Assets ────────────────────────────────────────────────────────────────────
const GRID = Array.from({ length: 8 }, (_, i) => `${BASE}eromify/grid-${i + 1}.jpg`);
const AVATARS = [
  { name: "Yuki",  niche: "Fashion · Editorial", img: `${BASE}models/model-yuki-1.jpg` },
  { name: "Lily",  niche: "Travel · Outdoor",    img: `${BASE}eromify/avatar-lily.jpg` },
  { name: "Aria",  niche: "Lifestyle",            img: `${BASE}eromify/avatar-aria.jpg` },
  { name: "Maya",  niche: "Beauty · Glam",        img: `${BASE}eromify/avatar-maya.jpg` },
];
const VIDEO_POSTER = `${BASE}eromify/video-poster.jpg`;

const LOOKS = [
  { id: "boudoir",   label: "Boudoir",      swatch: "from-rose-700 to-rose-950" },
  { id: "velvet",    label: "Velvet",        swatch: "from-violet-700 to-violet-950" },
  { id: "golden",    label: "Golden Hour",   swatch: "from-amber-600 to-amber-950" },
  { id: "neon",      label: "Neon",          swatch: "from-fuchsia-600 to-pink-950" },
  { id: "luxury",    label: "Luxury Suite",  swatch: "from-stone-600 to-stone-950" },
  { id: "noir",      label: "Noir",          swatch: "from-gray-600 to-gray-950" },
  { id: "ethereal",  label: "Ethereal",      swatch: "from-purple-600 to-indigo-950" },
  { id: "power",     label: "Power",         swatch: "from-red-600 to-red-950" },
] as const;

const SHIP_CARDS = [
  {
    tag: "Quick shot",
    title: "One look, 60 seconds",
    body: "Upload a face photo, pick an editorial look, hit Generate. Aurora locks your identity across every render.",
    prompt: "Boudoir editorial, silk sheets, warm amber window light, 85mm, 8K ultra-HD.",
  },
  {
    tag: "Full campaign",
    title: "8 looks in a single session",
    body: "Run through every editorial style in one sitting. Download, watermark, distribute — all from your private vault.",
    prompt: "Generate all 8 looks of Yuki — boudoir through power editorial, 9:16 portrait, 8K.",
  },
  {
    tag: "Privacy first",
    title: "Yours, forever private",
    body: "Zero public indexing. Zero third-party sharing. Every frame stays in your private vault until you choose to export.",
    prompt: "Every shot lives in your admin vault. Your face, your content, your control.",
  },
];

const SECURITY_STATS = [
  ["8", "Editorial looks"],
  ["8K", "Ultra-HD output"],
  ["~60s", "Render time"],
  ["100%", "Private vault"],
];

const SECURITY_CARDS = [
  ["Private by default", "Every image is generated and stored in a private vault. Zero public indexing, zero third-party sharing. Your content is never visible to anyone but you."],
  ["Watermark built-in", "Each frame carries an embedded watermark automatically — brand every piece before it leaves your hands."],
  ["Identity lock", "Face ID technology preserves your exact facial likeness, skin tone, and hairstyle across every look. No drift, no CGI smoothing."],
  ["Operator-only access", "Secured behind a passcode. No public sign-up. Access is controlled and audited — only operators can enter the studio."],
];

const FAQS = [
  ["How does identity locking work?", "You upload 1–2 face reference photos. Aurora passes them as strict identity anchors to the image model alongside an 8K editorial prompt. The model preserves your exact facial features, skin tone, and hairstyle across every look — no LoRA training required."],
  ["Are my photos stored anywhere?", "Reference photos are sent to the generation endpoint and used only for that render. They are not stored in any public database or used for training."],
  ["How long does a shot take?", "Most shots complete in 45–90 seconds depending on the selected model and server load."],
  ["Can I use my own prompt on top of a look?", "Yes. Each look has a built-in editorial prompt that locks quality. You can add outfit details, setting notes, or styling instructions in the 'Extra details' field."],
  ["What's the credit cost?", "Each generation costs 1 Aura credit. Credits are shared with your main Aurora account."],
  ["Can I upload two photos?", "Yes — photo 1 is the face identity lock. Photo 2 (optional) is an outfit or style reference. Using both gives the model stronger style anchors."],
  ["What's the difference between the preset model and uploading?", "Preset models (like Yuki) are pre-loaded identity references — no upload needed. You can still upload your own face photo to generate shots of yourself or any identity you have rights to."],
];

interface Props { onEnter: () => void; }

export function Landing({ onEnter }: Props) {
  return (
    <div id="top" style={{ background: "var(--er-bg)" }} className="min-h-screen text-white antialiased overflow-x-hidden">

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/6 backdrop-blur-xl" style={{ background: "rgba(6,2,10,0.85)" }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full text-lg font-black italic text-white"
              style={{ background: "linear-gradient(135deg,var(--brand-pink),var(--brand-pink-soft))" }}>e</span>
            <span className="text-[15px] font-black tracking-tight">Eromify</span>
            <span className="rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest"
              style={{ background: "rgba(225,29,106,0.12)", color: "var(--brand-pink)" }}>Adult School</span>
          </div>
          <button onClick={onEnter}
            className="flex items-center gap-2 rounded-full px-5 py-2 text-[13px] font-semibold text-white transition-all hover:scale-[1.03] er-glow"
            style={{ background: "linear-gradient(100deg,var(--brand-pink),var(--brand-pink-soft))" }}>
            Enter studio <ArrowRight size={13} />
          </button>
        </div>
      </header>

      <main className="pt-16">

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section id="connect" className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[820px] -translate-x-1/2 rounded-full opacity-35 blur-[120px]"
            style={{ background: "radial-gradient(circle,var(--brand-pink),transparent 70%)" }} />
          <div className="relative mx-auto max-w-6xl px-5 py-20 sm:py-28">
            <div className="mx-auto max-w-3xl text-center">
              <p className="er-eyebrow animate-float-in">AI Photoshoot Studio · 18+</p>
              <h1 className="er-display mt-5 text-5xl leading-[1.02] sm:text-7xl">
                Your editorial.<br className="hidden sm:block" />
                Your <span className="er-gradient-text">identity.</span><br className="hidden sm:block" />
                Your control.
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-[17px] leading-relaxed" style={{ color: "var(--er-muted)" }}>
                Upload a face photo. Choose from 8 cinema-grade editorial looks. Get an 8K ultra-HD
                shot in ~60 seconds — private, watermarked, yours.
              </p>
            </div>

            {/* 3-step onboarding */}
            <div className="mx-auto mt-14 grid max-w-4xl gap-5 sm:grid-cols-3">
              {[
                { n: 1, title: "Upload your face photo", body: <>Drop in 1–2 reference photos. Aurora uses them as strict identity anchors — <span style={{ color: "white" }}>your exact look, locked every time.</span></> },
                { n: 2, title: "Choose a look", body: <>Pick from 8 cinema-grade editorial styles: <span className="font-mono text-[12px]" style={{ color: "var(--brand-pink-soft)" }}>Boudoir → Noir → Ethereal → Power</span>. Each is tuned for identity preservation.</> },
                { n: 3, title: "Generate & download", body: <>Hit Generate. Your 8K shot renders in ~60 seconds and lands in your <span style={{ color: "white" }}>private vault</span> — watermarked, never indexed.</> },
              ].map(({ n, title, body }) => (
                <div key={n} className="er-card p-6 text-left transition-colors hover:border-[var(--brand-pink)/50]">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold"
                      style={{ background: "rgba(225,29,106,0.15)", color: "var(--brand-pink)" }}>{n}</span>
                    <h3 className="text-[15px] font-semibold text-white">{title}</h3>
                  </div>
                  <p className="mt-4 text-[13px] leading-relaxed" style={{ color: "var(--er-muted)" }}>{body}</p>
                </div>
              ))}
            </div>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <button onClick={onEnter}
                className="rounded-full px-7 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.03] er-glow"
                style={{ background: "linear-gradient(100deg,var(--brand-pink),var(--brand-pink-soft))" }}>
                Enter the studio
              </button>
              <span className="text-[12px]" style={{ color: "var(--er-muted)" }}>
                🔒 Private vault · 🛡 Watermarked · 🎭 Face ID lock
              </span>
            </div>
          </div>
        </section>

        {/* ── Studio intro strip ───────────────────────────────────────────── */}
        <section className="border-y py-20" style={{ borderColor: "var(--er-border)", background: "rgba(13,8,15,0.6)" }}>
          <div className="mx-auto max-w-6xl px-5 text-center">
            <p className="er-eyebrow">A complete editorial studio</p>
            <h2 className="er-display mx-auto mt-3 max-w-3xl text-4xl sm:text-6xl">
              8 looks. One identity lock.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-[17px]" style={{ color: "var(--er-muted)" }}>
              Boudoir through power editorial. ARRI cinema grade. 8K ultra-HD. Ready in a minute.
            </p>
          </div>
        </section>

        {/* ── Avatar / Preset models section ──────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-5 py-24">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            <div className="max-w-2xl">
              <p className="er-eyebrow">Preset models</p>
              <h2 className="er-display mt-3 text-4xl text-white sm:text-5xl">Use a model by name</h2>
              <p className="mt-5 text-[17px] leading-relaxed" style={{ color: "var(--er-muted)" }}>
                Aurora keeps a curated gallery of identity-locked models ready to shoot. Select one in the studio and generate
                editorial shots without uploading anything — face kept consistent every time.
              </p>
            </div>
            {/* ChatWindow mockup */}
            <div className="er-chat-window">
              <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: "var(--er-border)" }}>
                <span className="h-3 w-3 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }} />
                <span className="h-3 w-3 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }} />
                <span className="h-3 w-3 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }} />
                <span className="ml-auto font-mono text-[0.7rem] tracking-[0.2em]" style={{ color: "var(--er-muted)" }}>
                  ADULT SCHOOL · MODELS
                </span>
              </div>
              <div className="space-y-5 p-5 sm:p-6">
                {/* User bubble */}
                <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-md px-4 py-3 text-sm text-white"
                  style={{ border: "1px solid var(--er-border)", background: "rgba(255,255,255,0.06)" }}>
                  Show me available preset models
                </div>
                {/* Assistant row */}
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
                    style={{ background: "linear-gradient(135deg,var(--brand-pink),var(--brand-pink-soft))" }}>
                    <Sparkles size={16} />
                  </div>
                  <div className="min-w-0 flex-1 space-y-3 pt-1">
                    <p className="text-sm" style={{ color: "var(--er-muted)" }}>4 preset models available:</p>
                    <ul className="space-y-2">
                      {AVATARS.map((a) => (
                        <li key={a.name} className="flex items-center gap-3 rounded-xl px-3 py-2"
                          style={{ border: "1px solid var(--er-border)", background: "rgba(255,255,255,0.04)" }}>
                          <img src={a.img} alt={a.name} loading="lazy" width={512} height={512}
                            className="h-9 w-9 rounded-full object-cover object-top" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white">{a.name}</p>
                            <p className="truncate text-xs" style={{ color: "var(--er-muted)" }}>{a.niche}</p>
                          </div>
                          <span className="ml-auto font-mono text-[0.65rem] font-semibold tracking-widest" style={{ color: "#4ade80" }}>
                            READY
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Bulk / gallery section ───────────────────────────────────────── */}
        <section className="border-t py-24" style={{ borderColor: "var(--er-border)", background: "rgba(13,8,15,0.5)" }}>
          <div className="mx-auto max-w-6xl px-5">
            <div className="max-w-2xl">
              <p className="er-eyebrow">Bulk generation</p>
              <h2 className="er-display mt-3 text-4xl text-white sm:text-5xl">8 looks. One session.</h2>
              <p className="mt-5 text-[17px] leading-relaxed" style={{ color: "var(--er-muted)" }}>
                Run through every editorial look in a single session. Same identity lock across all 8.
                Each shot at 8K ultra-HD and landing directly in your private vault.
              </p>
            </div>
            <div className="mt-12 er-chat-window">
              <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: "var(--er-border)" }}>
                <span className="h-3 w-3 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }} />
                <span className="h-3 w-3 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }} />
                <span className="h-3 w-3 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }} />
                <span className="ml-auto font-mono text-[0.7rem] tracking-[0.2em]" style={{ color: "var(--er-muted)" }}>
                  ADULT SCHOOL · GALLERY
                </span>
              </div>
              <div className="space-y-5 p-5 sm:p-6">
                <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-md px-4 py-3 text-sm text-white"
                  style={{ border: "1px solid var(--er-border)", background: "rgba(255,255,255,0.06)" }}>
                  Generate all 8 editorial looks of Yuki — 9:16 portrait, 8K ultra-HD
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
                    style={{ background: "linear-gradient(135deg,var(--brand-pink),var(--brand-pink-soft))" }}>
                    <Sparkles size={16} />
                  </div>
                  <div className="min-w-0 flex-1 space-y-3 pt-1">
                    <p className="flex items-center gap-2 text-sm" style={{ color: "var(--er-muted)" }}>
                      <span className="inline-block h-2 w-2 animate-pulse-dot rounded-full" style={{ background: "var(--brand-pink)" }} />
                      Rendering 8 editorial looks…
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {GRID.map((src, i) => (
                        <img key={i} src={src} alt={`Look ${i + 1}`} loading="lazy" width={640} height={800}
                          className="aspect-[4/5] w-full rounded-lg object-cover" />
                      ))}
                    </div>
                    <p className="font-mono text-xs" style={{ color: "#4ade80" }}>✓ Done · 8 credits used · Saved to your vault</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Video / result preview ───────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-5 py-24">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            <div className="max-w-2xl">
              <p className="er-eyebrow">Cinema-grade output</p>
              <h2 className="er-display mt-3 text-4xl text-white sm:text-5xl">ARRI color science. Every shot.</h2>
              <p className="mt-5 text-[17px] leading-relaxed" style={{ color: "var(--er-muted)" }}>
                Every look ships with a cinema-grade prompt engineered for hyper-realistic skin texture,
                physically accurate lighting, and Leica/ARRI color science. No plastic CGI skin.
              </p>
            </div>
            <div className="er-chat-window">
              <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: "var(--er-border)" }}>
                <span className="h-3 w-3 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }} />
                <span className="h-3 w-3 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }} />
                <span className="h-3 w-3 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }} />
                <span className="ml-auto font-mono text-[0.7rem] tracking-[0.2em]" style={{ color: "var(--er-muted)" }}>
                  ADULT SCHOOL · RENDER
                </span>
              </div>
              <div className="space-y-5 p-5 sm:p-6">
                <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-md px-4 py-3 text-sm text-white"
                  style={{ border: "1px solid var(--er-border)", background: "rgba(255,255,255,0.06)" }}>
                  Generate Yuki · Boudoir look
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
                    style={{ background: "linear-gradient(135deg,var(--brand-pink),var(--brand-pink-soft))" }}>
                    <Sparkles size={16} />
                  </div>
                  <div className="min-w-0 flex-1 space-y-3 pt-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm" style={{ color: "var(--er-muted)" }}>
                      Running
                      <span className="rounded-md px-2 py-0.5 font-mono text-xs"
                        style={{ background: "rgba(225,29,106,0.15)", color: "var(--brand-pink)" }}>identity-locked</span>
                      · boudoir · 9:16
                    </p>
                    <div className="relative overflow-hidden rounded-xl" style={{ border: "1px solid var(--er-border)" }}>
                      <img src={VIDEO_POSTER} alt="Generated editorial preview" loading="lazy"
                        className="aspect-[9/16] w-full max-w-[280px] object-cover" />
                      <span className="absolute bottom-2 right-2 rounded px-2 py-0.5 font-mono text-[0.65rem] text-white"
                        style={{ background: "rgba(0,0,0,0.7)" }}>8K · ARRI</span>
                    </div>
                    <p className="font-mono text-xs" style={{ color: "#4ade80" }}>✓ 1 Aura · Saved to vault</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── What you can ship ────────────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-5 py-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="er-eyebrow">What you can create</p>
            <h2 className="er-display mt-3 text-4xl text-white sm:text-5xl">From upload to campaign in minutes</h2>
          </div>
          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {SHIP_CARDS.map((c) => (
              <div key={c.tag} className="er-card flex flex-col p-6 transition-all hover:border-[rgba(225,29,106,0.4)]">
                <p className="er-eyebrow">{c.tag}</p>
                <h3 className="mt-4 text-[17px] font-semibold text-white">{c.title}</h3>
                <p className="mt-3 flex-1 text-[13px] leading-relaxed" style={{ color: "var(--er-muted)" }}>{c.body}</p>
                <p className="mt-5 rounded-lg px-3 py-2 font-mono text-xs leading-relaxed"
                  style={{ border: "1px solid var(--er-border)", background: "rgba(255,255,255,0.03)", color: "var(--brand-pink-soft)" }}>
                  {c.prompt}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Security stats ───────────────────────────────────────────────── */}
        <section className="border-t py-24" style={{ borderColor: "var(--er-border)", background: "rgba(13,8,15,0.5)" }}>
          <div className="mx-auto max-w-6xl px-5">
            <div className="max-w-2xl">
              <p className="er-eyebrow">Privacy & security</p>
              <h2 className="er-display mt-3 text-4xl text-white sm:text-5xl">Built for total privacy</h2>
              <p className="mt-5 text-[17px]" style={{ color: "var(--er-muted)" }}>
                Every technical decision was made to protect your identity and content. Five layers of privacy before a single pixel leaves the studio.
              </p>
            </div>
            <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {SECURITY_STATS.map(([n, l]) => (
                <div key={l} className="er-card p-6 text-center">
                  <p className="text-4xl font-black er-gradient-text">{n}</p>
                  <p className="mt-2 font-mono text-[0.65rem] uppercase tracking-widest" style={{ color: "var(--er-muted)" }}>{l}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {SECURITY_CARDS.map(([title, body]) => (
                <div key={title} className="er-card p-6">
                  <h3 className="text-[15px] font-semibold text-white">{title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--er-muted)" }}>{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Editorial looks strip ────────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-5 py-24">
          <div className="mx-auto max-w-2xl text-center mb-10">
            <p className="er-eyebrow">8 editorial looks</p>
            <h2 className="er-display mt-3 text-4xl text-white sm:text-5xl">Every mood. Every scene.</h2>
          </div>
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
            {LOOKS.map(l => (
              <div key={l.id} className="relative overflow-hidden rounded-2xl" style={{ border: "1px solid var(--er-border)" }}>
                <div className={`h-[180px] bg-gradient-to-b ${l.swatch} opacity-90`} />
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2.5">
                  <div className="text-[11px] font-bold text-white">{l.label}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────────────── */}
        <section id="faq" className="mx-auto max-w-4xl px-5 py-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="er-eyebrow">FAQ</p>
            <h2 className="er-display mt-3 text-4xl text-white sm:text-5xl">Common questions</h2>
          </div>
          <div className="mt-12 space-y-3">
            {FAQS.map(([q, a]) => (
              <details key={q} className="group rounded-2xl p-5 transition-colors"
                style={{ border: "1px solid var(--er-border)", background: "var(--er-card)" }}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-semibold text-white">
                  {q}
                  <span className="transition-transform group-open:rotate-45" style={{ color: "var(--brand-pink)" }}>+</span>
                </summary>
                <p className="mt-3 text-[13px] leading-relaxed" style={{ color: "var(--er-muted)" }}>{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ── Final CTA ────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden border-t py-28" style={{ borderColor: "var(--er-border)" }}>
          <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[400px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-25 blur-[120px]"
            style={{ background: "radial-gradient(circle,var(--brand-pink),transparent 70%)" }} />
          <div className="relative mx-auto max-w-3xl px-5 text-center">
            <p className="er-eyebrow">Ready when you are</p>
            <h2 className="er-display mt-3 text-4xl sm:text-6xl">Your influencer studio just leveled up</h2>
            <p className="mx-auto mt-5 max-w-lg text-[17px]" style={{ color: "var(--er-muted)" }}>
              Operator-only. Private. Secured. 8K ultra-HD in ~60 seconds.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button onClick={onEnter}
                className="rounded-full px-7 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.03] er-glow"
                style={{ background: "linear-gradient(100deg,var(--brand-pink),var(--brand-pink-soft))" }}>
                Enter the studio
              </button>
              <span className="text-[12px]" style={{ color: "var(--er-muted)" }}>
                🔞 18+ · Operator-only · 1 Aura per shot
              </span>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t px-5 py-10" style={{ borderColor: "var(--er-border)", background: "rgba(13,8,15,0.7)" }}>
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-[12px] sm:flex-row" style={{ color: "var(--er-muted)" }}>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-black italic text-white"
              style={{ background: "linear-gradient(135deg,var(--brand-pink),var(--brand-pink-soft))" }}>e</span>
            <span className="font-bold text-white">Eromify · Adult School</span>
          </div>
          <p>🔞 18+ operator-only · Private vault · Powered by Aurora AI</p>
          <div className="flex gap-5">
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
