import React from "react";
import { Link, useLocation } from "wouter";
import { useClerk } from "@clerk/react";
import { LayoutDashboard, Library, Settings, LogOut, Menu, X, Sparkles, AlertTriangle } from "lucide-react";
import { useGetMe } from "@workspace/api-client-react";

const LOW_CREDIT_THRESHOLD = 50;
const DISMISSED_KEY = "aurora_low_credit_dismissed";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/gallery", label: "Gallery", icon: Library },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const { data: user } = useGetMe({ query: { refetchOnWindowFocus: true } });
  const [warningDismissed, setWarningDismissed] = React.useState(() => {
    try {
      return localStorage.getItem(DISMISSED_KEY) === "true";
    } catch {
      return false;
    }
  });

  const credits = user?.credits;

  // Reset dismissal when credits go back above threshold so the warning
  // reappears the next time the balance drops below it again.
  React.useEffect(() => {
    if (credits !== undefined && credits >= LOW_CREDIT_THRESHOLD) {
      try {
        localStorage.removeItem(DISMISSED_KEY);
      } catch { /* ignore */ }
      setWarningDismissed(false);
    }
  }, [credits]);

  const showLowCreditWarning =
    credits !== undefined &&
    credits < LOW_CREDIT_THRESHOLD &&
    !warningDismissed;

  function dismissWarning() {
    try {
      localStorage.setItem(DISMISSED_KEY, "true");
    } catch { /* ignore */ }
    setWarningDismissed(true);
  }

  return (
    <div className="flex h-[100dvh] bg-background text-white overflow-hidden font-sans">
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-background border-b border-border z-40 flex items-center justify-between px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="inline-block size-2 rounded-full bg-brand" />
          <span className="font-display font-bold text-sm uppercase tracking-[0.18em]">Aurora</span>
        </Link>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-muted-foreground hover:text-white">
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-60 bg-background border-r border-border flex flex-col transition-transform duration-300
        md:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-16 flex items-center px-5 border-b border-border mt-14 md:mt-0">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="inline-block size-2 rounded-full bg-brand" />
            <span className="font-display font-bold text-sm uppercase tracking-[0.18em]">Aurora</span>
          </Link>
        </div>

        <div className="p-4 space-y-2">
          <div className={`aurora-card p-4 flex items-center justify-between ${showLowCreditWarning ? 'border border-amber-500/40' : ''}`}>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Credits</p>
              <p className={`text-xl font-bold flex items-center gap-1 ${showLowCreditWarning ? 'text-amber-400' : 'text-white'}`}>
                <span className={`text-sm ${showLowCreditWarning ? 'text-amber-400' : 'text-brand'}`}>✦</span>
                {credits !== undefined ? credits.toLocaleString() : '—'}
              </p>
            </div>
            <Link href="/settings" className="text-[10px] font-bold uppercase tracking-wider text-brand hover:underline">
              Top up
            </Link>
          </div>

          {showLowCreditWarning && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 text-amber-400">
                  <AlertTriangle size={13} className="shrink-0 mt-px" />
                  <span className="text-[11px] font-bold uppercase tracking-[0.15em]">Low balance</span>
                </div>
                <button
                  onClick={dismissWarning}
                  className="text-amber-400/60 hover:text-amber-400 transition-colors"
                  aria-label="Dismiss warning"
                >
                  <X size={13} />
                </button>
              </div>
              <p className="text-[11px] text-amber-300/80 leading-relaxed">
                You have fewer than {LOW_CREDIT_THRESHOLD} credits left. Top up to keep creating.
              </p>
              <Link
                href="/pricing"
                className="text-[10px] font-bold uppercase tracking-wider text-amber-400 hover:text-amber-300 transition-colors"
              >
                Add credits →
              </Link>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-2 px-3 space-y-1">
          {navItems.map((item) => {
            const active = location === item.href || location.startsWith(item.href + '/');
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${active ? 'bg-card text-white' : 'text-muted-foreground hover:text-white hover:bg-card/50'}
                `}
              >
                <Icon size={18} className={active ? "text-brand" : "opacity-70"} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <button
            onClick={() => signOut({ redirectUrl: basePath || "/" })}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut size={18} className="opacity-70" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative md:ml-60 w-full h-[100dvh] bg-background">
        <div className="flex-1 overflow-y-auto pt-14 md:pt-0 scroll-smooth px-4 md:px-10">
          <div className="max-w-[1200px] mx-auto py-8 md:py-10">
            {children}
          </div>
        </div>
      </main>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}
