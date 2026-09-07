import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Check } from "lucide-react";

export function PartnersSection() {
  return (
    <section className="py-20 px-5 border-t border-white/5">
      <div className="mb-8">
        <span className="text-xs font-bold uppercase tracking-[0.3em] text-[#8b5cf6]">
          Aurora Partners
        </span>
        <h2 className="mt-3 text-4xl font-semibold leading-tight">
          Earn while you{" "}
          <span className="bg-gradient-to-r from-violet-200 via-violet-400 to-fuchsia-300 bg-clip-text font-sans font-semibold text-transparent">grow the movement.</span>
        </h2>
        <p className="mt-3 text-sm text-zinc-400 max-w-[38ch] leading-relaxed">
          Bring artists into Aurora and earn recurring revenue for every creator who signs up through your link.
        </p>
      </div>
      <ul className="flex flex-col gap-3 mb-8">
        {[
          "Recurring revenue for every active creator you refer",
          "Exclusive partner dashboard with real-time stats",
          "Co-marketing with Aurora — grow your brand alongside ours",
        ].map((b) => (
          <li key={b} className="flex items-start gap-3 text-sm text-zinc-300">
            <Check className="size-4 shrink-0 mt-0.5 text-[#8b5cf6]" />
            {b}
          </li>
        ))}
      </ul>
      <Link
        to="/partners"
        className="inline-flex items-center gap-2 rounded-full bg-[#8b5cf6] px-6 py-3 text-sm font-semibold text-white shadow-[0_6px_20px_-4px_rgba(139,92,246,0.5)] transition-transform hover:scale-[1.02] active:scale-95"
      >
        Become a Partner
        <ArrowUpRight className="size-4" />
      </Link>
    </section>
  );
}
