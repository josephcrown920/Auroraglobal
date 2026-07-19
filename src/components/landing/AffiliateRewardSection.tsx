import { Link } from "@tanstack/react-router";
import { Gift, Coins, Users } from "lucide-react";

export function AffiliateRewardSection() {
  return (
    <section className="relative z-10 mx-4 md:mx-12 my-16 overflow-hidden rounded-[32px] border border-emerald-300/15 bg-gradient-to-br from-[#06140f] via-[#0a1a18] to-[#06070d] animate-fade-in">
      <div className="absolute inset-0 pointer-events-none opacity-40" style={{ background: "radial-gradient(circle at 100% 0%, rgba(34,197,94,.22), transparent 40%), radial-gradient(circle at 0% 100%, rgba(56,189,248,.22), transparent 45%)" }} />
      <div className="relative grid gap-10 px-6 py-14 md:grid-cols-[1.1fr_0.9fr] md:px-12 md:py-20 md:items-center">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-emerald-200">
            <Gift className="size-3.5" /> Affiliate rewards
          </span>
          <h2 className="mt-5 text-3xl font-bold tracking-tight text-white md:text-5xl">
            Get rewarded for growing the <em className="not-italic bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-transparent">Aurora</em> community.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-white/70 md:text-lg">
            Share your custom referral link, onboard other creators, and stack bonus Aura to power your next viral hit.
          </p>

          <ul className="mt-6 grid gap-3 text-sm text-white/80">
            <Reward icon={<Coins className="size-4" />} title="+50 Aura" body="instantly, for every new creator who signs up with your link." />
            <Reward icon={<Gift className="size-4" />} title="+20 bonus Aura" body="when your referral makes their first paid purchase." />
            <Reward icon={<Users className="size-4" />} title="Referral Tiers" body="Unlock higher daily rendering limits as your referral network grows." />
          </ul>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/affiliate" className="inline-flex items-center gap-2 rounded-full bg-emerald-300 px-6 py-3 text-sm font-bold text-emerald-950 no-underline hover:opacity-95">
              Get my referral link
            </Link>
            <Link to="/dashboard" className="inline-flex items-center gap-2 rounded-full aurora-glass-strong px-6 py-3 text-sm font-semibold text-white no-underline hover:brightness-110">
              See my stats
            </Link>
          </div>
        </div>

        <div className="grid gap-3">
          <Tile big label="Per signup" value="+5" suffix="Aura" />
          <div className="grid grid-cols-2 gap-3">
            <Tile label="First payment" value="+20" suffix="Aura" />
            <Tile label="Unlock" value="Tiers" suffix="limits" />
          </div>
          <div className="rounded-xl border border-border bg-black/40 p-4 text-xs text-white/55">
            Rewards are automatically credited to your account. No cash payouts, no subscription required. Aura to power your content, on us.
          </div>
        </div>
      </div>
    </section>
  );
}

function Reward({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <li className="flex items-start gap-3 rounded-xl aurora-glass p-3">
      <span className="mt-0.5 grid size-7 place-items-center rounded-md bg-emerald-300/15 text-emerald-200">{icon}</span>
      <span><strong className="text-white">{title}</strong> <span className="text-white/65">— {body}</span></span>
    </li>
  );
}

function Tile({ label, value, suffix, big }: { label: string; value: string; suffix: string; big?: boolean }) {
  return (
    <div className={`rounded-2xl aurora-glass p-5 ${big ? "py-8" : ""}`}>
      <div className="text-[11px] font-semibold uppercase tracking-widest text-white/55">{label}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <div className={`font-extrabold text-white ${big ? "text-6xl" : "text-4xl"} bg-gradient-to-r from-emerald-200 to-cyan-200 bg-clip-text text-transparent`}>{value}</div>
        <div className="text-sm text-white/60">{suffix}</div>
      </div>
    </div>
  );
}