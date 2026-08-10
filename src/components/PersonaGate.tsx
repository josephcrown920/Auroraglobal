/**
 * PersonaGate — full-screen first-visit persona selector.
 * Shown once when aurora-persona has never been set.
 * On selection the gate animates out (lift + fade) and the home view reveals beneath.
 */
import { useState } from "react";
import { Mic2, Clapperboard, ChevronRight } from "lucide-react";
import type { Persona } from "@/hooks/use-persona";

const ARTIST_TOOLS = [
  { idx: "00", name: "PERFORM ANYWHERE", badge: "FLAGSHIP" },
  { idx: "01", name: "COLORS" },
  { idx: "02", name: "TIKTOK30" },
  { idx: "03", name: "VIDEO AGENT" },
  { idx: "04", name: "DIRECTOR'S ROOM", badge: "SUITE" },
];

const CREATOR_TOOLS = [
  { idx: "00", name: "UGC ADS", badge: "FLAGSHIP" },
  { idx: "01", name: "TIKTOK30" },
  { idx: "02", name: "LIP SYNC" },
  { idx: "03", name: "VIDEO AGENT" },
  { idx: "04", name: "AI AGENT", badge: "NEW" },
];

interface Props {
  onSelect: (persona: Persona) => void;
}

export function PersonaGate({ onSelect }: Props) {
  const [leaving, setLeaving] = useState(false);
  const [chosen, setChosen] = useState<Persona | null>(null);

  const pick = (p: Persona) => {
    if (leaving) return;
    setChosen(p);
    setLeaving(true);
    // Let the animation run then commit
    setTimeout(() => onSelect(p), 480);
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col overflow-hidden"
      style={{
        background: "oklch(0.06 0.015 275)",
        transform: leaving ? "translateY(-100%)" : "translateY(0%)",
        transition: leaving
          ? "transform 0.5s cubic-bezier(0.76, 0, 0.24, 1)"
          : "none",
      }}
    >
      {/* Background texture — subtle radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 0%, oklch(0.55 0.25 295 / 0.12) 0%, transparent 70%)",
        }}
      />

      <div className="relative flex flex-1 flex-col px-6 pb-10 pt-safe-or-10">
        {/* ── Brand kicker ───────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 pt-4">
          <span
            className="size-7 rounded-full flex items-center justify-center"
            style={{ background: "oklch(0.60 0.27 295 / 0.25)", border: "1px solid oklch(0.60 0.27 295 / 0.4)" }}
          >
            <span className="text-[10px] font-black" style={{ color: "oklch(0.85 0.15 305)" }}>A</span>
          </span>
          <span className="text-[11px] font-bold uppercase tracking-[0.25em]" style={{ color: "oklch(0.85 0.15 305)" }}>
            Aurora
          </span>
        </div>

        {/* ── Headline ───────────────────────────────────────────────────── */}
        <div className="mt-10">
          <p
            className="text-[10px] font-bold uppercase tracking-[0.22em]"
            style={{ color: "oklch(0.60 0.20 295)" }}
          >
            Welcome
          </p>
          <h1
            className="mt-2 text-[40px] font-black leading-[0.9] tracking-tighter text-white"
          >
            HOW DO YOU
            <br />
            <span
              style={{
                WebkitTextStroke: "1.5px white",
                WebkitTextFillColor: "transparent",
              }}
            >
              CREATE?
            </span>
          </h1>
          <p className="mt-4 text-[14px] leading-relaxed" style={{ color: "oklch(0.65 0.05 270)" }}>
            We'll personalise your dashboard and surface the tools that matter most to you.
          </p>
        </div>

        {/* ── Choice cards ───────────────────────────────────────────────── */}
        <div className="mt-10 flex flex-1 flex-col gap-4">
          {/* Artist */}
          <button
            type="button"
            onClick={() => pick("artist")}
            className="group relative flex-1 overflow-hidden rounded-3xl border text-left transition-all duration-200 active:scale-[0.98]"
            style={{
              background:
                chosen === "artist"
                  ? "oklch(0.22 0.07 280)"
                  : "oklch(0.11 0.025 280)",
              borderColor:
                chosen === "artist"
                  ? "oklch(0.60 0.27 295 / 0.70)"
                  : "oklch(0.60 0.27 295 / 0.18)",
            }}
          >
            {/* Artist radial glow on hover */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{
                background:
                  "radial-gradient(ellipse 60% 60% at 20% 80%, oklch(0.55 0.25 295 / 0.18) 0%, transparent 70%)",
              }}
            />
            <div className="relative flex h-full flex-col justify-between p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div
                    className="mb-3 flex size-11 items-center justify-center rounded-2xl"
                    style={{ background: "oklch(0.55 0.25 295 / 0.18)", border: "1px solid oklch(0.60 0.27 295 / 0.30)" }}
                  >
                    <Mic2 className="size-5" style={{ color: "oklch(0.80 0.16 305)" }} />
                  </div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "oklch(0.70 0.18 305)" }}>
                    For Artists
                  </p>
                  <h2 className="mt-1 text-[26px] font-black uppercase tracking-tighter text-white">
                    Artist
                  </h2>
                  <p className="mt-1 text-[13px]" style={{ color: "oklch(0.60 0.06 270)" }}>
                    Music · Performance · Live visuals
                  </p>
                </div>
                <ChevronRight className="mt-1 size-5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" style={{ color: "oklch(0.50 0.10 295)" }} />
              </div>

              {/* Mini tool preview */}
              <div className="mt-4 space-y-1.5">
                {ARTIST_TOOLS.map((t) => (
                  <div key={t.idx} className="flex items-center gap-2">
                    <span className="w-5 text-[10px] font-bold tabular-nums" style={{ color: "oklch(0.45 0.10 295)" }}>
                      {t.idx}
                    </span>
                    <span className="text-[12px] font-bold uppercase tracking-wide text-white/80">
                      {t.name}
                    </span>
                    {t.badge && (
                      <span
                        className="rounded-[3px] px-1 py-0.5 text-[8px] font-bold uppercase tracking-wider"
                        style={{ background: "oklch(0.55 0.25 295 / 0.20)", color: "oklch(0.80 0.16 305)" }}
                      >
                        {t.badge}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </button>

          {/* Creator */}
          <button
            type="button"
            onClick={() => pick("creator")}
            className="group relative flex-1 overflow-hidden rounded-3xl border text-left transition-all duration-200 active:scale-[0.98]"
            style={{
              background:
                chosen === "creator"
                  ? "oklch(0.18 0.06 310)"
                  : "oklch(0.11 0.025 280)",
              borderColor:
                chosen === "creator"
                  ? "oklch(0.60 0.27 295 / 0.70)"
                  : "oklch(0.60 0.27 295 / 0.18)",
            }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{
                background:
                  "radial-gradient(ellipse 60% 60% at 80% 20%, oklch(0.55 0.25 295 / 0.15) 0%, transparent 70%)",
              }}
            />
            <div className="relative flex h-full flex-col justify-between p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div
                    className="mb-3 flex size-11 items-center justify-center rounded-2xl"
                    style={{ background: "oklch(0.55 0.25 295 / 0.18)", border: "1px solid oklch(0.60 0.27 295 / 0.30)" }}
                  >
                    <Clapperboard className="size-5" style={{ color: "oklch(0.80 0.16 305)" }} />
                  </div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "oklch(0.70 0.18 305)" }}>
                    For Creators
                  </p>
                  <h2 className="mt-1 text-[26px] font-black uppercase tracking-tighter text-white">
                    Creator
                  </h2>
                  <p className="mt-1 text-[13px]" style={{ color: "oklch(0.60 0.06 270)" }}>
                    UGC · Short-form · Ads
                  </p>
                </div>
                <ChevronRight className="mt-1 size-5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" style={{ color: "oklch(0.50 0.10 295)" }} />
              </div>

              {/* Mini tool preview */}
              <div className="mt-4 space-y-1.5">
                {CREATOR_TOOLS.map((t) => (
                  <div key={t.idx} className="flex items-center gap-2">
                    <span className="w-5 text-[10px] font-bold tabular-nums" style={{ color: "oklch(0.45 0.10 295)" }}>
                      {t.idx}
                    </span>
                    <span className="text-[12px] font-bold uppercase tracking-wide text-white/80">
                      {t.name}
                    </span>
                    {t.badge && (
                      <span
                        className="rounded-[3px] px-1 py-0.5 text-[8px] font-bold uppercase tracking-wider"
                        style={{ background: "oklch(0.55 0.25 295 / 0.20)", color: "oklch(0.80 0.16 305)" }}
                      >
                        {t.badge}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </button>
        </div>

        <p className="mt-6 text-center text-[11px]" style={{ color: "oklch(0.40 0.05 270)" }}>
          You can switch modes at any time from your home screen.
        </p>
      </div>
    </div>
  );
}
