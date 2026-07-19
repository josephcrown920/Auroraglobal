import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { getStoredRef, clearStoredRef } from "@/lib/referral";
import { attachReferralToProfile } from "@/lib/affiliate.functions";

/**
 * Attaches any locally-stored ?ref= code to the signed-in user's profile
 * once per session. Server-side validates, ignores self-referrals, and
 * grants both sides their referral Aura (deduped server-side).
 */
export function ReferralAttacher() {
  const { user } = useAuth();
  const attach = useServerFn(attachReferralToProfile);
  useEffect(() => {
    if (!user) return;
    const code = getStoredRef();
    if (!code) return;
    attach({ data: { code } })
      .then((res) => {
        // Keep the stored ref if the referee grant failed transiently so the
        // next visit retries it (grants are deduped server-side).
        const retryLater = res && res.ok && "refereeGrant" in res && res.refereeGrant === "failed";
        if (!retryLater) clearStoredRef();
        if (res && res.ok && "refereeAura" in res && res.refereeAura > 0) {
          toast.success(`+${res.refereeAura} Aura added — welcome gift from your invite!`);
        }
      })
      .catch(() => {});
  }, [user, attach]);
  return null;
}
