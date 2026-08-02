import React from "react";
import { Link, useLocation } from "wouter";
import { useClerk } from "@clerk/react";
import { X, AlertTriangle } from "lucide-react";
import { useGetMe } from "@workspace/api-client-react";

const LOW_CREDIT_THRESHOLD = 50;
const DISMISSED_KEY = "aurora_low_credit_dismissed";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const { data: user } = useGetMe({ query: { refetchOnWindowFocus: true } });

  const [warningDismissed, setWarningDismissed] = React.useState(() => {
    try { return localStorage.getItem(DISMISSED_KEY) === "true"; } catch { return false; }
  });

  const credits = user?.credits;

  React.useEffect(() => {
    if (credits !== undefined && credits >= LOW_CREDIT_THRESHOLD) {
      try { localStorage.removeItem(DISMISSED_KEY); } catch { /* ignore */ }
      setWarningDismissed(false);
    }
  }, [credits]);

  const showLowCreditWarning = credits !== undefined && credits < LOW_CREDIT_THRESHOLD && !warningDismissed;

  function dismissWarning() {
    try { localStorage.setItem(DISMISSED_KEY, "true"); } catch { /* ignore */ }
    setWarningDismissed(true);
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-[#080808] text-white overflow-hidden font-sans">
      {/* ── Top bar ── */}
      <header className="shrink-0 sticky top-0 z-40 border-b border-[#181818] bg-[#080808]">
        <div className="flex items-center justify-between h-14 px-6 md:px-8">
          {/* Brand */}
          <Link href="/dashboard">
            <span className="text-[11px] font-black tracking-[0.35em] uppercase text-white cursor-pointer">AURORA</span>
          </Link>

          {/* Nav + Credits */}
          <div className="flex items-center gap-6">
            <Link href="/gallery">
              <span className={`text-[10px] font-bold tracking-[0.18em] uppercase cursor-pointer transition-colors ${
                location === "/gallery" ? "text-white" : "text-[#555] hover:text-white"
              }`}>Gallery</span>
            </Link>
            <Link href="/settings">
              <span className={`text-[10px] font-bold tracking-[0.18em] uppercase cursor-pointer transition-colors ${
                location === "/settings" ? "text-white" : "text-[#555] hover:text-white"
              }`}>Account</span>
            </Link>
            <Link href="/settings">
              <div className="flex items-center gap-1.5 bg-[#111] border border-[#2a2a2a] rounded-full px-3.5 py-1.5 cursor-pointer hover:border-[#444] transition-colors">
                <span className="text-[#FF3B30] text-[10px]">✦</span>
                <span className="text-[11px] font-bold text-white">
                  {credits !== undefined ? credits.toLocaleString() : "—"} CR
                </span>
                <span className="text-[9px] font-bold tracking-[0.12em] uppercase text-[#444] ml-1">Top up</span>
              </div>
            </Link>
          </div>
        </div>

        {/* Low credit warning banner */}
        {showLowCreditWarning && (
          <div className="flex items-center justify-between px-6 md:px-8 py-2.5 bg-amber-500/10 border-b border-amber-500/20">
            <div className="flex items-center gap-2 text-amber-400">
              <AlertTriangle size={12} className="shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-[0.18em]">
                Low balance — under {LOW_CREDIT_THRESHOLD} credits remaining.{" "}
                <Link href="/settings">
                  <span className="underline cursor-pointer hover:text-amber-300">Add credits →</span>
                </Link>
              </span>
            </div>
            <button onClick={dismissWarning} className="text-amber-400/60 hover:text-amber-400 transition-colors ml-4 shrink-0">
              <X size={12} />
            </button>
          </div>
        )}
      </header>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto scroll-smooth">
        {children}
      </main>
    </div>
  );
}
