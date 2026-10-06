import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useFeatureVisibility } from "@/components/FeatureVisibilityProvider";
import { AdminGate, clearAdminGateRequest, hasAdminGateRequest } from "@/components/AdminGate";
import { authNextSearch, isAuthRedirectInFlight } from "@/lib/auth-return-path";

/** Where a signed-in viewer without admin authorization is sent (same as FeatureGuard). */
export const ADMIN_REJECT_ROUTE = "/studio";

/**
 * Route boundary for the whole /admin* subtree (mounted by the /admin layout
 * route, so every child page — current and future — sits behind it).
 *
 * Renders NOTHING but a spinner until BOTH the session and the server-verified
 * admin check have settled, then:
 *   • signed out            → /auth (returning here after sign-in)
 *   • signed in, not admin  → ADMIN_REJECT_ROUTE (replace, no admin chrome ever paints)
 *   • signed in, admin      → children
 *
 * "Admin" means FeatureVisibilityProvider.isAdmin: the Supabase `admin` role
 * confirmed by amIAdmin, or a stored owner passcode token the admin API has
 * accepted. A fabricated/stale sessionStorage value fails that check and is
 * treated exactly like any other non-admin.
 *
 * The owner passcode form is only offered when the viewer arrived through a
 * hidden owner entrance (requestAdminGate); it grants nothing on its own — the
 * boundary re-runs the server check after a successful unlock. Every admin
 * server function and /api/admin route keeps its own independent server-side
 * authorization regardless of what this boundary renders.
 */
export function AdminRouteBoundary({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { isAdmin, adminChecked, adminSubject, refreshAdminStatus } = useFeatureVisibility();
  const navigate = useNavigate();
  // Read synchronously (client only) so the rejection effect below never
  // fires before the marker is known; SSR renders the spinner regardless.
  const [gateRequested, setGateRequested] = useState<boolean>(() => hasAdminGateRequest());

  const signedOut = !loading && !user;
  // "Settled" means the provider's verdict was issued for THIS boundary's
  // resolved user. useAuth is per-instance, so the provider and the boundary
  // can learn about a sign-in/account switch at different moments; until the
  // verified subject matches, keep waiting rather than acting on an answer
  // about somebody else (a stale negative would bounce an admin who just
  // signed in, a stale positive would briefly paint admin chrome).
  const settled = !loading && !!user && adminChecked && adminSubject === user.id;
  const rejected = settled && !isAdmin && !gateRequested;

  useEffect(() => {
    if (signedOut) {
      // The root layout remounts this boundary the moment the URL flips to
      // /auth; navigating again from that remount would drop the next= param.
      if (isAuthRedirectInFlight()) return;
      void navigate({ to: "/auth", search: authNextSearch(), replace: true });
    } else if (rejected) {
      void navigate({ to: ADMIN_REJECT_ROUTE, replace: true });
    }
  }, [signedOut, rejected, navigate]);

  useEffect(() => {
    // A verified admin no longer needs the entrance marker; drop it so a later
    // non-admin session in the same tab is redirected like everyone else.
    if (settled && isAdmin && gateRequested) {
      clearAdminGateRequest();
      setGateRequested(false);
    }
  }, [settled, isAdmin, gateRequested]);

  if (settled && isAdmin) return <>{children}</>;

  if (settled && !isAdmin && gateRequested) {
    // The stored token is NOT trusted here: re-run the server check and let a
    // 200 from the admin API flip isAdmin. Keep the entrance marker until that
    // verified answer arrives — clearing it in the same tick would make the
    // stale "not admin" answer above look like a rejection and redirect away.
    return <AdminGate onUnlocked={refreshAdminStatus} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background" data-admin-boundary="pending">
      <Loader2 className="size-6 animate-spin text-primary" />
    </div>
  );
}
