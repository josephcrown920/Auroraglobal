/**
 * Cron endpoint: sends lifecycle + engagement emails.
 *
 * Triggered types:
 *   - re_engagement       — older users who have never generated, cooldown 30d
 *   - first_purchase_nudge — never bought, account 3-45d old, one-time
 *   - onboarding_resume   — opened onboarding but never finished, 2h–14d window
 *   - weekly_digest       — users with ≥1 generation, not sent in 6d
 *   - daily_tip           — all users with email, not sent in 20h
 *
 * Auth: the shared scheduler credential (`CRON_SECRET` or the
 * Supabase publishable/anon key), matching the other public cron routes.
 *
 *   curl -X POST https://<domain>/api/public/lifecycle-emails \
 *        -H "Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>"
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { authorizeCronStrict } from "@/lib/cron-auth";
import {
  sendReEngagementEmail,
  sendFirstPurchaseNudgeEmail,
  sendOnboardingResumeEmail,
  sendOnboardingDoneEmail,
  sendWeeklyDigest,
  sendDailyTipEmail,
} from "@/lib/emails.server";
import { shouldSendFirstPurchaseNudge, shouldSendReEngagement } from "@/lib/email-lifecycle";

const RE_ENGAGEMENT_INACTIVE_DAYS = 14;
const RE_ENGAGEMENT_COOLDOWN_DAYS = 30;
const FIRST_PURCHASE_MIN_ACCOUNT_AGE_DAYS = 3;
const FIRST_PURCHASE_MAX_ACCOUNT_AGE_DAYS = 45;
const ONBOARDING_ABANDONED_MIN_AGE_HOURS = 2;
const ONBOARDING_ABANDONED_MAX_AGE_DAYS = 14;
const WEEKLY_DIGEST_COOLDOWN_DAYS = 6;
const DAILY_TIP_COOLDOWN_HOURS = 20;
const MAX_SENDS_PER_RUN = 150;

// The daemon fires every 6h; anything much faster is a retry loop or abuse.
// Per-instance guard — every send is additionally deduplicated via email_log,
// so this only exists to stop pointless full-batch scans from burning CPU/DB.
const MIN_RUN_INTERVAL_MS = 30 * 60 * 1000;
let lastRunStartedAt = 0;

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

  const { data: generations } = await supabaseAdmin
    .from("generations")
    .select("user_id")
    .limit(5000);
  const generatedUserIds = new Set((generations ?? []).map((g) => g.user_id));

  const { data: recentEmails } = await supabaseAdmin
    .from("email_log")
    .select("user_id")
    .eq("template", "re_engagement")
    .gte("sent_at", daysAgoIso(RE_ENGAGEMENT_COOLDOWN_DAYS))
    .limit(5000);
  const recentlyEmailed = new Set((recentEmails ?? []).map((e) => e.user_id).filter((id): id is string => id != null));

  return candidates
    .filter((p) => shouldSendReEngagement({
      hasGenerated: generatedUserIds.has(p.user_id),
      recentlyEmailed: recentlyEmailed.has(p.user_id),
    }))
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
  return candidates
    .filter((p) => shouldSendFirstPurchaseNudge({
      lifetimeCreditsPurchased: p.lifetime_credits_purchased,
      alreadySent: sentSet.has(p.user_id),
    }))
    .map((p) => p.user_id);
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
  const { data: completedEvents } = await supabaseAdmin
    .from("events")
    .select("user_id")
    .in("name", ["onboarding_complete", "onboarding_completed"])
    .in("user_id", startedUserIds)
    .limit(5000);
  const completedUserIds = new Set((completedEvents ?? []).map((e) => e.user_id));

  const { data: bonusGranted } = await supabaseAdmin
    .from("profiles")
    .select("user_id, email, onboarding_bonus_granted")
    .in("user_id", startedUserIds)
    .not("email", "is", null);
  const unfinished = ((bonusGranted ?? []) as Array<{ user_id: string; email: string; onboarding_bonus_granted: boolean }>)
    .filter((p) => !p.onboarding_bonus_granted && !completedUserIds.has(p.user_id));
  if (unfinished.length === 0) return [];

  const { data: alreadySent } = await supabaseAdmin
    .from("email_log")
    .select("user_id")
    .eq("template", "onboarding_resume")
    .limit(5000);
  const sentSet = new Set((alreadySent ?? []).map((e) => e.user_id).filter((id): id is string => id != null));
  return unfinished.filter((p) => !sentSet.has(p.user_id)).map((p) => p.user_id);
}

async function collectOnboardingDoneTargets(): Promise<string[]> {
  const { data: completedEvents } = await supabaseAdmin
    .from("events")
    .select("user_id")
    .eq("name", "onboarding_complete")
    .not("user_id", "is", null)
    .limit(5000);
  const completedUserIds = [...new Set((completedEvents ?? []).map((e) => e.user_id as string))];
  if (completedUserIds.length === 0) return [];

  const [{ data: profiles }, { data: alreadySent }] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("user_id")
      .in("user_id", completedUserIds)
      .not("email", "is", null),
    supabaseAdmin
      .from("email_log")
      .select("user_id")
      .eq("template", "onboarding_done")
      .limit(5000),
  ]);
  const sentSet = new Set((alreadySent ?? []).map((e) => e.user_id).filter((id): id is string => id != null));
  return (profiles ?? []).map((p) => p.user_id).filter((userId) => !sentSet.has(userId));
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

/**
 * `profiles.user_id` predates a foreign key to auth.users, so an account
 * deletion (or a test account cleanup) can leave an orphaned profile behind.
 * `email_log.user_id` is intentionally stricter and rejects that orphan.
 * Validate the batch once before sending rather than letting the first stale
 * profile abort every other user's lifecycle email.
 */
async function filterToExistingAuthUsers(targets: string[]): Promise<{
  valid: string[];
  skipped: number;
}> {
  const uniqueTargets = [...new Set(targets)];
  if (uniqueTargets.length === 0) return { valid: [], skipped: 0 };

  const authUserIds = new Set<string>();
  const perPage = 1000;
  for (let page = 1; ; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`Failed to validate lifecycle email users: ${error.message}`);
    for (const user of data.users) authUserIds.add(user.id);
    if (data.users.length < perPage) break;
  }

  const valid = uniqueTargets.filter((userId) => authUserIds.has(userId));
  return { valid, skipped: uniqueTargets.length - valid.length };
}

export const Route = createFileRoute("/api/public/lifecycle-emails")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorizeCronStrict(request)) return new Response("Unauthorized", { status: 401 });

        const now = Date.now();
        if (now - lastRunStartedAt < MIN_RUN_INTERVAL_MS) {
          return new Response(
            JSON.stringify({ error: "ran_recently", retryAfterMs: MIN_RUN_INTERVAL_MS - (now - lastRunStartedAt) }),
            { status: 429, headers: { "Content-Type": "application/json" } },
          );
        }
        lastRunStartedAt = now;

        // One failed candidate (e.g. an account deleted between validation and
        // send) must never abort the rest of the batch.
        let sendFailures = 0;
        const safeSend = async (send: (userId: string) => Promise<{ success: boolean } | null | undefined>, userId: string) => {
          try {
            return await send(userId);
          } catch (err) {
            sendFailures++;
            console.error(`[lifecycle-emails] send failed for ${userId}:`, err instanceof Error ? err.message : err);
            return null;
          }
        };

        try {
          const [
            reEngagementTargets,
            firstPurchaseTargets,
            onboardingAbandonedTargets,
            onboardingDoneTargets,
            weeklyDigestTargets,
            dailyTipTargets,
          ] = await Promise.all([
            collectReEngagementTargets(),
            collectFirstPurchaseNudgeTargets(),
            collectOnboardingAbandonedTargets(),
            collectOnboardingDoneTargets(),
            collectWeeklyDigestTargets(),
            collectDailyTipTargets(),
          ]);

          const allTargets = await filterToExistingAuthUsers([
            ...reEngagementTargets,
            ...firstPurchaseTargets,
            ...onboardingAbandonedTargets,
            ...onboardingDoneTargets,
            ...weeklyDigestTargets,
            ...dailyTipTargets,
          ]);
          const validTargetIds = new Set(allTargets.valid);
          const existing = (targets: string[]) => targets.filter((userId) => validTargetIds.has(userId));
          const validReEngagementTargets = existing(reEngagementTargets);
          const validFirstPurchaseTargets = existing(firstPurchaseTargets);
          const validOnboardingTargets = existing(onboardingAbandonedTargets);
          const validOnboardingDoneTargets = existing(onboardingDoneTargets);
          const validWeeklyDigestTargets = existing(weeklyDigestTargets);
          const validDailyTipTargets = existing(dailyTipTargets);

          let reEngagementSent = 0;
          for (const userId of validReEngagementTargets.slice(0, MAX_SENDS_PER_RUN)) {
            const res = await safeSend(sendReEngagementEmail, userId);
            if (res?.success) reEngagementSent++;
          }

          let firstPurchaseSent = 0;
          for (const userId of validFirstPurchaseTargets.slice(0, MAX_SENDS_PER_RUN)) {
            const res = await safeSend(sendFirstPurchaseNudgeEmail, userId);
            if (res?.success) firstPurchaseSent++;
          }

          let onboardingResumeSent = 0;
          for (const userId of validOnboardingTargets.slice(0, MAX_SENDS_PER_RUN)) {
            const res = await safeSend(sendOnboardingResumeEmail, userId);
            if (res?.success) onboardingResumeSent++;
          }

          let onboardingDoneSent = 0;
          for (const userId of validOnboardingDoneTargets.slice(0, MAX_SENDS_PER_RUN)) {
            const res = await safeSend(sendOnboardingDoneEmail, userId);
            if (res?.success) onboardingDoneSent++;
          }

          let weeklyDigestSent = 0;
          for (const userId of validWeeklyDigestTargets.slice(0, MAX_SENDS_PER_RUN)) {
            const res = await safeSend(sendWeeklyDigest, userId);
            if (res?.success) weeklyDigestSent++;
          }

          let dailyTipSent = 0;
          for (const userId of validDailyTipTargets) {
            const res = await safeSend(sendDailyTipEmail, userId);
            if (res?.success) dailyTipSent++;
          }

          console.info(
            `[lifecycle-emails] re_engagement:${reEngagementSent}/${reEngagementTargets.length}` +
            ` first_purchase:${firstPurchaseSent}/${firstPurchaseTargets.length}` +
            ` onboarding_resume:${onboardingResumeSent}/${onboardingAbandonedTargets.length}` +
            ` onboarding_done:${onboardingDoneSent}/${onboardingDoneTargets.length}` +
            ` weekly_digest:${weeklyDigestSent}/${weeklyDigestTargets.length}` +
            ` daily_tip:${dailyTipSent}/${dailyTipTargets.length}` +
            ` skipped_orphaned_profiles:${allTargets.skipped}`,
          );

          return new Response(
            JSON.stringify({
              ok: true,
              reEngagement: { candidates: reEngagementTargets.length, sent: reEngagementSent },
              firstPurchaseNudge: { candidates: firstPurchaseTargets.length, sent: firstPurchaseSent },
              onboardingResume: { candidates: onboardingAbandonedTargets.length, sent: onboardingResumeSent },
              onboardingDone: { candidates: onboardingDoneTargets.length, sent: onboardingDoneSent },
              weeklyDigest: { candidates: weeklyDigestTargets.length, sent: weeklyDigestSent },
              dailyTip: { candidates: dailyTipTargets.length, sent: dailyTipSent },
              skippedOrphanedProfiles: allTargets.skipped,
              sendFailures,
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
