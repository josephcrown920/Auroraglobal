import { Link } from "@tanstack/react-router";
import { Settings, Coins } from "lucide-react";

interface HomeTopBarProps {
  credits: number | null;
  /** Single uppercase letter shown in the avatar circle. */
  avatarInitial: string;
}

export function HomeTopBar({ credits, avatarInitial }: HomeTopBarProps) {
  return (
    <header
      className="aurora-home-topbar phone-fixed-x fixed top-0 z-50 flex h-14 items-center justify-between px-4"
      style={{
        background: "oklch(0.085 0.022 272 / 0.90)",
        backdropFilter: "blur(28px) saturate(1.6)",
        WebkitBackdropFilter: "blur(28px) saturate(1.6)",
        borderBottom: "1px solid oklch(1 0 0 / 0.055)",
      }}
    >
      {/* ── Wordmark ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/25">
          <span className="inline-block size-2.5 rounded-full bg-primary" />
        </span>
        <span className="font-serif italic text-[17px] font-semibold tracking-tight text-foreground">
          Aurora
        </span>
      </div>

      {/* ── Right cluster ───────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        {credits !== null && (
          <div
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold"
            style={{
              background: "oklch(0.13 0.018 272)",
              border: "1px solid oklch(1 0 0 / 0.08)",
            }}
          >
            <Coins className="size-3 text-amber-400" />
            <span className="text-foreground/90 tabular-nums">{credits.toLocaleString()}</span>
            <span className="text-muted-foreground/50">Aura</span>
          </div>
        )}

        <Link
          to="/settings"
          search={{ tiktok: undefined, msg: undefined }}
          aria-label="Settings"
          className="flex size-8 items-center justify-center rounded-full text-muted-foreground/60 no-underline transition-colors hover:bg-white/[0.07] hover:text-foreground"
        >
          <Settings className="size-[17px]" />
        </Link>

        <Link
          to="/billing"
          aria-label="Account"
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-primary no-underline transition-colors hover:opacity-80"
          style={{
            background: "oklch(0.60 0.27 295 / 0.15)",
            boxShadow: "0 0 0 1px oklch(0.60 0.27 295 / 0.3)",
          }}
        >
          {avatarInitial}
        </Link>
      </div>
    </header>
  );
}
