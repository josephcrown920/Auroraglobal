import { createFileRoute } from "@tanstack/react-router";
import { LayerStudio } from "@/components/LayerStudio";
import { DirectorAgent } from "@/components/DirectorAgent";
import { ProductionAgent } from "@/components/ProductionAgent";
import { CharacterBibleEditor } from "@/components/CharacterBibleEditor";

import { AccountControl } from "@/components/AccountControl";
import { Reveal } from "@/components/visual/Reveal";
import { BeforeAfter } from "@/components/visual/BeforeAfter";
import { FeatureShowcase } from "@/components/visual/FeatureShowcase";
import { LayerPeel } from "@/components/visual/LayerPeel";
import { PromptTicker } from "@/components/visual/PromptTicker";
import heroStreet from "@/assets/hero-street.jpg";
import layerChains from "@/assets/layer-chains-locked.jpg";
import layerBraids from "@/assets/layer-braids-locked.jpg";
import layerBandana from "@/assets/layer-bandana.jpg";
import demoMotion from "@/assets/demo-motion.jpg";
import demoCharsheet from "@/assets/demo-charsheet.jpg";
import demoLayerstack from "@/assets/demo-layerstack.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Aurora Layers — One Frame. Infinite Layers." },
      {
        name: "description",
        content:
          "Aurora turns any flat image into editable layers. Name the layer you want to change — the rest of the frame never moves.",
      },
      { property: "og:title", content: "Aurora Layers — One Frame. Infinite Layers." },
      {
        property: "og:description",
        content:
          "Upload any image, name the layer, and re-render only that element. Every background, every person, every light stays locked.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});


const peelLayers = [
  { label: "Plate", src: heroStreet },
  { label: "Wardrobe", src: layerBandana },
  { label: "Jewelry", src: layerChains },
  { label: "Talent", src: layerBraids },
];

const engines = [
  { name: "Nano Banana Pro", kind: "Image", frame: layerChains },
  { name: "Seedream 5.0", kind: "Image", frame: layerBraids },
  { name: "GPT Image 2", kind: "Image", frame: heroStreet },
  { name: "Grok Imagine", kind: "Image", frame: layerBandana },
  { name: "Veo 3.1", kind: "Video", frame: demoMotion },
  { name: "Seedance 2.5", kind: "Video", frame: demoMotion },
  { name: "Kling Omni", kind: "Video", frame: demoMotion },
  { name: "Wan 2.2", kind: "Video", frame: demoMotion },
];

const brains = [
  { name: "Aurora Director", note: "Gemini 3.7 — shot lists, coverage, lighting" },
  { name: "Synthetic Council", note: "GPT-5.5 — cross-checks continuity before render" },
  { name: "DeepSeek R", note: "Long-form reasoning for multi-scene arcs" },
  { name: "Claude", note: "Story structure, tone, dialogue beats" },
];

function Index() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={heroStreet}
            alt="Two artists in puffer vests and gold chains against a lit street wall"
            className="h-full w-full object-cover opacity-55"
          />
          <div className="gradient-surface absolute inset-0" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/40 to-background" />
        </div>

        <div className="relative mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-between px-5 py-8">
          <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
            <span className="headline truncate text-2xl">Aurora</span>
            <div className="flex shrink-0 items-center gap-2">
              <AccountControl />
              <a
                href="#studio"
                className="btn-aurora rounded-full px-5 py-2.5 text-sm font-bold tracking-wide"
              >
                + Open Studio
              </a>
            </div>
          </header>

          <div className="grid gap-10 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <p className="font-[family-name:var(--font-mono-ui)] text-[0.68rem] tracking-[0.3em] text-accent uppercase">
                ● The rest of the frame never moves
              </p>
              <h1 className="headline text-shadow-hard mt-5 text-[clamp(2.9rem,9vw,6.2rem)]">
                One frame.
                <span className="gradient-text block">Infinite layers.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg text-muted-foreground">
                Upload any image, name the layer you want to change, and Aurora re-renders only that
                element. The background, the people, the light — everything else stays locked.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="#studio"
                  className="btn-aurora rounded-full px-8 py-3.5 text-sm font-bold tracking-wide uppercase transition-transform hover:scale-[1.03]"
                >
                  + Open Studio
                </a>
                <a
                  href="#edit"
                  className="rounded-full border border-border px-8 py-3.5 text-sm font-bold tracking-wide uppercase transition-colors hover:border-primary hover:text-primary"
                >
                  See it work
                </a>
              </div>
            </div>


            {/* live proof, not copy */}
            <Reveal className="relative">
              <BeforeAfter
                before={heroStreet}
                after={layerChains}
                beforeLabel="Upload"
                afterLabel="One sentence later"
                alt="Same frame, subject iced out"
                className="aspect-4/5 shadow-[var(--shadow-glow)]"
              />
              <PromptTicker
                className="mt-3"
                prompts={[
                  "ice him out — cuban links, diamond grillz",
                  "neon braids, oversized varsity jacket",
                  "red bandana, backwards fitted cap",
                ]}
              />
            </Reveal>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {[heroStreet, layerBraids, layerChains, layerBandana, demoMotion].map((src, i) => (
              <figure
                key={i}
                className="glow-frame relative aspect-3/4 bg-card transition-transform duration-500 hover:-translate-y-1"
                style={{ opacity: i === 2 ? 1 : 0.72 }}
              >
                <img
                  src={src}
                  alt={`Layer variant ${i + 1}`}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
                <figcaption className="absolute bottom-1 left-2 font-[family-name:var(--font-mono-ui)] text-[0.6rem] text-accent">
                  0{i + 1}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* DECOMPOSE — interactive peel */}
      <section id="decompose" className="dotfield border-y border-border">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <Reveal>
            <p className="font-[family-name:var(--font-mono-ui)] text-xs tracking-[0.3em] text-accent uppercase">
              Step one — Decompose
            </p>
            <h2 className="headline mt-4 text-[clamp(2.3rem,7vw,4.5rem)]">
              One upload.
              <span className="gradient-text block">20+ elements.</span>
            </h2>
          </Reveal>

          <div className="mt-14 grid gap-12 lg:grid-cols-[1fr_0.85fr] lg:items-center">
            <Reveal>
              <LayerPeel layers={peelLayers} />
            </Reveal>
            <Reveal delay={120} className="glow-frame overflow-hidden bg-card">
              <img
                src={demoLayerstack}
                alt="A single frame exploded into stacked translucent layer planes"
                loading="lazy"
                width={1280}
                height={960}
                className="w-full object-cover"
              />
              <p className="p-5 text-sm text-muted-foreground">
                Background, talent, wardrobe, jewelry, props — each one addressable on its own.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* LAYER EDIT — dual sliders */}
      <section id="edit" className="bg-card/40">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <Reveal>
            <p className="font-[family-name:var(--font-mono-ui)] text-xs tracking-[0.3em] text-accent uppercase">
              The layer edit
            </p>
            <h2 className="headline mt-4 text-[clamp(2.3rem,7vw,4.5rem)]">
              Change one thing.
              <span className="gradient-text block">Nothing else moves.</span>
            </h2>
          </Reveal>

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <Reveal>
              <BeforeAfter
                before={heroStreet}
                after={layerChains}
                beforeLabel="Plate"
                afterLabel="Iced out"
                alt="Subject iced out with cuban links"
                className="aspect-4/5"
              />
              <PromptTicker className="mt-3" prompts={["iced-out cuban links and diamond grillz"]} />
            </Reveal>
            <Reveal delay={120}>
              <BeforeAfter
                before={heroStreet}
                after={layerBraids}
                beforeLabel="Plate"
                afterLabel="Swapped"
                alt="Subject with neon braids and varsity jacket"
                className="aspect-4/5"
              />
              <PromptTicker className="mt-3" prompts={["neon-green braids, oversized varsity jacket"]} />
            </Reveal>
          </div>
        </div>
      </section>

      {/* CAPABILITY WALL — every card leads with a demo */}
      <section className="mx-auto max-w-6xl px-5 py-24">
        <Reveal>
          <p className="font-[family-name:var(--font-mono-ui)] text-xs tracking-[0.3em] text-accent uppercase">
            The rig
          </p>
          <h2 className="headline mt-4 text-[clamp(2.3rem,7vw,4.5rem)]">
            Show, <span className="gradient-text">don't tell.</span>
          </h2>
        </Reveal>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <FeatureShowcase
            chip="Identity lock"
            title="Same face. Every take."
            line="Upload a character sheet once — skin tone, bone structure and framing hold across every render."
            media={
              <img
                src={demoCharsheet}
                alt="Four-angle character reference sheet of the same artist"
                loading="lazy"
                width={1280}
                height={960}
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
            }
          />
          <FeatureShowcase
            chip="Motion"
            title="Frame to 8s clip."
            line="Hand a finished layer to a video engine and it moves — same wardrobe, same light."
            delay={100}
            media={
              <>
                <img
                  src={demoMotion}
                  alt="Cinematic motion frame with neon light trails"
                  loading="lazy"
                  width={1280}
                  height={720}
                  className="h-full w-full object-cover transition-transform duration-[3000ms] group-hover:scale-110"
                />
                <span className="label-chip absolute bottom-3 left-3">● Rendering 00:08</span>
                <span className="absolute inset-x-0 bottom-0 h-1 origin-left scale-x-0 bg-[image:var(--gradient-aurora)] transition-transform duration-[3000ms] ease-linear group-hover:scale-x-100" />
              </>
            }
          />
          <FeatureShowcase
            chip="Continuity"
            title="Left stays left."
            line="The locked plate pins subject positions, so nobody mirrors or gets recast mid-edit."
            delay={200}
            media={
              <BeforeAfter
                before={heroStreet}
                after={layerBandana}
                beforeLabel="Plate"
                afterLabel="Edited"
                alt="Positions preserved between plate and edit"
                className="h-full w-full rounded-none border-0"
              />
            }
          />
          <FeatureShowcase
            chip="Export"
            title="PNG + layered ZIP."
            line="Composite, every layer, and the recipe that made them — one download."
            delay={100}
            media={
              <div className="grid h-full grid-cols-3 gap-1 p-1">
                {[heroStreet, layerChains, layerBraids, layerBandana, demoMotion, demoCharsheet].map(
                  (src, i) => (
                    <span key={i} className="relative overflow-hidden rounded-md">
                      <img
                        src={src}
                        alt=""
                        aria-hidden
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:-translate-y-1"
                        style={{ transitionDelay: `${i * 60}ms` }}
                      />
                      <span className="absolute right-1 bottom-1 font-[family-name:var(--font-mono-ui)] text-[0.5rem] text-accent">
                        .png
                      </span>
                    </span>
                  ),
                )}
              </div>
            }
          />
          <FeatureShowcase
            chip="Projects"
            title="Revisit any shoot."
            line="Every layer, prompt and engine is saved — reopen a shoot weeks later and keep editing."
            delay={200}
            media={
              <div className="flex h-full items-center gap-3 overflow-hidden p-4">
                {[layerChains, layerBraids, layerBandana].map((src, i) => (
                  <span
                    key={i}
                    className="glow-frame h-full flex-1 transition-transform duration-500 group-hover:-rotate-2"
                    style={{ transform: `rotate(${(i - 1) * 3}deg)` }}
                  >
                    <img src={src} alt="" aria-hidden loading="lazy" className="h-full w-full object-cover" />
                  </span>
                ))}
              </div>
            }
          />
          <FeatureShowcase
            chip="Storyboard"
            title="Layers become shots."
            line="Stack edits in order and Aurora reads them as a shot sequence, ready to animate."
            delay={300}
            media={
              <div className="flex h-full items-end gap-2 p-4">
                {[heroStreet, layerBandana, layerChains, layerBraids, demoMotion].map((src, i) => (
                  <span
                    key={i}
                    className="relative flex-1 overflow-hidden rounded-md transition-all duration-500"
                    style={{ height: `${52 + i * 10}%`, transitionDelay: `${i * 70}ms` }}
                  >
                    <img src={src} alt="" aria-hidden loading="lazy" className="h-full w-full object-cover" />
                    <span className="absolute bottom-1 left-1 font-[family-name:var(--font-mono-ui)] text-[0.5rem] text-accent">
                      SH{i + 1}
                    </span>
                  </span>
                ))}
              </div>
            }
          />
        </div>
      </section>

      {/* ENGINE WALL — model names only */}
      <section className="border-y border-border bg-card/40">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <Reveal>
            <p className="font-[family-name:var(--font-mono-ui)] text-xs tracking-[0.3em] text-accent uppercase">
              Engine room
            </p>
            <h2 className="headline mt-4 text-[clamp(2.3rem,7vw,4.5rem)]">
              Every engine.
              <span className="gradient-text block">One frame.</span>
            </h2>
          </Reveal>

          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {engines.map((e, i) => (
              <Reveal key={e.name} delay={i * 60}>
                <div className="glow-frame flex aspect-square items-center justify-center bg-card p-4 text-center transition-transform duration-500 hover:-translate-y-1">
                  <p className="text-sm font-bold">{e.name}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {brains.map((b, i) => (
              <Reveal key={b.name} delay={i * 70}>
                <div className="relative h-full overflow-hidden rounded-2xl border border-border bg-card p-5">
                  <p className="text-sm font-bold">{b.name}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>


      {/* STUDIO */}
      <section id="studio" className="dotfield">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <Reveal>
            <p className="font-[family-name:var(--font-mono-ui)] text-xs tracking-[0.3em] text-accent uppercase">
              Live — the studio
            </p>
            <h2 className="headline mt-4 text-[clamp(2.3rem,7vw,4.5rem)]">
              Direct your <span className="gradient-text">shoot.</span>
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <ProductionAgent />
              <CharacterBibleEditor />
            </div>
            <DirectorAgent />
            <LayerStudio />

          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border">
        <div className="gradient-surface mx-auto max-w-4xl px-5 py-24 text-center">
          <h2 className="headline text-[clamp(2.3rem,7vw,4.5rem)]">
            Turn flat images
            <span className="gradient-text block">into editable layers.</span>
          </h2>
          <a
            href="#studio"
            className="btn-aurora mt-8 inline-block rounded-full px-10 py-4 text-sm font-bold tracking-widest uppercase transition-transform hover:scale-[1.03]"
          >
            + Open Studio
          </a>
          <p className="mt-16 font-[family-name:var(--font-mono-ui)] text-[0.65rem] tracking-[0.3em] text-muted-foreground uppercase">
            Aurora Performance Studio — generate once, edit forever
          </p>
        </div>
      </section>
    </main>
  );
}
