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
  useCallback,
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
import { useAuth } from "@/hooks/use-auth";
import { hasBackendEnv } from "@/integrations/backend-config";
import {
  currentAdminVerdict,
  type AdminVerdict,
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
  /**
   * Viewer is a SERVER-VERIFIED admin: either the stored passcode token was
   * accepted by the admin API, or the signed-in Supabase account holds the
   * `admin` role. Never derived from the mere presence of client state.
   */
  isAdmin: boolean;
  /** True once the admin check has settled for the CURRENT session (needed by route guards). */
  adminChecked: boolean;
  /**
   * The subject the settled check was verified for: the Supabase user id, or
   * null for a signed-out viewer. `undefined` while unchecked. Route guards
   * that hold their own session state compare this against their user so a
   * verdict is never applied to a different account than it was issued for.
   */
  adminSubject: string | null | undefined;
  /** Re-run the admin check (e.g. right after the owner passcode gate stores a token). */
  refreshAdminStatus: () => void;
};

const defaultValue: FeatureVisibilityContextValue = {
  hidden: new Set(defaultHiddenKeys()),
  loaded: false,
  isAdmin: false,
  adminChecked: false,
  adminSubject: undefined,
  refreshAdminStatus: () => {},
};

const FeatureVisibilityContext = createContext<FeatureVisibilityContextValue>(defaultValue);

export function FeatureVisibilityProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState<ReadonlySet<FeatureKey>>(defaultValue.hidden);
  const [loaded, setLoaded] = useState(false);
  // The last settled admin check, stamped with the subject + refresh
  // generation it answered for. Exposed values are DERIVED from it below, so
  // the moment the session changes (or a refresh is requested) the provider
  // reports "unchecked" in the very same render — there is no window in which
  // a previous session's verdict is presented as the current viewer's.
  const [verdict, setVerdict] = useState<AdminVerdict | null>(null);
  const [adminCheckNonce, setAdminCheckNonce] = useState(0);
  const amIAdminFn = useServerFn(amIAdmin);
  // Keyed on the resolved session so the check re-runs when the viewer signs
  // in or out mid-session (a one-shot mount check would leave an admin who
  // signs in via the SPA flow reported as a regular user until a full reload,
  // and a signed-out admin reported as admin).
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const refreshAdminStatus = useCallback(() => setAdminCheckNonce((n) => n + 1), []);
  const current = currentAdminVerdict(verdict, { authLoading, userId, nonce: adminCheckNonce });
  const isAdmin = current?.isAdmin ?? false;
  const adminChecked = current !== null;
  const adminSubject = current ? current.subject : undefined;

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
  // never sufficient on its own. The answer is stamped with the subject and
  // refresh generation it was computed for (see currentAdminVerdict), so a
  // late response from a superseded run can never be applied to the viewer
  // who is signed in now.
  useEffect(() => {
    if (authLoading) return; // wait for the persisted session to resolve
    let cancelled = false;
    const subject = userId;
    const nonce = adminCheckNonce;
    const settle = (admin: boolean) => {
      if (cancelled) return;
      setVerdict({ subject, nonce, isAdmin: admin });
    };

    const checkSupabaseRole = async () => {
      if (!hasBackendEnv() || !userId) return settle(false);
      try {
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
  }, [amIAdminFn, authLoading, userId, adminCheckNonce]);

  const value = useMemo(
    () => ({ hidden, loaded, isAdmin, adminChecked, adminSubject, refreshAdminStatus }),
    [hidden, loaded, isAdmin, adminChecked, adminSubject, refreshAdminStatus],
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
