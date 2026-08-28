// Aurora Soul — shared shell + nav for all /soul/* pages.
//
// Deliberately does NOT use <FeatureGuard> (which renders null while the
// visibility check is loading). Soul is fail-closed: every state — loading,
// denied, signed-out, allowed — renders explicit UI so the surface never
// looks broken or blank.
import { type ReactNode, useEffect } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Loader2, Lock, Sparkles } from "lucide-react";
import { useFeatureVisibility } from "@/components/FeatureVisibilityProvider";
import { useAuth } from "@/hooks/use-auth";
import { authNextSearch } from "@/lib/auth-return-path";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const TABS = [
  { to: "/soul", label: "Souls" },
  { to: "/soul/train", label: "Train" },
  { to: "/soul/generate", label: "Generate" },
  { to: "/soul/generate/video", label: "Video" },
  { to: "/soul/vibe", label: "Vibe Matcher" },
] as const;

function SoulSkeleton() {
  return (
    <div className="aurora-page-shell min-h-screen pb-24">
      <span aria-hidden className="aurora-ambient opacity-40 pointer-events-none" />
      <div className="relative z-10 mx-auto max-w-2xl px-4 pt-24 flex flex-col items-center gap-3 text-center">
        <Loader2 className="size-6 animate-spin text-[color:var(--brand-accent,theme(colors.primary.DEFAULT))]" />
        <p className="text-sm text-muted-foreground">Loading Aurora Soul…</p>
      </div>
    </div>
  );
}

function SoulDenied() {
  return (
    <div className="aurora-page-shell min-h-screen pb-24">
      <span aria-hidden className="aurora-ambient opacity-40 pointer-events-none" />
      <div className="relative z-10 mx-auto max-w-md px-4 pt-24 flex flex-col items-center gap-4 text-center">
        <Lock className="size-8 text-muted-foreground" />
        <h1 className="text-xl font-bold">Aurora Soul isn't available yet</h1>
        <p className="text-sm text-muted-foreground">
          This feature isn't turned on for your account. Redirecting you to Studio…
        </p>
        <Button asChild variant="outline">
          <Link to="/studio">Go to Studio</Link>
        </Button>
      </div>
    </div>
  );
}

function SoulSignedOut() {
  return (
    <div className="aurora-page-shell min-h-screen pb-24">
      <span aria-hidden className="aurora-ambient opacity-40 pointer-events-none" />
      <div className="relative z-10 mx-auto max-w-md px-4 pt-24 flex flex-col items-center gap-4 text-center">
        <Sparkles className="size-8 text-[color:var(--brand-accent,theme(colors.primary.DEFAULT))]" />
        <h1 className="text-xl font-bold">Sign in to use Aurora Soul</h1>
        <p className="text-sm text-muted-foreground">
          Train a face once, then generate identity-locked images and video of that character.
        </p>
        <Button asChild variant="premium">
          <Link to="/auth" search={authNextSearch()}>
            Sign in
          </Link>
        </Button>
      </div>
    </div>
  );
}

export function SoulShell({ children }: { children: ReactNode }) {
  const { hidden, loaded, isAdmin, adminChecked } = useFeatureVisibility();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isHidden = hidden.has("soul");
  const allow = isAdmin || (loaded && !isHidden);
  const deny = loaded && adminChecked && isHidden && !isAdmin;

  useEffect(() => {
    if (deny) void navigate({ to: "/studio", replace: true });
  }, [deny, navigate]);

  if (deny) return <SoulDenied />;
  if (!loaded || authLoading) return <SoulSkeleton />;
  if (!user) return <SoulSignedOut />;
  if (!allow) return <SoulSkeleton />;

  return (
    <div className="aurora-page-shell min-h-screen pb-24">
      <span aria-hidden className="aurora-ambient opacity-40 pointer-events-none" />
      <div className="relative z-10 mx-auto max-w-2xl px-4 pt-10">
        <header className="mb-6">
          <p className="aurora-kicker mb-1 flex items-center gap-1.5">
            <Sparkles className="size-3" /> Aurora Soul
          </p>
          <h1 className="text-2xl font-black tracking-tight text-white">
            Your character. <span className="aurora-gradient-text">Every scene.</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Train a face once, then generate identity-locked images and video of that character on demand.
          </p>
        </header>
        <nav className="mb-8 flex flex-wrap gap-2" aria-label="Aurora Soul sections">
          {TABS.map((tab) => (
            <Link
              key={tab.to}
              to={tab.to}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                pathname === tab.to
                  ? "border-transparent bg-[image:var(--gradient-hero)] text-white"
                  : "border-[color:var(--border-strong)] bg-[color:var(--surface-glass-strong)] text-foreground hover:brightness-110",
              )}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
        {children}
      </div>
    </div>
  );
}
