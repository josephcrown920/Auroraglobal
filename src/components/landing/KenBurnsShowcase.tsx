const PHOTOS = [
  { src: "/landing-photo-1.jpeg", label: "Commercial" },
  { src: "/landing-photo-2.jpeg", label: "Editorial" },
  { src: "/landing-photo-3.jpeg", label: "Lifestyle" },
  { src: "/landing-photo-4.jpeg", label: "Fashion" },
  { src: "/landing-photo-5.jpeg", label: "Product" },
  { src: "/landing-photo-6.png",  label: "Artist" },
  { src: "/landing-photo-7.png",  label: "Performance" },
  { src: "/landing-photo-8.png",  label: "Music Video" },
];

const TEXT_SECTIONS = [
  {
    kicker: "Text to cinematic",
    headline: "Describe it. Watch it render.",
    body: "Any aesthetic. Any scene. Type what you see in your head and Aurora builds it — frame-perfect cinematics from a single line of text. No camera. No crew. No compromise.",
  },
  {
    kicker: "Identity-locked",
    headline: "Your face. Every world.",
    body: "Drop one selfie. Aurora locks your identity across hundreds of scenes, styles, and moods — no two the same, all unmistakably you. Concert wash, editorial black, golden hour. Your call.",
  },
  {
    kicker: "Motion transfer",
    headline: "From photo to performance.",
    body: "Aurora reads your movement from a 30-second phone clip and maps it into your AI-generated world. Your gestures. Your energy. The scene Aurora builds.",
  },
  {
    kicker: "One studio",
    headline: "Every tool. One balance.",
    body: "Image, video, lip-sync, motion. Every model. Every format. One credit balance rolls across the entire studio with no extra subscriptions — ever.",
  },
];

function KenBurnsPhoto({
  src,
  label,
  duration,
  delay,
  aspect = "9/16",
}: {
  src: string;
  label: string;
  duration: number;
  delay: number;
  aspect?: string;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl w-full"
      style={{ aspectRatio: aspect }}
    >
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
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
      <span className="absolute bottom-2.5 left-3 text-[9px] font-bold uppercase tracking-[0.2em] text-white/60">
        {label}
      </span>
    </div>
  );
}

export function KenBurnsShowcase() {
  return (
    <section className="relative z-10 py-8 space-y-14">

      {/* First photo row — 2 tall portraits */}
      <div className="grid grid-cols-2 gap-2 px-4">
        <KenBurnsPhoto src={PHOTOS[0].src} label={PHOTOS[0].label} duration={22} delay={0} />
        <KenBurnsPhoto src={PHOTOS[1].src} label={PHOTOS[1].label} duration={26} delay={-6} />
      </div>

      {/* Text-only sections — no icons, no illustrations */}
      <div className="px-6 space-y-14">
        {TEXT_SECTIONS.slice(0, 2).map((s) => (
          <div key={s.kicker}>
            <p className="aurora-kicker mb-3">{s.kicker}</p>
            <h2 className="text-[2rem] font-black tracking-tight leading-[1.08] text-white">
              {s.headline}
            </h2>
            <p className="mt-4 text-white/50 leading-relaxed text-[0.95rem]">
              {s.body}
            </p>
          </div>
        ))}
      </div>

      {/* Second photo row — 2 portraits */}
      <div className="grid grid-cols-2 gap-2 px-4">
        <KenBurnsPhoto src={PHOTOS[2].src} label={PHOTOS[2].label} duration={24} delay={-4} />
        <KenBurnsPhoto src={PHOTOS[3].src} label={PHOTOS[3].label} duration={20} delay={-10} />
      </div>

      {/* More text-only sections */}
      <div className="px-6 space-y-14">
        {TEXT_SECTIONS.slice(2).map((s) => (
          <div key={s.kicker}>
            <p className="aurora-kicker mb-3">{s.kicker}</p>
            <h2 className="text-[2rem] font-black tracking-tight leading-[1.08] text-white">
              {s.headline}
            </h2>
            <p className="mt-4 text-white/50 leading-relaxed text-[0.95rem]">
              {s.body}
            </p>
          </div>
        ))}
      </div>

      {/* Third photo row — wide landscape + portrait pair */}
      <div className="px-4 space-y-2">
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
