import { Link } from "@tanstack/react-router";
import { Plus, Download } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useRef, useState, useEffect } from "react";

function usePwaInstall() {
  const promptRef = useRef<Event & { prompt: () => Promise<void> } | null>(null);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      promptRef.current = e as Event & { prompt: () => Promise<void> };
      setCanInstall(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = async () => {
    if (!promptRef.current) return;
    await promptRef.current.prompt();
    promptRef.current = null;
    setCanInstall(false);
  };

  return { canInstall, install };
}

export function NavSection() {
  const { user } = useAuth();
  const { canInstall, install } = usePwaInstall();

  return (
    <nav aria-label="Primary" className="landing-nav absolute inset-x-0 top-0 z-40 w-full">
      <div className="flex h-14 items-center justify-between gap-3 px-5">
        <Link
          to="/"
          aria-label="Aurora Performance Studio — home"
          className="flex min-w-0 shrink items-center gap-2.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b5cf6] focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
        >
          <span className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#0a0a0f] ring-1 ring-white/15 shadow-[0_0_20px_-6px_rgba(139,92,246,0.75)]">
            <img
              src="/brand/aurora-mark.webp"
              alt=""
              width={36}
              height={36}
              decoding="async"
              className="size-full scale-110 object-cover"
            />
          </span>
          <span className="flex min-w-0 flex-col leading-tight drop-shadow-[0_1px_10px_rgba(0,0,0,0.75)]">
            <span className="truncate text-[13px] font-bold tracking-tight text-white">AURORA</span>
            <span className="landing-nav-sub truncate text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-400">
              Performance Studio
            </span>
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-3">
          {canInstall && (
            <button
              type="button"
              onClick={install}
              aria-label="Install the Aurora app"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-zinc-300 backdrop-blur-sm transition-colors hover:bg-white/10"
            >
              <Download className="size-3 shrink-0" />
              <span className="landing-nav-install-label">Install</span>
            </button>
          )}
          <Link
            to="/partners"
            className="landing-nav-partners inline-flex min-h-10 items-center px-1 text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-100"
          >
            Partners
          </Link>
          {user ? (
            <Link
              to="/studio"
              className="inline-flex min-h-9 items-center rounded-full bg-[#8b5cf6] py-2 pl-3 pr-4 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-95"
            >
              <Plus className="size-4 mr-1.5 shrink-0" strokeWidth={2.5} />
              Open Studio
            </Link>
          ) : (
            <Link
              to="/auth"
              className="inline-flex min-h-10 items-center px-1 text-sm font-medium text-zinc-200 transition-colors hover:text-white"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
