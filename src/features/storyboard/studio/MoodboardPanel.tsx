const MOOD_FRAMES = [
  { src: "/prime/shot-neon-face.jpg", alt: "Neon portrait reference", label: "Color & skin" },
  { src: "/prime/shot-highway.jpg", alt: "Dusk highway reference", label: "Scale & travel" },
  { src: "/prime/shot-chef.jpg", alt: "Warm interior reference", label: "Texture & practicals" },
  { src: "/prime/shot-dancer.jpg", alt: "Dancer silhouette reference", label: "Movement" },
  { src: "/prime/shot-alley.jpg", alt: "Rainy alley reference", label: "Atmosphere" },
  { src: "/prime/shot-eye.jpg", alt: "Macro eye reference", label: "Detail" },
];

export function MoodboardPanel() {
  return (
    <section className="min-h-0 overflow-auto bg-background p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Moodboard</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">The visual language of this shoot</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Collect the tone, lighting, movement, and close-up details that guide every scene in the board.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
          {MOOD_FRAMES.map((frame) => (
            <figure key={frame.src} className="group overflow-hidden rounded-2xl border border-border bg-card">
              <div className="aspect-[4/3] overflow-hidden bg-muted">
                <img
                  src={frame.src}
                  alt={frame.alt}
                  loading="lazy"
                  className="size-full object-cover transition duration-500 group-hover:scale-105"
                />
              </div>
              <figcaption className="px-3 py-2 text-xs font-medium text-foreground">{frame.label}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}