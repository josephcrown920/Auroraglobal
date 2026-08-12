import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Enforceable artist-only-mode gate INSIDE the Adult School artifact.
 *
 * The main app's /aurora-adult TanStack route guards its own entry link, but
 * the artifact itself is served by the platform proxy at /aurora-adult/ and
 * is directly reachable — so the toggle must also be enforced here, where the
 * content actually lives.
 *
 * Both apps share one origin (path-based proxy) and one Supabase project, so:
 *  - visibility state comes from the main app's public endpoint at
 *    /api/public/feature-visibility (root-relative escapes the artifact base);
 *  - admin status is server-verified by replaying either the shared owner
 *    passcode token (sessionStorage, same-origin) or the shared Supabase
 *    session bearer against /api/admin/feature-visibility — only a 200
 *    grants access; a fabricated token gets a 403 and grants nothing.
 *
 * Fail-closed: if the visibility endpoint is unreachable, we fall back to the
 * artist-only DEFAULT for this feature — hidden — rather than exposing it.
 */

const FEATURE_KEY = "adult-school";
const ADMIN_TOKEN_STORAGE_KEY = "aurora_admin_token";

type GateState = "checking" | "allowed" | "blocked";

async function isFeatureHidden(): Promise<boolean> {
  try {
    const res = await fetch("/api/public/feature-visibility");
    if (!res.ok) return true; // fail closed (default-hidden feature)
    const body = (await res.json()) as { hidden?: unknown };
    return Array.isArray(body.hidden) ? body.hidden.includes(FEATURE_KEY) : true;
  } catch {
    return true; // fail closed
  }
}

async function isVerifiedAdmin(): Promise<boolean> {
  // Path 1: owner passcode token (validated server-side, never trusted raw).
  let token: string | null = null;
  try {
    token = sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
  } catch {
    token = null;
  }
  if (token) {
    try {
      const res = await fetch("/api/admin/feature-visibility", {
        headers: { "x-aurora-admin": token },
      });
      if (res.ok) return true;
    } catch {
      // fall through to the bearer path
    }
  }

  // Path 2: shared Supabase session — the admin endpoint verifies the real
  // `admin` role in user_roles against this bearer.
  try {
    const { data } = await supabase.auth.getSession();
    const bearer = data.session?.access_token;
    if (!bearer) return false;
    const res = await fetch("/api/admin/feature-visibility", {
      headers: { Authorization: `Bearer ${bearer}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function FeatureVisibilityGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>("checking");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const hidden = await isFeatureHidden();
      if (!hidden) {
        if (!cancelled) setState("allowed");
        return;
      }
      const admin = await isVerifiedAdmin();
      if (cancelled) return;
      if (admin) {
        setState("allowed");
      } else {
        setState("blocked");
        // Send regular users back to the main app, same as hidden routes there.
        window.location.replace("/studio");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "allowed") return <>{children}</>;
  // "checking" and "blocked" both render nothing — gated content never flashes.
  return null;
}
