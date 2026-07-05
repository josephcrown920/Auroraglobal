/**
 * Cron endpoint: sends the two growth lifecycle emails —
 *   - re_engagement: signed-up users who have gone quiet (no generation in
 *     the last RE_ENGAGEMENT_INACTIVE_DAYS days, account older than that too)
 *     and haven't been re-engaged in the last RE_ENGAGEMENT_COOLDOWN_DAYS.
 *   - first_purchase_nudge: Free users who never bought Aura
 *     (lifetime_credits_purchased = 0), whose account is old enough to have
 *     had a fair shot at converting but not so old the nudge is stale, and
 *     who have never received this nudge before (one-time).
 * Auth mirrors free-monthly-grant.ts: timing-safe compare against
 * SUPABASE_SERVICE_ROLE_KEY (private, server-only — never the anon key).
 *
 * Schedule externally, e.g.:
 *   curl -X POST https://<domain>/api/public/lifecycle-emails \
 *        -H "Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>"
 */
import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendReEngagementEmail, sendFirstPurchaseNudgeEmail, sendOnboardingResumeEmail } from "@/lib/emails.server";

const RE_ENGAGEMENT_INACTIVE_DAYS = 14;
const RE_ENGAGEMENT_COOLDOWN_DAYS = 30;
const FIRST_PURCHASE_MIN_ACCOUNT_AGE_DAYS = 3;
const FIRST_PURCHASE_MAX_ACCOUNT_AGE_DAYS = 45;
const ONBOARDING_ABANDONED_MIN_AGE_HOURS = 2;
const ONBOARDING_ABANDONED_MAX_AGE_DAYS = 14;
const MAX_SENDS_PER_RUN = 150;

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

async function collectReEngagementTargets(): Promise<string[]> {
  const inactiveSince = daysAgoIso(RE_ENGAGEMENT_INACTIVE_DAYS);

  const { data: candidates } = await supabaseAdmin
    .from("profiles")
    .select("user_id, email, created_at")
    .not("email", "is", null)
    .lte("created_at", inactiveSince)
    .limit(2000);
  if (!candidates || candidates.length === 0) return [];

  const { data: recentGens } = await supabaseAdmin
    .from("generations")
    .select("user_id")
    .gte("created_at", inactiveSince)
    .limit(5000);
  const activeUserIds = new Set((recentGens ?? []).map((g) => g.user_id));

  const { data: recentEmails } = await (supabaseAdmin as any)
    .from("email_log")
    .select("user_id")
    .eq("template", "re_engagement")
    .gte("sent_at", daysAgoIso(RE_ENGAGEMENT_COOLDOWN_DAYS))
    .limit(5000);
  const recentlyEmailed = new Set((recentEmails ?? []).map((e: { user_id: string }) => e.user_id));

  return candidates
    .filter((p) => !activeUserIds.has(p.user_id) && !recentlyEmailed.has(p.user_id))
    .map((p) => p.user_id);
}

async function collectFirstPurchaseNudgeTargets(): Promise<string[]> {
  const { data: candidates } = await supabaseAdmin
    .from("profiles")
    .select("user_id, email, created_at, lifetime_credits_purchased")
    .not("email", "is", null)
    .eq("lifetime_credits_purchased", 0)
    .lte("created_at", daysAgoIso(FIRST_PURCHASE_MIN_ACCOUNT_AGE_DAYS))
    .gte("created_at", daysAgoIso(FIRST_PURCHASE_MAX_ACCOUNT_AGE_DAYS))
    .limit(2000);
  if (!candidates || candidates.length === 0) return [];

  const { data: alreadySent } = await (supabaseAdmin as any)
    .from("email_log")
    .select("user_id")
    .eq("template", "first_purchase_nudge")
    .limit(5000);
  const sentSet = new Set((alreadySent ?? []).map((e: { user_id: string }) => e.user_id));

  return candidates.filter((p) => !sentSet.has(p.user_id)).map((p) => p.user_id);
}

/**
 * Users who saw or explicitly skipped the onboarding modal (tracked via
 * `onboarding_shown` / `onboarding_skipped` events) but never finished it —
 * i.e. never claimed the onboarding bonus (profiles.onboarding_bonus_granted
 * is still false). Windowed so we don't email people mid-session (>= 2h)
 * or long after they've churned (<= 14d).
 */
async function collectOnboardingAbandonedTargets(): Promise<string[]> {
  const windowStart = daysAgoIso(ONBOARDING_ABANDONED_MAX_AGE_DAYS);
  const windowEnd = new Date(
    Date.now() - ONBOARDING_ABANDONED_MIN_AGE_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const { data: startedEvents } = await supabaseAdmin
    .from("events")
    .select("user_id, created_at")
    .in("name", ["onboarding_shown", "onboarding_skipped"])
    .not("user_id", "is", null)
    .gte("created_at", windowStart)
    .lte("created_at", windowEnd)
    .limit(5000);
  if (!startedEvents || startedEvents.length === 0) return [];

  const startedUserIds = [...new Set(startedEvents.map((e) => e.user_id as string))];

  const { data: bonusGranted } = await (supabaseAdmin as any)
    .from("profiles")
    .select("user_id, email, onboarding_bonus_granted")
    .in("user_id", startedUserIds)
    .not("email", "is", null);
  const unfinished = ((bonusGranted ?? []) as Array<{ user_id: string; email: string; onboarding_bonus_granted: boolean }>).filter(
    (p) => !p.onboarding_bonus_granted,
  );
  if (unfinished.length === 0) return [];

  const { data: alreadySent } = await (supabaseAdmin as any)
    .from("email_log")
    .select("user_id")
    .eq("template", "onboarding_resume")
    .limit(5000);
  const sentSet = new Set((alreadySent ?? []).map((e: { user_id: string }) => e.user_id));

  return unfinished.filter((p) => !sentSet.has(p.user_id)).map((p) => p.user_id);
}

export const Route = createFileRoute("/api/public/lifecycle-emails")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
        if (!secret) return new Response("Not configured", { status: 500 });

        const authHeader = request.headers.get("Authorization") ?? "";
        const provided = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
        let authorised = false;
        try {
          if (provided.length === secret.length) {
            authorised = timingSafeEqual(Buffer.from(provided), Buffer.from(secret));
          }
        } catch {
          authorised = false;
        }
        if (!authorised) return new Response("Unauthorized", { status: 401 });

        try {
          const [reEngagementTargets, firstPurchaseTargets, onboardingAbandonedTargets] = await Promise.all([
            collectReEngagementTargets(),
            collectFirstPurchaseNudgeTargets(),
            collectOnboardingAbandonedTargets(),
          ]);

          let reEngagementSent = 0;
          for (const userId of reEngagementTargets.slice(0, MAX_SENDS_PER_RUN)) {
            const res = await sendReEngagementEmail(userId);
            if (res?.success) reEngagementSent++;
          }

          let firstPurchaseSent = 0;
          for (const userId of firstPurchaseTargets.slice(0, MAX_SENDS_PER_RUN)) {
            const res = await sendFirstPurchaseNudgeEmail(userId);
            if (res?.success) firstPurchaseSent++;
          }

          let onboardingResumeSent = 0;
          for (const userId of onboardingAbandonedTargets.slice(0, MAX_SENDS_PER_RUN)) {
            const res = await sendOnboardingResumeEmail(userId);
            if (res?.success) onboardingResumeSent++;
          }

          console.info(
            `[lifecycle-emails] re_engagement: ${reEngagementSent}/${reEngagementTargets.length}, first_purchase_nudge: ${firstPurchaseSent}/${firstPurchaseTargets.length}, onboarding_resume: ${onboardingResumeSent}/${onboardingAbandonedTargets.length}`,
          );
          return new Response(
            JSON.stringify({
              ok: true,
              reEngagement: { candidates: reEngagementTargets.length, sent: reEngagementSent },
              firstPurchaseNudge: { candidates: firstPurchaseTargets.length, sent: firstPurchaseSent },
              onboardingResume: { candidates: onboardingAbandonedTargets.length, sent: onboardingResumeSent },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (e) {
          const message = e instanceof Error ? e.message : "lifecycle_emails_failed";
          console.error("[lifecycle-emails] error:", message);
          return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
