import { Link } from "@tanstack/react-router";
import { Wand2, Zap, Palette } from "lucide-react";

type Props = {
  userName?: string;
  creditBalance?: number;
  className?: string;
};

const QUICK_ACTIONS = [
  { label: "Generate image",   to: "/studio",       icon: Wand2  },
  { label: "Colors Studio",    to: "/colors",       icon: Palette },
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
