import { EditableCopy } from "@/components/EditableCopy";
import { ResponsiveImage } from "@/components/ui/responsive-image";
import { OutputGallery } from "@/components/visual/OutputGallery";
import { DEMO_ASSETS } from "@/lib/demo-assets";

interface ProcessCardProps {
  step: string;
  label: string;
  title: string;
  body: string;
  image?: string;
  alt?: string;
  custom?: React.ReactNode;
}

function ProcessCard({ step, label, title, body, image, alt, custom }: ProcessCardProps) {
  return (
    <div className="group">
      <div className="mb-3 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-zinc-900 ring-1 ring-white/5">
        {image ? (
          <ResponsiveImage
            src={image}
            sizes="(min-width: 760px) 50vw, 100vw"
            alt={alt ?? ""}
            width={800}
            height={600}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          />
        ) : (
          custom
        )}
      </div>
      <div className="flex items-baseline gap-3">
        <span className="text-xs font-bold text-[#8b5cf6] uppercase tracking-[0.25em]">{step}</span>
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-widest">{label}</span>
      </div>
      <h3 className="mt-1.5 text-base font-semibold">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-zinc-400">{body}</p>
    </div>
  );
}

function PromptMock() {
  return (
    <div className="flex w-full max-w-xs flex-col gap-3 p-6">
      <div className="rounded-lg bg-zinc-800/80 px-3 py-2 text-[11px] text-zinc-300 ring-1 ring-white/10">
        Vivid crimson studio lighting, 35mm grain…
      </div>
      <div className="rounded-lg bg-zinc-800/80 px-3 py-2 text-[11px] text-zinc-300 ring-1 ring-white/10 w-4/5">
        Editorial fashion styling, deep shadow
      </div>
      <div className="rounded-lg bg-[#8b5cf6]/15 px-3 py-2 text-[11px] text-[#8b5cf6] ring-1 ring-[#8b5cf6]/50 w-3/5 flex items-center gap-2">
        <span className="inline-block size-1.5 rounded-full bg-[#8b5cf6] animate-pulse" />
        Directing shoot…
      </div>
      <div className="mt-2 rounded-lg bg-zinc-900 px-3 py-2 text-[10px] text-zinc-500 ring-1 ring-white/5">
        Aurora · v1.2 · 4K
      </div>
    </div>
  );
}

export function ProcessSection() {
  return (
    <section id="how-it-works" className="px-5 py-12">
      <div className="mb-7">
        <span className="text-xs font-bold uppercase tracking-[0.3em] text-[#8b5cf6]">
          The studio flow
        </span>
        <h2 className="mt-2 text-3xl font-semibold leading-tight">
          <EditableCopy copyKey="landing_process_heading" fallback="Reference. Direction. Delivered." />
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-zinc-400">
          <EditableCopy copyKey="landing_process_sub" fallback="Three steps between the sound in your head and the visual on your feed." />
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <ProcessCard
          step="01"
          label="Reference"
          title="Drop inspiration"
          body="A film scan, a moodboard, or a rough sketch. Aurora reads lighting, texture, and intent — not just objects."
          image="/landing/step-reference.jpg"
          alt="Polaroid moodboard reference"
        />
        <ProcessCard
          step="02"
          label="Direction"
          title="Direct the shoot"
          body="Write like a director. Wardrobe, camera angle, mood, grain. Iterate in plain language until it feels like you."
          custom={<PromptMock />}
        />
        <ProcessCard
          step="03"
          label="Generate"
          title="Ship visuals"
          body="Studio-grade output ready for Spotify, Apple Music, DSP tiles, tour billboards, and everything in between."
          image="/landing/step-final.jpg"
          alt="Final rendered artist portrait"
        />
      </div>
      <OutputGallery
        items={DEMO_ASSETS.landing.studio}
        kicker="Studio proof"
        title="A reference becomes a campaign world."
        subtitle="Look through the kinds of visual direction Aurora Studio turns into finished assets."
        showGalleryLink
      />
    </section>
  );
}
