import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Palette, Star } from "lucide-react";
import { ColorStudioBackdrop } from "@/components/studio/ColorStudioBackdrop";
import { COLOR_PRESETS } from "@/lib/colors.presets";

// Fresh identity-locked cyclorama shots (2026-07) — each tile is a UNIQUE
// color set; the old duplicated shots (magenta cyc / hot-pink floor /
// neon-seated) were removed at user request.
const RESULT_SHOTS = [
  { url: "/josh/generated2/colors-royal-blue.webp", color: "royal-blue", label: "Royal Blue" },
  { url: "/josh/generated2/colors-neon-green.webp", color: "neon-green", label: "Neon Green" },
  { url: "/josh/generated2/colors-sunset-orange.webp", color: "sunset-orange", label: "Sunset Orange" },
];

// Spotlight 8 of the 12 sets as preview tiles so the grid stays tight.
const PREVIEW_IDS = [
  "royal-blue",
  "hot-pink",
  "electric-purple",
  "neon-green",
  "sunset-orange",
  "cyber-yellow",
  "aqua",
  "obsidian",
];

export function ColorsTeaser() {
  const [activeId, setActiveId] = useState("royal-blue");
  const active = COLOR_PRESETS.find((c) => c.id === activeId) ?? COLOR_PRESETS[0];

  return (
    <section id="colors" className="relative px-4 md:px-12 py-20 md:py-28 overflow-hidden">
      {/* Ambient glow that matches the active color */}
      <div
        key={activeId}
        className="pointer-events-none absolute inset-0 opacity-20 transition-all duration-1000"
        style={{
          background: `radial-gradient(ellipse 70% 60% at 50% 0%, ${active.swatch}88, transparent 70%)`,
        }}
      />

      <div className="relative max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full aurora-glass text-xs text-white/70">
              <Palette className="size-3.5" />
              Colors Studio
            </div>
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-white leading-tight">
              Pick a color. <span className="aurora-gradient-text">Show up in that world.</span>
            </h2>
            <p className="text-white/60 text-sm md:text-base max-w-xl">
              12 real seamless-cyclorama studio sets, each lit in its own bold color. Pick a swatch
              below — the studio switches live. Upload a selfie and Aurora places you inside it.
            </p>
          </div>
          <Link
            to="/colors"
            className="hidden md:inline-flex shrink-0 items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-medium text-white bg-[image:var(--gradient-hero)] hover:brightness-110 shadow-[var(--shadow-glow-soft)] no-underline"
          >
            Open Colors Studio <ArrowRight className="size-4" />
          </Link>
        </div>

        {/* Large featured studio — switches on swatch click */}
        <div className="relative w-full aspect-video rounded-3xl overflow-hidden border border-white/10 shadow-2xl shadow-black/60">
          <ColorStudioBackdrop
            colorId={activeId}
            label={`${active.name} studio set`}
            preload="auto"
          />

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20 pointer-events-none" />

          {/* Top-left badge */}
          <div className="absolute top-4 left-4 flex items-center gap-2 aurora-glass px-3 py-1.5 rounded-full text-xs font-medium text-white/90">
            <span
              className="size-2.5 rounded-full shadow-md shrink-0"
              style={{ background: active.swatch }}
            />
            {active.name} · COLORS Studio
          </div>

          {/* Bottom copy */}
          <div className="absolute bottom-0 inset-x-0 p-5 md:p-7">
            <p className="text-xs text-white/55 mb-1 uppercase tracking-widest">
              12 colors · 5 scene types · your face
            </p>
            <p className="text-lg md:text-2xl font-semibold text-white">
              {active.name} — seamless cyclorama studio set
            </p>
          </div>
        </div>

        {/* Real results strip — Josh in Colors Studio sessions */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.2em] text-white/45 flex items-center gap-2">
              <Star className="size-3 fill-amber-300 text-amber-300" /> Real results — same artist, 3 colors
            </p>
            <Link to="/colors" className="text-xs text-white/40 hover:text-white/70 transition no-underline">
              Explore Colors →
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {RESULT_SHOTS.map((shot) => (
              <button
                key={shot.label}
                onClick={() => setActiveId(shot.color)}
                className="group relative aspect-[3/4] rounded-xl overflow-hidden border border-white/10 hover:border-white/30 transition-all duration-200"
              >
                <img
                  src={shot.url}
                  alt={`Josh in ${shot.label} Colors Studio`}
                  className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500"
                  loading="lazy"
                />
                <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/80 to-transparent">
                  <p className="text-[9px] font-semibold text-white/80 text-center">{shot.label}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Color swatch picker */}
        <div className="flex flex-wrap gap-2 justify-center md:justify-start">
          {COLOR_PRESETS.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              aria-pressed={c.id === activeId}
              aria-label={`Preview ${c.name} studio`}
              className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border ${
                c.id === activeId
                  ? "border-white/50 text-white shadow-md scale-105"
                  : "border-white/10 text-white/60 hover:border-white/30 hover:text-white/90"
              }`}
              style={
                c.id === activeId
                  ? { background: `${c.swatch}33`, boxShadow: `0 0 16px ${c.swatch}55` }
                  : { background: "rgba(255,255,255,0.04)" }
              }
            >
              <span
                className="size-3 rounded-full shrink-0 shadow-sm"
                style={{ background: c.swatch }}
              />
              {c.name}
            </button>
          ))}
        </div>

        {/* Secondary grid — 8 smaller tiles showing variety */}
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {PREVIEW_IDS.map((id) => {
            const preset = COLOR_PRESETS.find((c) => c.id === id)!;
            return (
              <button
                key={id}
                onClick={() => setActiveId(id)}
                aria-label={`Preview ${preset.name} studio`}
                className="group relative aspect-[3/4] rounded-xl overflow-hidden border border-white/10 hover:border-white/30 transition-all duration-200"
                style={
                  id === activeId
                    ? { boxShadow: `0 0 0 2px ${preset.swatch}, 0 0 18px ${preset.swatch}44` }
                    : undefined
                }
              >
                <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-[1.06]">
                  <ColorStudioBackdrop colorId={id} label={preset.name} preload="metadata" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Mobile CTA */}
        <div className="md:hidden">
          <Link
            to="/colors"
            className="inline-flex w-full items-center justify-center gap-1.5 px-5 py-3 rounded-full text-sm font-medium text-white bg-[image:var(--gradient-hero)] no-underline"
          >
            Open Colors Studio <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
