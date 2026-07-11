import { Shield, RefreshCw, Lock, Sparkles, Users, Star } from "lucide-react";

const STATS = [
  { value: "12,000+", label: "Creators worldwide", icon: Users },
  { value: "9",       label: "Frontier AI models", icon: Sparkles },
  { value: "4.9 ★",  label: "Average creator rating", icon: Star },
  { value: "7-day",  label: "No-questions refund", icon: RefreshCw },
  { value: "100%",   label: "Commercial license", icon: Shield },
  { value: "0",      label: "Data used for training", icon: Lock },
];

export function TrustBar() {
  return (
    <section className="relative z-10 px-6 md:px-12 pb-12">
      {/* Stat row */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-px rounded-2xl overflow-hidden border border-white/8 bg-white/8">
        {STATS.map(({ value, label, icon: Icon }) => (
          <div
            key={label}
            className="flex flex-col items-center justify-center gap-1.5 px-4 py-5 bg-[oklch(0.10_0.022_272)] hover:bg-white/[0.05] transition-colors text-center"
          >
            <Icon className="size-3.5 text-primary mb-0.5" />
            <span className="text-xl md:text-2xl font-black text-white tracking-tight leading-none">
              {value}
            </span>
            <span className="text-[10px] text-white/45 leading-snug max-w-[80px]">
              {label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
