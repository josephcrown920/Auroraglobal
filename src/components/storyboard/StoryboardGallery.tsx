import { shots, type Shot } from "./shots";

type Props = {
  title?: string;
  subtitle?: string;
  data?: Shot[];
  showHero?: boolean;
};

/**
 * Music-video storyboard gallery — a mixed-vibe 10-shot deck built from the
 * artist's avatar + reference looks. Rendered on /storyboard and linked from
 * the Artists group in MobileNav.
 */
export function StoryboardGallery({
  title = "Music video shot deck built from your avatar and reference looks.",
  subtitle = "A mixed-vibe sequence pulling from Miami neon nights, studio fashion portraits, gritty street frames, and performance setups so you can map the visual arc before production.",
  data = shots,
  showHero = true,
}: Props) {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:py-16">
        {showHero && (
          <section className="grid gap-8">
            <div className="grid gap-5">
              <span className="text-xs font-bold uppercase tracking-[0.25em] text-primary">
                Storyboard · {data.length} generated frames
              </span>
              <h1 className="text-[clamp(28px,4.5vw,52px)] font-semibold leading-[1.05]">
                {title}
              </h1>
              <p className="max-w-[65ch] text-base leading-relaxed text-zinc-400">{subtitle}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Shots", value: `${data.length} distinct frames` },
                { label: "Palette", value: "Neon red, royal blue, hot pink, gold rain" },
                { label: "Mix", value: "Performance, fashion, city narrative" },
                { label: "Use", value: "Sequence planning, lookbook, shot-list kickoff" },
              ].map((s) => (
                <div key={s.label} className="rounded-2xl border border-white/5 bg-zinc-900/60 p-4">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                    {s.label}
                  </span>
                  <p className="mt-2 text-sm font-medium text-zinc-200">{s.value}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby="storyboard-grid-title" className="mt-14">
          <div className="mb-8 grid gap-2">
            <h2 id="storyboard-grid-title" className="text-2xl font-semibold">
              Storyboard gallery
            </h2>
            <p className="max-w-[60ch] text-sm leading-relaxed text-zinc-400">
              Each frame includes a suggested camera language, outfit cue, and emotional purpose so
              the set pieces feel connected when you sequence the video.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((shot) => (
              <article
                key={shot.id}
                className="overflow-hidden rounded-2xl border border-white/5 bg-zinc-900/70 transition-transform hover:-translate-y-1"
              >
                <img
                  className="block aspect-[4/5] w-full object-cover"
                  src={shot.image}
                  alt={shot.alt}
                  loading="lazy"
                />
                <div className="grid gap-3 p-5">
                  <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.15em]">
                    <span className="text-primary">Shot {shot.id}</span>
                    <span className="text-zinc-500">{shot.type}</span>
                  </div>
                  <div className="grid gap-2">
                    <h3 className="text-lg font-semibold">{shot.title}</h3>
                    <p className="text-sm leading-relaxed text-zinc-400">{shot.note}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5" aria-label={`Details for shot ${shot.id}`}>
                    {[shot.frame, shot.wardrobe, shot.mood].map((p) => (
                      <span
                        key={p}
                        className="rounded-full bg-zinc-800/80 px-2.5 py-1 text-[11px] text-zinc-300"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <p className="mt-14 text-sm text-zinc-500">
          Next step: turn these frames into a tighter sequence with scene order, transitions, and
          matching performance setups for each song section.
        </p>
      </div>
    </main>
  );
}

export { shots };
export type { Shot };
