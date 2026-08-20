import { useMemo, useState } from "react";
import { Check, Sparkles } from "lucide-react";
import {
  PHOTO_SHOOT_CATEGORIES,
  PHOTO_SHOOT_PRESETS,
  type PhotoShootCategory,
  type PhotoShootPreset,
} from "@/lib/photoshoot-presets";

type PhotoshootPresetLibraryProps = {
  selectedId?: string;
  onSelect: (preset: PhotoShootPreset) => void;
};

export function PhotoshootPresetLibrary({
  selectedId,
  onSelect,
}: PhotoshootPresetLibraryProps) {
  const [category, setCategory] = useState<PhotoShootCategory>("All");
  const visiblePresets = useMemo(
    () =>
      category === "All"
        ? PHOTO_SHOOT_PRESETS
        : PHOTO_SHOOT_PRESETS.filter((preset) => preset.category === category),
    [category],
  );

  return (
    <section aria-labelledby="photoshoot-library-heading" className="space-y-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">
          Ready-to-swap presets
        </p>
        <h2 id="photoshoot-library-heading" className="mt-1 text-lg font-semibold text-white">
          Photoshoots
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-white/45">
          Pick a scene, then add your own photo in the Selfie slot below.
          Aurora keeps the location direction while you make the artist yours.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5" aria-label="Filter photoshoots by category">
        {PHOTO_SHOOT_CATEGORIES.map((option) => {
          const active = category === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => setCategory(option)}
              aria-pressed={active}
              className={
                "rounded-full border px-2.5 py-1 text-[10px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary " +
                (active
                  ? "border-primary/60 bg-primary/15 text-primary"
                  : "border-white/10 bg-white/[0.03] text-white/45 hover:border-white/25 hover:text-white")
              }
            >
              {option}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
        {visiblePresets.map((preset) => {
          const selected = selectedId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(preset)}
              className={
                "group relative overflow-hidden rounded-xl border text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary " +
                (selected
                  ? "border-primary/70 ring-1 ring-primary/40"
                  : "border-white/10 bg-white/[0.03] hover:border-primary/50")
              }
            >
              <img
                src={preset.image}
                alt={`${preset.title}: ${preset.scene}`}
                loading="lazy"
                className="aspect-[4/5] w-full object-cover transition duration-500 group-hover:scale-105"
              />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent p-2.5 pt-10">
                <span className="block text-[9px] font-semibold uppercase tracking-[0.16em] text-primary">
                  {preset.category}
                </span>
                <span className="mt-0.5 block truncate text-xs font-semibold text-white">
                  {preset.title}
                </span>
                <span className="mt-1 block truncate text-[10px] text-white/65">
                  {preset.camera}
                </span>
              </span>
              {selected ? (
                <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-primary text-white shadow-lg">
                  <Check className="size-3.5" aria-hidden />
                  <span className="sr-only">Selected</span>
                </span>
              ) : (
                <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-black/45 text-white/80 opacity-0 backdrop-blur transition group-hover:opacity-100">
                  <Sparkles className="size-3.5" aria-hidden />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}