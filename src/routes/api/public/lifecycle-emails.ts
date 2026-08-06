/**
 * Cron endpoint: sends lifecycle + engagement emails.
 *
 * Triggered types:
 *   - re_engagement       — quiet users (no gen in 14d), cooldown 30d
 *   - first_purchase_nudge — never bought, account 3-45d old, one-time
 *   - onboarding_resume   — opened onboarding but never finished, 2h–14d window
 *   - weekly_digest       — users with ≥1 generation, not sent in 6d
 *   - daily_tip           — all users with email, not sent in 20h
 *
 * Auth: timing-safe compare against SUPABASE_SERVICE_ROLE_KEY
 *
 *   curl -X POST https://<domain>/api/public/lifecycle-emails \
 *        -H "Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>"
 */
import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  sendReEngagementEmail,
  sendFirstPurchaseNudgeEmail,
  sendOnboardingResumeEmail,
  sendWeeklyDigest,
  sendDailyTipEmail,
} from "@/lib/emails.server";

const RE_ENGAGEMENT_INACTIVE_DAYS = 14;
const RE_ENGAGEMENT_COOLDOWN_DAYS = 30;
const FIRST_PURCHASE_MIN_ACCOUNT_AGE_DAYS = 3;
const FIRST_PURCHASE_MAX_ACCOUNT_AGE_DAYS = 45;
const ONBOARDING_ABANDONED_MIN_AGE_HOURS = 2;
const ONBOARDING_ABANDONED_MAX_AGE_DAYS = 14;
const WEEKLY_DIGEST_COOLDOWN_DAYS = 6;
const DAILY_TIP_COOLDOWN_HOURS = 20;
const MAX_SENDS_PER_RUN = 150;

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}
function hoursAgoIso(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
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

  const { data: recentEmails } = await supabaseAdmin
    .from("email_log")
    .select("user_id")
    .eq("template", "re_engagement")
    .gte("sent_at", daysAgoIso(RE_ENGAGEMENT_COOLDOWN_DAYS))
    .limit(5000);
  const recentlyEmailed = new Set((recentEmails ?? []).map((e) => e.user_id).filter((id): id is string => id != null));

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

  const { data: alreadySent } = await supabaseAdmin
    .from("email_log")
    .select("user_id")
    .eq("template", "first_purchase_nudge")
    .limit(5000);
  const sentSet = new Set((alreadySent ?? []).map((e) => e.user_id).filter((id): id is string => id != null));
  return candidates.filter((p) => !sentSet.has(p.user_id)).map((p) => p.user_id);
}

async function collectOnboardingAbandonedTargets(): Promise<string[]> {
  const windowStart = daysAgoIso(ONBOARDING_ABANDONED_MAX_AGE_DAYS);
  const windowEnd = new Date(Date.now() - ONBOARDING_ABANDONED_MIN_AGE_HOURS * 60 * 60 * 1000).toISOString();

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
  const { data: bonusGranted } = await supabaseAdmin
    .from("profiles")
    .select("user_id, email, onboarding_bonus_granted")
    .in("user_id", startedUserIds)
    .not("email", "is", null);
  const unfinished = ((bonusGranted ?? []) as Array<{ user_id: string; email: string; onboarding_bonus_granted: boolean }>)
    .filter((p) => !p.onboarding_bonus_granted);
  if (unfinished.length === 0) return [];

  const { data: alreadySent } = await supabaseAdmin
    .from("email_log")
    .select("user_id")
    .eq("template", "onboarding_resume")
    .limit(5000);
  const sentSet = new Set((alreadySent ?? []).map((e) => e.user_id).filter((id): id is string => id != null));
  return unfinished.filter((p) => !sentSet.has(p.user_id)).map((p) => p.user_id);
}

/** Users who generated something this week and haven't had a weekly digest in 6 days. */
async function collectWeeklyDigestTargets(): Promise<string[]> {
  const weekAgo = daysAgoIso(7);
  const cooldownAgo = daysAgoIso(WEEKLY_DIGEST_COOLDOWN_DAYS);

  const { data: activeUsers } = await supabaseAdmin
    .from("generations")
    .select("user_id")
    .gte("created_at", weekAgo)
    .limit(5000);
  if (!activeUsers || activeUsers.length === 0) return [];

  const activeSet = [...new Set(activeUsers.map((g) => g.user_id))];

  const { data: recentlySent } = await supabaseAdmin
    .from("email_log")
    .select("user_id")
    .eq("template", "weekly-digest")
    .gte("sent_at", cooldownAgo)
    .limit(5000);
  const sentSet = new Set((recentlySent ?? []).map((e) => e.user_id).filter((id): id is string => id != null));

  return activeSet.filter((uid) => !sentSet.has(uid));
}

/**
 * All users with an email address who haven't received a daily_tip
 * in the last 20 hours. Capped at 500/run to avoid bursts.
 */
async function collectDailyTipTargets(): Promise<string[]> {
  const cooldownAgo = hoursAgoIso(DAILY_TIP_COOLDOWN_HOURS);

  const { data: allUsers } = await supabaseAdmin
    .from("profiles")
    .select("user_id")
    .not("email", "is", null)
    .limit(5000);
  if (!allUsers || allUsers.length === 0) return [];

  const { data: recentlySent } = await supabaseAdmin
    .from("email_log")
    .select("user_id")
    .eq("template", "daily_tip")
    .gte("sent_at", cooldownAgo)
    .limit(10000);
  const sentSet = new Set((recentlySent ?? []).map((e) => e.user_id).filter((id): id is string => id != null));

  return allUsers
    .map((u) => u.user_id)
    .filter((uid) => !sentSet.has(uid))
    .slice(0, 500);
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
          const [
            reEngagementTargets,
            firstPurchaseTargets,
            onboardingAbandonedTargets,
            weeklyDigestTargets,
            dailyTipTargets,
          ] = await Promise.all([
            collectReEngagementTargets(),
            collectFirstPurchaseNudgeTargets(),
            collectOnboardingAbandonedTargets(),
            collectWeeklyDigestTargets(),
            collectDailyTipTargets(),
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

          let weeklyDigestSent = 0;
          for (const userId of weeklyDigestTargets.slice(0, MAX_SENDS_PER_RUN)) {
            const res = await sendWeeklyDigest(userId);
            if (res?.success) weeklyDigestSent++;
          }

          let dailyTipSent = 0;
          for (const userId of dailyTipTargets) {
            const res = await sendDailyTipEmail(userId);
            if (res?.success) dailyTipSent++;
          }

          console.info(
            `[lifecycle-emails] re_engagement:${reEngagementSent}/${reEngagementTargets.length}` +
            ` first_purchase:${firstPurchaseSent}/${firstPurchaseTargets.length}` +
            ` onboarding_resume:${onboardingResumeSent}/${onboardingAbandonedTargets.length}` +
            ` weekly_digest:${weeklyDigestSent}/${weeklyDigestTargets.length}` +
            ` daily_tip:${dailyTipSent}/${dailyTipTargets.length}`,
          );

          return new Response(
            JSON.stringify({
              ok: true,
              reEngagement: { candidates: reEngagementTargets.length, sent: reEngagementSent },
              firstPurchaseNudge: { candidates: firstPurchaseTargets.length, sent: firstPurchaseSent },
              onboardingResume: { candidates: onboardingAbandonedTargets.length, sent: onboardingResumeSent },
              weeklyDigest: { candidates: weeklyDigestTargets.length, sent: weeklyDigestSent },
              dailyTip: { candidates: dailyTipTargets.length, sent: dailyTipSent },
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
