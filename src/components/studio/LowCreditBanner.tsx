import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Coins, X, RefreshCw } from "lucide-react";
import { getAutoReloadSettings } from "@/hooks/use-auto-reload";

const LOW_CREDIT_THRESHOLD = 5;

/**
 * In-app nudge shown when a signed-in user's Aura balance is low or zero.
 * The email equivalent (sendLowCreditNudge) is cron-driven and can lag by
 * hours; this gives an immediate, visible conversion moment right where the
 * user hits the wall — one row above the "Buy Aura" panel.
 */
export function LowCreditBanner({ credits }: { credits: number | null | undefined }) {
  const [dismissed, setDismissed] = useState(false);

  if (credits == null || credits > LOW_CREDIT_THRESHOLD || dismissed) return null;

  const isEmpty = credits <= 0;
  const autoReloadOn = getAutoReloadSettings().enabled;

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 flex items-start gap-3">
      <Coins className="size-5 shrink-0 mt-0.5 text-primary" />
      <div className="flex-1 text-sm">
        <div className="font-semibold text-foreground">
          {isEmpty ? "You're out of Aura" : `Only ${credits} Aura left`}
        </div>
        <p className="text-muted-foreground mt-1">
          {isEmpty
            ? "Top up to keep generating — top-ups never expire and start from a few dollars."
            : "Top up now so your next render doesn't get interrupted."}
        </p>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <Link
            to="/billing"
            className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-primary hover:text-primary/80"
          >
            Buy Aura →
          </Link>
          {!autoReloadOn && (
            <Link
              to="/billing"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="size-3" />
              Set auto-top-up alert
            </Link>
          )}
          {autoReloadOn && (
            <span className="inline-flex items-center gap-1 text-xs text-primary/70">
              <RefreshCw className="size-3" /> Auto-top-up alert is on
            </span>
          )}
        </div>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-muted-foreground/60 hover:text-foreground"
        aria-label="Dismiss"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
