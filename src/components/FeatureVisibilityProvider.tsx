/**
 * FeatureVisibilityProvider — client-side distribution of the artist-only
 * feature gating state (see src/lib/feature-visibility.ts).
 *
 * SSR/hydration contract (same pattern as SiteImagesProvider): the initial
 * render — server AND first client paint — always uses the seeded artist-only
 * defaults, so there is never a hydration mismatch. After mount we fetch the
 * live override state from /api/public/feature-visibility and re-render.
 *
 * Admins see everything: gated surfaces stay visible for them (with a small
 * "Hidden" badge so they know what regular users can't see). Admin status is
 * resolved client-side from either the passcode token (sessionStorage) or the
 * real Supabase admin role — the same convenience duality as /admin. This is
 * a UI concern only; hidden features' pages remain admin-usable and their
 * backends keep their own real auth.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { amIAdmin } from "@/lib/admin.functions";
import { getAdminToken } from "@/components/AdminGate";
import { supabase } from "@/integrations/supabase/client";
import { hasBackendEnv } from "@/integrations/backend-config";
import {
  defaultHiddenKeys,
  isFeatureKey,
  type FeatureKey,
} from "@/lib/feature-visibility";

export const FEATURE_VISIBILITY_REFRESH_EVENT = "aurora:feature-visibility-refresh";

type FeatureVisibilityContextValue = {
  /** Keys hidden from REGULAR users (admins still see gated surfaces). */
  hidden: ReadonlySet<FeatureKey>;
  /** True once the live override state has been fetched (or failed → defaults). */
  loaded: boolean;
  /** Viewer is an admin (passcode token or Supabase admin role). */
  isAdmin: boolean;
  /** True once the admin check has settled (needed by route guards). */
  adminChecked: boolean;
};

const defaultValue: FeatureVisibilityContextValue = {
  hidden: new Set(defaultHiddenKeys()),
  loaded: false,
  isAdmin: false,
  adminChecked: false,
};

const FeatureVisibilityContext = createContext<FeatureVisibilityContextValue>(defaultValue);

export function FeatureVisibilityProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState<ReadonlySet<FeatureKey>>(defaultValue.hidden);
  const [loaded, setLoaded] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);
  const amIAdminFn = useServerFn(amIAdmin);

  // Live hidden-set fetch. Fail-safe: any error keeps the seeded defaults.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/public/feature-visibility");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as { hidden?: unknown };
        const keys = Array.isArray(body.hidden) ? body.hidden.filter(isFeatureKey) : null;
        if (!cancelled && keys) setHidden(new Set(keys));
      } catch {
        // Store unreachable — the seeded artist-only defaults stay in force.
      } finally {
        if (!cancelled) setLoaded(true);
      }
    };
    void load();
    const onRefresh = () => void load();
    window.addEventListener(FEATURE_VISIBILITY_REFRESH_EVENT, onRefresh);
    return () => {
      cancelled = true;
      window.removeEventListener(FEATURE_VISIBILITY_REFRESH_EVENT, onRefresh);
    };
  }, []);

  // Admin detection. BOTH paths are server-verified — a stored passcode
  // token is only trusted after the admin API accepts it (a fabricated
  // sessionStorage value gets a 403 and grants nothing), and the Supabase
  // path checks the real `admin` role via amIAdmin. Presence of a token is
  // never sufficient on its own.
  useEffect(() => {
    let cancelled = false;
    const settle = (admin: boolean) => {
      if (cancelled) return;
      setIsAdmin(admin);
      setAdminChecked(true);
    };

    const checkSupabaseRole = async () => {
      if (!hasBackendEnv()) return settle(false);
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) return settle(false);
        const res = await amIAdminFn();
        settle(res.isAdmin);
      } catch {
        settle(false);
      }
    };

    const run = async () => {
      const token = getAdminToken();
      if (token) {
        try {
          const res = await fetch("/api/admin/feature-visibility", {
            headers: { "x-aurora-admin": token },
          });
          if (res.ok) return settle(true);
          // Invalid/stale token — fall through to the role check.
        } catch {
          // Network error — fall through to the role check.
        }
        if (cancelled) return;
      }
      await checkSupabaseRole();
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [amIAdminFn]);

  const value = useMemo(
    () => ({ hidden, loaded, isAdmin, adminChecked }),
    [hidden, loaded, isAdmin, adminChecked],
  );

  return (
    <FeatureVisibilityContext.Provider value={value}>
      {children}
    </FeatureVisibilityContext.Provider>
  );
}

export function useFeatureVisibility() {
  const ctx = useContext(FeatureVisibilityContext);
  /** Should this feature-gated surface be shown to the current viewer? */
  const showFeature = (key: FeatureKey | null | undefined): boolean => {
    if (!key) return true; // not gateable
    if (ctx.isAdmin) return true; // admins see everything
    return !ctx.hidden.has(key);
  };
  /** Is this feature hidden from regular users (for the admin "Hidden" badge)? */
  const isHiddenFromUsers = (key: FeatureKey | null | undefined): boolean =>
    !!key && ctx.hidden.has(key);
  return { ...ctx, showFeature, isHiddenFromUsers };
}

/** Small badge admins see on gated surfaces that regular users can't. */
export function HiddenBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="ml-1 inline-flex shrink-0 items-center rounded-full border border-amber-500/40 bg-amber-500/15 px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wider text-amber-400">
      Hidden
    </span>
  );
}

/**
 * Route-level guard for gateable pages: admins pass through, regular users
 * with the feature visible pass through, everyone else is redirected to the
 * studio. Renders nothing while the visibility/admin state is still loading
 * so hidden content never flashes.
 */
export function FeatureGuard({
  feature,
  children,
}: {
  feature: FeatureKey;
  children: ReactNode;
}) {
  const { hidden, loaded, isAdmin, adminChecked } = useFeatureVisibility();
  const navigate = useNavigate();

  const isHidden = hidden.has(feature);
  const allow = isAdmin || (loaded && !isHidden);
  const deny = loaded && adminChecked && isHidden && !isAdmin;

  useEffect(() => {
    if (deny) void navigate({ to: "/studio", replace: true });
  }, [deny, navigate]);

  if (allow) return <>{children}</>;
  return null;
}
