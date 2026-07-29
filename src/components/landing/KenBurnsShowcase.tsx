const PHOTOS = [
  { src: "/landing-photo-nba-josh.png",     label: "Artist" },
  { src: "/landing-photo-1.jpeg",           label: "Commercial" },
  { src: "/landing-photo-2.jpeg",           label: "Editorial" },
  { src: "/landing-photo-3.jpeg",           label: "Lifestyle" },
  { src: "/landing-photo-4.jpeg",           label: "Fashion" },
  { src: "/landing-photo-5.jpeg",           label: "Product" },
  { src: "/landing-photo-6.png",            label: "Performance" },
  { src: "/landing-photo-studios-grid.png", label: "Colors Studio" },
  { src: "/landing-photo-7.png",            label: "Music Video" },
  { src: "/landing-photo-8.png",            label: "Production" },
];

const TEXT_SECTIONS = [
  {
    kicker: "One prompt",
    headline: "Describe it.\nWatch it render.",
    body: "Any scene. Any aesthetic. Any mood. Type what you see in your head — Aurora builds it frame-perfect, hyperrealistic, ready to post.",
  },
  {
    kicker: "Identity-locked",
    headline: "Your face.\nEvery world.",
    body: "One selfie. Hundreds of scenes — concert wash, editorial black, golden hour, magazine cover. All unmistakably you.",
  },
  {
    kicker: "Motion transfer",
    headline: "From photo\nto performance.",
    body: "Film 30 seconds on your phone. Aurora maps your real movement into the generated world — your gestures, your energy, the scene it builds.",
  },
  {
    kicker: "Every tool. One balance.",
    headline: "Image, video,\nlip-sync. All in.",
    body: "Every model. Every format. One Aura balance rolls across the entire studio with no extra subscriptions — ever.",
  },
];

function KenBurnsPhoto({
  src, label, duration, delay, aspect = "9/16",
}: {
  src: string; label: string; duration: number; delay: number; aspect?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl w-full" style={{ aspectRatio: aspect }}>
      <img
        src={src}
        alt={label}
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          animation: `ken-burns ${duration}s ease-in-out infinite alternate`,
          animationDelay: `${delay}s`,
        }}
        loading="lazy"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
      <span className="absolute bottom-3 left-3 text-[9px] font-bold uppercase tracking-[0.22em] text-white/55">
        {label}
      </span>
    </div>
  );
}

export function KenBurnsShowcase() {
  return (
    <section className="relative z-10 py-4">

      {/* Section header */}
      <div className="px-6 mb-10 text-center">
        <p className="aurora-kicker mb-3 justify-center inline-flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-primary animate-pulse" />
          What Aurora creates
        </p>
        <h2 className="text-4xl font-black tracking-tight leading-[1.05] text-white">
          Real results.{" "}
          <span className="aurora-gradient-text">Real creators.</span>
        </h2>
      </div>

      {/* First photo pair — tall portraits */}
      <div className="grid grid-cols-2 gap-2 px-4">
        <KenBurnsPhoto src={PHOTOS[0].src} label={PHOTOS[0].label} duration={22} delay={0} />
        <KenBurnsPhoto src={PHOTOS[1].src} label={PHOTOS[1].label} duration={26} delay={-6} />
      </div>

      {/* Text sections 1–2 */}
      <div className="mt-14 px-6 space-y-14">
        {TEXT_SECTIONS.slice(0, 2).map((s) => (
          <div key={s.kicker}>
            <p className="aurora-kicker mb-4">{s.kicker}</p>
            <h2
              className="text-[2.6rem] font-black tracking-tight leading-[1.05] text-white whitespace-pre-line"
              style={{ textShadow: "0 2px 40px oklch(0.775 0.148 307 / 0.35)" }}
            >
              {s.headline}
            </h2>
            <p className="mt-5 text-white/48 leading-relaxed text-[0.95rem] max-w-sm">
              {s.body}
            </p>
          </div>
        ))}
      </div>

      {/* Second photo pair */}
      <div className="grid grid-cols-2 gap-2 px-4 mt-14">
        <KenBurnsPhoto src={PHOTOS[2].src} label={PHOTOS[2].label} duration={24} delay={-4} />
        <KenBurnsPhoto src={PHOTOS[3].src} label={PHOTOS[3].label} duration={20} delay={-10} />
      </div>

      {/* Text sections 3–4 */}
      <div className="mt-14 px-6 space-y-14">
        {TEXT_SECTIONS.slice(2).map((s) => (
          <div key={s.kicker}>
            <p className="aurora-kicker mb-4">{s.kicker}</p>
            <h2
              className="text-[2.6rem] font-black tracking-tight leading-[1.05] text-white whitespace-pre-line"
              style={{ textShadow: "0 2px 40px oklch(0.775 0.148 307 / 0.35)" }}
            >
              {s.headline}
            </h2>
            <p className="mt-5 text-white/48 leading-relaxed text-[0.95rem] max-w-sm">
              {s.body}
            </p>
          </div>
        ))}
      </div>

      {/* Final photo trio — wide + 3 portraits */}
      <div className="mt-14 px-4 space-y-2">
        <KenBurnsPhoto
          src={PHOTOS[7].src}
          label={PHOTOS[7].label}
          duration={28}
          delay={-8}
          aspect="16/9"
        />
        <div className="grid grid-cols-3 gap-2">
          <KenBurnsPhoto src={PHOTOS[4].src} label={PHOTOS[4].label} duration={21} delay={-2} aspect="3/4" />
          <KenBurnsPhoto src={PHOTOS[5].src} label={PHOTOS[5].label} duration={25} delay={-7} aspect="3/4" />
          <KenBurnsPhoto src={PHOTOS[6].src} label={PHOTOS[6].label} duration={23} delay={-12} aspect="3/4" />
        </div>
      </div>

    </section>
  );
}
