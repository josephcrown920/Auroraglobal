import { Shield, RefreshCw, Lock, Sparkles, Users } from "lucide-react";

const BADGES = [
  { icon: Shield, label: "Commercial license" },
  { icon: Lock, label: "Private by default" },
  { icon: RefreshCw, label: "7-day refund" },
  { icon: Sparkles, label: "9 frontier models" },
  { icon: Users, label: "12,000+ creators" },
];

export function TrustBar() {
  return (
    <section className="relative z-10 px-6 md:px-12 pb-10">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm px-6 py-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
        {BADGES.map((b) => {
          const Icon = b.icon;
          return (
            <span key={b.label} className="inline-flex items-center gap-2 text-xs text-white/60 hover:text-white/90 transition">
              <Icon className="size-3.5 text-violet-300" /> {b.label}
            </span>
          );
        })}
      </div>
    </section>
  );
}
