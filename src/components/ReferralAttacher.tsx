import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { getStoredRef, clearStoredRef } from "@/lib/referral";
import { attachReferralToProfile } from "@/lib/affiliate.functions";

/**
 * Attaches any locally-stored ?ref= code to the signed-in user's profile
 * once per session. Server-side validates and ignores self-referrals.
 */
export function ReferralAttacher() {
  const { user } = useAuth();
  const attach = useServerFn(attachReferralToProfile);
  useEffect(() => {
    if (!user) return;
    const code = getStoredRef();
    if (!code) return;
    attach({ data: { code } })
      .then(() => clearStoredRef())
      .catch(() => {});
  }, [user, attach]);
  return null;
}