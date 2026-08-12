import { Link } from "@tanstack/react-router";
import { ArrowRight, ChevronRight } from "lucide-react";
import { useMemo } from "react";

import { STUDIO_TEMPLATES, SPIN_PIECE_COUNT, templateCost } from "@/lib/template-studio";
import { spinTotalCost } from "@/lib/spin-engine";

/**
 * Discovery sections for the signed-in front door (/studio):
 *  - AdCreativeSection: Meta Ads (→ /ugc) + TikTok Ads (→ /spin) entry cards.
 *  - ViralTemplatesStrip: one-tap template teasers reading from the single
 *    template-studio manifest, deep-linking into /templates?open=<id>.
 *
 * These used to live only on /home, which now 307s to /studio — without them
 * here the ad tools and templates were invisible after sign-in.
 */

export function AdCreativeSection() {
  return (
    <section className="border-t border-white/5 px-4 py-6">
      <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-zinc-600">
        Ad Creative Studio
      </p>
      <div className="grid grid-cols-2 gap-2.5">
        <Link
          to="/ugc"
          className="group flex flex-col gap-3 rounded-2xl border border-[#8b5cf6]/20 bg-[#8b5cf6]/6 p-4 no-underline transition hover:border-[#8b5cf6]/40 hover:bg-[#8b5cf6]/10"
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-[#8b5cf6]/15 text-sm font-black text-[#a78bfa]">
            f
          </span>
          <div>
            <p className="text-[13px] font-bold text-zinc-100">Meta Ads</p>
            <p className="mt-0.5 text-[11px] leading-4 text-zinc-500">
              UGC-style ads for Instagram &amp; Facebook in 60 s.
            </p>
          </div>
          <span className="mt-auto inline-flex items-center gap-1 rounded-lg bg-[#8b5cf6]/15 px-3 py-2 text-[12px] font-semibold text-[#c4b5fd] transition group-hover:brightness-110">
            Start creating <ArrowRight className="size-3.5" />
          </span>
        </Link>

        <Link
          to="/spin"
          className="group flex flex-col gap-3 rounded-2xl border border-[#8b5cf6]/15 bg-white/4 p-4 no-underline transition hover:border-[#8b5cf6]/40 hover:bg-[#8b5cf6]/8"
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-[#8b5cf6]/15 text-sm font-black text-[#a78bfa]">
            TT
          </span>
          <div>
            <p className="text-[13px] font-bold text-zinc-100">TikTok Ads</p>
            <p className="mt-0.5 text-[11px] leading-4 text-zinc-500">
              Hook-first short-form campaign packs. Bulk-ready.
            </p>
          </div>
          <span className="mt-auto inline-flex items-center gap-1 rounded-lg bg-[#8b5cf6]/15 px-3 py-2 text-[12px] font-semibold text-[#c4b5fd] transition group-hover:brightness-110">
            Start creating <ArrowRight className="size-3.5" />
          </span>
        </Link>
      </div>
    </section>
  );
}

export function ViralTemplatesStrip() {
  // One representative per category keeps the strip short and diverse.
  const picks = useMemo(() => {
    const seen = new Set<string>();
    const out: typeof STUDIO_TEMPLATES = [];
    for (const t of STUDIO_TEMPLATES) {
      if (seen.has(t.category)) continue;
      seen.add(t.category);
      out.push(t);
    }
    return out;
  }, []);

  return (
    <section className="border-t border-white/5 py-6">
      <div className="mb-3 flex items-center justify-between px-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
          Viral Templates
        </p>
        <Link
          to="/templates"
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#a78bfa] no-underline hover:text-[#c4b5fd]"
        >
          View all <ChevronRight className="size-3.5" />
        </Link>
      </div>
      <div className="flex gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {picks.map((t) => {
          // Spin templates charge nothing in the drawer (templateCost() === 0)
          // but the real batch charge lands on /spin — never label them "Free".
          const cost = templateCost(t);
          const isSpin = t.dispatch === "spin";
          const badge = isSpin
            ? `From ${spinTotalCost(SPIN_PIECE_COUNT, 0)} Aura`
            : cost === 0
              ? "Free"
              : `${cost} Aura`;
          return (
            <Link
              key={t.id}
              to="/templates"
              search={{ open: t.id }}
              className="group relative block w-[128px] shrink-0 overflow-hidden rounded-2xl border border-[#8b5cf6]/15 bg-zinc-900 no-underline transition hover:border-[#8b5cf6]/40"
            >
              <img
                src={t.thumbnail}
                alt={t.title}
                loading="lazy"
                className="aspect-[9/14] w-full object-cover transition duration-300 group-hover:scale-[1.04]"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-zinc-950/95 via-zinc-950/60 to-transparent p-2.5 pt-8">
                <p className="text-[12px] font-bold leading-tight text-zinc-100">{t.title}</p>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  {t.category}
                </p>
              </div>
              <span
                className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${
                  !isSpin && cost === 0 ? "bg-[#8b5cf6]/30 text-[#ddd6fe]" : "bg-zinc-950/80 text-zinc-300"
                }`}
              >
                {badge}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
