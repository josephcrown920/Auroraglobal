import { Gift, Share2, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function ReferralBlock() {
  return (
    <section className="relative z-10 px-6 md:px-12 pb-16">
      <div className="grid md:grid-cols-2 gap-4 max-w-5xl mx-auto">
        <div className="rounded-3xl border border-amber-400/30 bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-transparent p-6 md:p-8">
          <span className="inline-flex items-center gap-1.5 text-xs text-amber-200 border border-amber-400/30 bg-amber-500/10 px-3 py-1 rounded-full">
            <Gift className="size-3" /> Gift cards
          </span>
          <h3 className="text-2xl font-semibold mt-3 leading-tight">Send Aurora to a creator you love.</h3>
          <p className="text-white/65 text-sm mt-2">
            Buy a $10, $30 or $80 gift card. They get instant Aurora, a beautiful unboxing page, and a head start on their next shoot.
          </p>
          <Link
            to="/gifts"
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-400 text-amber-950 text-sm font-semibold hover:bg-amber-300 no-underline"
          >
            Browse gift cards <ArrowRight className="size-3.5" />
          </Link>
        </div>

        <div className="rounded-3xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-transparent p-6 md:p-8">
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-200 border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 rounded-full">
            <Share2 className="size-3" /> Affiliate
          </span>
          <h3 className="text-2xl font-semibold mt-3 leading-tight">Share Aurora. Earn 20% for life.</h3>
          <p className="text-white/65 text-sm mt-2">
            Get your link in 30 seconds. Every Aurora pack your audience buys pays you 20% — recurring, no cap, paid monthly.
          </p>
          <Link
            to="/affiliate"
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-400 text-emerald-950 text-sm font-semibold hover:bg-emerald-300 no-underline"
          >
            Become an affiliate <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
