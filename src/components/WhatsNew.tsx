import { useState, useEffect } from "react";
import { Bell, X, Sparkles, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { CHANGELOG, getUnreadCount } from "@/lib/changelog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const STORAGE_KEY = "aurora-whats-new-last-seen";

const BADGE_STYLES: Record<string, string> = {
  new: "bg-primary/15 text-primary border border-primary/25",
  update: "bg-red-500/15 text-red-400 border border-red-500/25",
  fix: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25",
  "coming-soon": "bg-muted text-muted-foreground border border-border",
};

const BADGE_LABELS: Record<string, string> = {
  new: "New",
  update: "Update",
  fix: "Fix",
  "coming-soon": "Soon",
};

export function WhatsNew() {
  const [open, setOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    setLastSeen(stored);
    setUnread(getUnreadCount(stored));
  }, []);

  function handleOpen() {
    setOpen(true);
    const latest = CHANGELOG[0]?.id ?? null;
    if (latest) {
      localStorage.setItem(STORAGE_KEY, latest);
      setLastSeen(latest);
      setUnread(0);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-label="What's new"
        className="relative flex items-center justify-center size-8 rounded-xl text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white shadow-[0_0_8px_var(--color-primary)] leading-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="phone-drawer-left flex flex-col gap-0 overflow-hidden p-0 w-full max-w-sm"
        >
          <span aria-hidden className="aurora-ambient opacity-60" />

          {/* Header */}
          <SheetHeader className="relative border-b border-border p-4 text-left shrink-0">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2.5 text-base">
                <span className="flex size-8 items-center justify-center rounded-xl bg-[image:var(--gradient-hero)] shadow-[var(--shadow-glow-soft)]">
                  <Sparkles className="size-4 text-white" />
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="font-semibold tracking-tight">What's New</span>
                  <span className="aurora-kicker mt-0.5">Aurora updates</span>
                </span>
              </SheetTitle>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex size-8 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
          </SheetHeader>

          {/* Feed */}
          <div className="relative flex-1 overflow-y-auto">
            <div className="flex flex-col divide-y divide-border">
              {CHANGELOG.map((entry, i) => {
                const isNew = lastSeen === null
                  ? true
                  : i < CHANGELOG.findIndex((e) => e.id === lastSeen);

                return (
                  <div
                    key={entry.id}
                    className={cn(
                      "relative flex gap-3.5 p-4 transition-colors",
                      isNew && "bg-primary/[0.03]",
                    )}
                  >
                    {/* new indicator dot */}
                    {isNew && (
                      <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />
                    )}

                    {/* Emoji icon */}
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl aurora-glass-strong text-lg leading-none mt-0.5">
                      {entry.icon}
                    </div>

                    <div className="flex flex-1 flex-col gap-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                            BADGE_STYLES[entry.badge],
                          )}
                        >
                          {BADGE_LABELS[entry.badge]}
                        </span>
                        <span className="text-[11px] text-muted-foreground shrink-0">{entry.date}</span>
                      </div>
                      <p className="text-sm font-semibold text-foreground leading-snug">{entry.title}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{entry.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom CTA */}
            <div className="sticky bottom-0 border-t border-border bg-background/90 backdrop-blur-md p-4">
              <a
                href="/roadmap"
                onClick={() => setOpen(false)}
                className="flex items-center justify-between w-full rounded-xl aurora-glass px-3.5 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground hover:aurora-glass-strong group"
              >
                <span className="font-medium">View full roadmap</span>
                <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </a>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
