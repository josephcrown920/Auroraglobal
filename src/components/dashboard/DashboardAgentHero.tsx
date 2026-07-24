import { Link } from "@tanstack/react-router";
import { Bot, Wand2, Zap, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  userName?: string;
  creditBalance?: number;
  className?: string;
};

const QUICK_ACTIONS = [
  { label: "Generate image",   to: "/studio",       icon: Wand2  },
  { label: "Video Studio",     to: "/agent",        icon: Bot    },
  { label: "Top up Aura",      to: "/billing",      icon: Zap    },
] as const;

/**
 * Dashboard Agent Hero — the first thing creators see when they open
 * the creator dashboard. Shows a greeting, credit balance, and quick
 * action shortcuts into the most common Aurora flows.
 */
export function DashboardAgentHero({ userName, creditBalance, className }: Props) {
  const greeting = getGreeting();
  const name = userName ? userName.split(" ")[0] : "there";

  return (
    <div className={className}>
      {/* Greeting */}
      <div className="mb-8">
        <p className="text-sm text-muted-foreground mb-1">{greeting}</p>
        <h1 className="text-3xl font-bold tracking-tight">
          Hey, {name} 👋
        </h1>
        {creditBalance !== undefined && (
          <p className="text-muted-foreground mt-1.5">
            You have{" "}
            <span className="aurora-gradient-text font-black text-lg">{creditBalance.toLocaleString()}</span>{" "}
            Aura to spend today.
          </p>
        )}
      </div>

      {/* Agent card */}
      <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-zinc-950/80 to-zinc-900 p-6 mb-6 shadow-[0_0_60px_-20px_oklch(0.72_0.2_300_/_0.2)]">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-32 rounded-full bg-primary/10 blur-[60px]" />
        </div>

        <div className="relative flex items-start gap-4">
          <div className="size-11 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
            <Bot className="size-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold mb-1">Aurora Video Agent</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your AI creative director. Describe a video concept and the agent
              plans scenes, generates frames, adds lip-sync, and assembles the
              final cut — all in one chat.
            </p>
          </div>
        </div>

        <Button asChild variant="premium" className="mt-5 w-full sm:w-auto">
          <Link to="/agent">
            Open Video Agent <ChevronRight className="size-4 ml-1" />
          </Link>
        </Button>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-2">
        {QUICK_ACTIONS.map(({ label, to, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-white/4 hover:bg-white/8 hover:border-primary/30 px-3 py-4 text-center transition-all group"
          >
            <div className="size-9 rounded-xl bg-white/8 group-hover:bg-primary/15 flex items-center justify-center transition-colors">
              <Icon className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
