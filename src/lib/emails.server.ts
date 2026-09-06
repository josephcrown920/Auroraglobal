import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { firstGenerationDedupeKey, lifecycleDedupeKey, safeEmailImageUrl } from "@/lib/email-lifecycle";

const SITE = "https://auroraperformancestudio.com";
const STUDIO_URL = `${SITE}/studio`;

export type EmailTemplate =
  | "welcome-5-credits"
  | "render-complete"
  | "low-credit-nudge"
  | "weekly-digest"
  | "payment-receipt"
  | "gift-redeemed"
  | "gift-card-delivery"
  | "first_generation_complete"
  | "daily_tip";

export type LifecycleTemplate =
  | "signup_welcome"
  | "onboarding_done"
  | "password_reset_acknowledged"
  | "re_engagement"
  | "first_purchase_nudge"
  | "onboarding_resume";

type EmailPayload = {
  to: string;
  template: EmailTemplate | LifecycleTemplate;
  data: Record<string, unknown>;
  userId?: string;
  dedupeKey?: string;
};

export async function sendEmail(payload: EmailPayload) {
  const { to, template, userId, dedupeKey } = payload;

  let emailId: string;
  if (dedupeKey && userId) {
    const adminRpc = supabaseAdmin as unknown as {
      rpc: (
        name: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
    const { data: claimedId, error: claimErr } = await adminRpc.rpc("claim_email_delivery", {
      _user: userId,
      _to_email: to,
      _template: template,
      _dedupe_key: dedupeKey,
    });
    if (claimErr) throw new Error(`Failed to claim email delivery: ${claimErr.message}`);
    if (!claimedId) {
      return { success: true as const, emailId: null, skipped: true, duplicate: true };
    }
    emailId = String(claimedId);
  } else {
    const { data: record, error: insertErr } = await supabaseAdmin
      .from("email_log")
      .insert({
        to_email: to,
        template,
        status: "queued",
        user_id: userId ?? null,
      })
      .select()
      .single();

    if (insertErr) throw new Error(`Failed to log email: ${insertErr.message}`);
    emailId = record.id;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.AURORA_FROM_EMAIL || "Aurora Studio <noreply@auroraperformancestudio.com>";
  if (!apiKey) {
    await supabaseAdmin.from("email_log").update({ status: "skipped" }).eq("id", emailId);
    return { success: true as const, emailId, skipped: true };
  }

  const subject = subjectFor(template, payload.data);
  const html = renderTemplate(template, payload.data);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
    if (!res.ok) {
      const errText = await res.text();
      await supabaseAdmin.from("email_log").update({ status: "failed", error: errText.slice(0, 500) }).eq("id", emailId);
      return { success: false as const, emailId, error: errText };
    }
    await supabaseAdmin.from("email_log").update({ status: "sent" }).eq("id", emailId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "send_failed";
    await supabaseAdmin.from("email_log").update({ status: "failed", error: msg }).eq("id", emailId);
    return { success: false as const, emailId, error: msg };
  }

  return { success: true as const, emailId };
}

// ─── Subject lines ─────────────────────────────────────────────────────────────

function subjectFor(template: string, data: Record<string, unknown>): string {
  const day = new Date().getDay();
  const dailySubjects = [
    "Your Aurora creative drop this week",
    "Monday: 3 things to create on Aurora today",
    "New Aurora content ideas — try one now",
    "Mid-week: keep your content stack moving",
    "Thursday creator mode — prompts inside",
    "Friday drop: release something today",
    "Weekend creator fuel from Aurora",
  ];
  switch (template) {
    case "welcome-5-credits":
    case "signup_welcome":
      return "Welcome to Aurora — 50 free Aura are waiting for you";
    case "first_generation_complete":
      return "Your first Aurora creation is ready";
    case "daily_tip":
      return dailySubjects[day] ?? "Today's Aurora creative prompt";
    case "onboarding_done":
      return "You're set up on Aurora — start creating";
    case "render-complete":
      return `Your ${(data.kind as string) || "render"} just finished`;
    case "low-credit-nudge":
      return "Your Aura is running low — top up to keep going";
    case "weekly-digest":
      return "Your week on Aurora";
    case "payment-receipt":
      return `Receipt — ${data.creditsGranted ?? ""} Aura added`;
    case "gift-redeemed":
      return "You received Aura";
    case "gift-card-delivery":
      return "Your Aurora gift card is ready";
    case "password_reset_acknowledged":
      return "Your Aurora password was reset";
    case "re_engagement":
      return "Come back — your Aura is still here";
    case "first_purchase_nudge":
      return "Your free Aura is almost gone — keep creating";
    case "onboarding_resume":
      return "Finish your first creation — bonus Aura inside";
    default:
      return "Aurora Studio";
  }
}

// ─── HTML shell ────────────────────────────────────────────────────────────────

function shell(name: string, body: string, ctaLabel: string, ctaUrl: string): string {
  const safeName = escapeHtml(name);
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Aurora Studio</title></head>
<body style="margin:0;padding:0;background:#080a12;font-family:system-ui,-apple-system,'Segoe UI',Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#080a12">
<tr><td align="center" style="padding:48px 16px">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:520px;width:100%">

  <tr><td style="padding-bottom:28px;text-align:center">
    <a href="${SITE}" style="text-decoration:none">
      <span style="font-size:24px;font-weight:800;letter-spacing:-0.5px;color:#a78bfa">Aurora</span><span style="font-size:24px;font-weight:300;color:#6b7280"> Studio</span>
    </a>
  </td></tr>

  <tr><td style="background:#0f1123;border:1px solid rgba(167,139,250,0.18);border-radius:16px;padding:40px 36px">
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#d1d5db">Hi ${safeName},</p>
    ${body}
    <div style="text-align:center;margin-top:36px">
      <a href="${ctaUrl}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#7c3aed 0%,#a855f7 100%);color:#ffffff;border-radius:10px;text-decoration:none;font-size:15px;font-weight:600;letter-spacing:0.2px">${ctaLabel}</a>
    </div>
  </td></tr>

  <tr><td style="padding-top:20px;text-align:center">
    <p style="margin:0;font-size:12px;color:#374151">
      Aurora Performance Studio &nbsp;&middot;&nbsp;
      <a href="${SITE}" style="color:#4b5563;text-decoration:none">auroraperformancestudio.com</a>
    </p>
    <p style="margin:6px 0 0;font-size:11px;color:#1f2937">You're receiving this as a registered Aurora creator.</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

function hl(text: string): string {
  return `<strong style="color:#a78bfa">${escapeHtml(text)}</strong>`;
}

function p(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#d1d5db">${text}</p>`;
}

// ─── Templates ────────────────────────────────────────────────────────────────

const DAILY_TIPS = [
  {
    headline: "Performance shot, clean and cinematic",
    prompt: "Prompt: <em style=\"color:#c4b5fd\">\"Full-body performance shot, [your look], [location], golden hour, ARRI ALEXA, 85mm, shallow depth of field, film grain, editorial\"</em>",
    tip: "Pair with Motion Control to bring it to life.",
  },
  {
    headline: "The album cover you deserve",
    prompt: "Prompt: <em style=\"color:#c4b5fd\">\"Artist album cover, dramatic studio lighting, [your vibe], vinyl record era grain, bold typography space at top, dark moody palette\"</em>",
    tip: "Go to Studio → Image and paste the prompt directly.",
  },
  {
    headline: "UGC ad in 60 seconds",
    prompt: "Try the UGC Ads flow: pick your avatar, describe the scene, generate the still, then animate with Seedance.",
    tip: "Works without a camera. Results that look shot on set.",
  },
  {
    headline: "Lock your identity across every post",
    prompt: "Upload your real selfie in the Studio and use it as the identity reference for every generation — your face stays consistent across the whole catalog.",
    tip: "Save your face as an avatar to reuse it instantly.",
  },
  {
    headline: "Turn one clip into a week of content",
    prompt: "Use the Canvas to chain: Image node → Video node → Lipsync node. One run, three pieces of content from a single prompt.",
    tip: "Canvas is at /canvas — try the pipeline today.",
  },
  {
    headline: "The Colors Studio look",
    prompt: "Go to Colors Studio, pick a brand color palette, and generate a portrait. The backdrop becomes part of your visual identity.",
    tip: "Perfect for consistent branding across your socials.",
  },
  {
    headline: "Animate something you already made",
    prompt: "Go to your Gallery, pick any portrait still, and hit Animate. Seedance converts it to a 5-second moving clip ready for TikTok.",
    tip: "No extra prompting needed — just one click.",
  },
];

function renderTemplate(template: string, data: Record<string, unknown>): string {
  const name = (data.displayName as string) || (data.name as string) || "there";
  const day = new Date().getDay();

  switch (template) {
    case "welcome-5-credits":
    case "signup_welcome":
      return shell(
        name,
        p(`${hl("50 Aura")} are waiting in your new account — enough for two portrait shots or one short lip-sync at the standard tier.`) +
        p("Start with a real selfie, pick a visual direction, and let Aurora turn the blank page into something you can share. You can always try another look after that first render."),
        "Open My Studio",
        STUDIO_URL,
      );

    case "first_generation_complete":
      return shell(
        name,
        p(`Your first Aurora creation just finished. That one matters — it's the beginning of your whole catalog.`) +
        p(`Every artist who blows up started with a first piece. Keep creating and build your library.`) +
        (safeEmailImageUrl(data.resultUrl)
          ? `<div style="text-align:center;margin:24px 0"><img src="${escapeHtml(safeEmailImageUrl(data.resultUrl) as string)}" alt="Your creation" style="max-width:100%;border-radius:10px;border:1px solid rgba(167,139,250,0.2)"></div>`
          : ""),
        "Make Another",
        STUDIO_URL,
      );
    case "gift-card-delivery": {
      const kind = data.kind === "pro" ? `Aurora Pro for ${data.proDays} days` : `${data.credits} Aura`;
      return shell(
        name,
        p(`Your gift card is active and ready to share. It contains ${hl(kind)}.`) +
        p(`Your private redemption code: <strong style="display:inline-block;margin:6px 0;padding:12px 14px;border-radius:8px;background:#171a31;color:#f5f3ff;letter-spacing:1.5px">${escapeHtml(String(data.code ?? ""))}</strong>`) +
        p("Keep this code private until you send it to the person receiving the gift. They can redeem it from Aurora's Billing or Gifts page."),
        "Open Gift Cards",
        `${SITE}/gifts`,
      );
    }

    case "daily_tip": {
      const tip = DAILY_TIPS[day % DAILY_TIPS.length]!;
      return shell(
        name,
        `<p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#e9d5ff">${escapeHtml(tip.headline)}</p>` +
        p(tip.prompt) +
        `<div style="background:rgba(167,139,250,0.08);border-left:3px solid #7c3aed;border-radius:0 8px 8px 0;padding:14px 16px;margin:0 0 16px">` +
        `<p style="margin:0;font-size:13px;color:#a78bfa">${escapeHtml(tip.tip)}</p></div>`,
        "Create on Aurora",
        STUDIO_URL,
      );
    }

    case "render-complete":
      return shell(
        name,
        p(`Your ${hl(String(data.kind ?? "render"))} just finished. Head back to grab it, share it, or use it as the base for the next one.`),
        "View My Result",
        `${SITE}/gallery`,
      );

    case "low-credit-nudge":
      return shell(
        name,
        p(`You've got ${hl(String(Number(data.creditsRemaining ?? 0)))} Aura left. The next render could use most of it, so this is the right moment to keep your balance moving.`) +
        p(`The cheapest option is the 1-Day Pass — 150 Aura with a 150 Aura daily limit. Top up from Billing and keep creating without waiting for the next refresh.`),
        "Top Up Aura",
        `${SITE}/billing`,
      );

    case "weekly-digest": {
      const imgs = Number(data.images ?? 0);
      const vids = Number(data.videos ?? 0);
      const lips = Number(data.lipsyncs ?? 0);
      const total = imgs + vids + lips;
      return shell(
        name,
        p(`This week you created ${hl(String(total))} ${total === 1 ? "piece" : "pieces"} of content on Aurora.`) +
        `<table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;margin:16px 0 24px">` +
        `<tr>` +
        `<td style="text-align:center;padding:16px;background:rgba(167,139,250,0.08);border-radius:10px;border:1px solid rgba(167,139,250,0.12)"><div style="font-size:28px;font-weight:800;color:#a78bfa">${imgs}</div><div style="font-size:12px;color:#6b7280;margin-top:4px">Images</div></td>` +
        `<td style="width:12px"></td>` +
        `<td style="text-align:center;padding:16px;background:rgba(167,139,250,0.08);border-radius:10px;border:1px solid rgba(167,139,250,0.12)"><div style="font-size:28px;font-weight:800;color:#a78bfa">${vids}</div><div style="font-size:12px;color:#6b7280;margin-top:4px">Videos</div></td>` +
        `<td style="width:12px"></td>` +
        `<td style="text-align:center;padding:16px;background:rgba(167,139,250,0.08);border-radius:10px;border:1px solid rgba(167,139,250,0.12)"><div style="font-size:28px;font-weight:800;color:#a78bfa">${lips}</div><div style="font-size:12px;color:#6b7280;margin-top:4px">Lip-syncs</div></td>` +
        `</tr></table>` +
        p(total > 0 ? "Keep the momentum going — every piece you make builds the catalog." : "You didn't create anything this week — open Aurora and change that."),
        total > 0 ? "Keep Creating" : "Start This Week",
        STUDIO_URL,
      );
    }

    case "payment-receipt":
      return shell(
        name,
        p(`${hl(String(Number(data.creditsGranted ?? 0)))} Aura have been added to your balance.`) +
        `<div style="background:rgba(167,139,250,0.06);border:1px solid rgba(167,139,250,0.15);border-radius:10px;padding:16px;margin:0 0 16px;font-size:13px;color:#9ca3af">` +
        `<div>Amount: ${escapeHtml(String(data.currency ?? ""))} ${escapeHtml(String(data.amount ?? ""))}</div>` +
        `<div style="margin-top:6px">Ref: ${escapeHtml(String(data.reference ?? ""))}</div>` +
        `</div>`,
        "Start Creating",
        STUDIO_URL,
      );

    case "gift-redeemed":
      return shell(
        name,
        p(`${hl(escapeHtml(String(data.fromUser ?? "A creator")))} just sent you ${hl(String(Number(data.creditsRedeemed ?? 0)))} Aura. They're already in your balance.`),
        "Use My Aura",
        STUDIO_URL,
      );

    case "password_reset_acknowledged":
      return shell(
        name,
        p(`Your password was successfully reset. If this wasn't you, contact support immediately at ${SITE}.`),
        "Go to Aurora",
        SITE,
      );

    case "onboarding_done":
      return shell(
        name,
        p(`Your studio is set up and ready. Start with a performance shot, a UGC ad, or drop into the Canvas to build something from scratch.`),
        "Open Studio",
        STUDIO_URL,
      );

    case "re_engagement":
      return shell(
        name,
        p(`It's been a while. Your Aura balance is still sitting here and so is everything you started.`) +
        p(`Come back and pick up where you left off. The studio is exactly as you left it.`),
        "Come Back",
        STUDIO_URL,
      );

    case "first_purchase_nudge":
      return shell(
        name,
        p(`You've been creating on Aurora with your free Aura — now you're close to the limit.`) +
        p(`Grab a top-up pack to keep going without waiting for the monthly refresh. The cheapest pack covers 10+ more generations.`),
        "Top Up Now",
        `${SITE}/billing`,
      );

    case "onboarding_resume":
      return shell(
        name,
        p(`You set up your account but didn't finish your first creation.`) +
        p(`Come back and finish it — ${hl("we'll add bonus Aura")} to your balance the moment your first render completes.`),
        "Finish My First Creation",
        STUDIO_URL,
      );

    default:
      return shell(name, p("Update from Aurora Studio."), "Open Aurora", SITE);
  }
}

// ─── Public helpers ────────────────────────────────────────────────────────────

export async function sendLifecycleEmail(args: {
  userId: string;
  to: string;
  template: LifecycleTemplate;
  vars?: Record<string, unknown>;
}) {
  return sendEmail({
    to: args.to,
    template: args.template,
    data: args.vars ?? {},
    userId: args.userId,
    dedupeKey: lifecycleDedupeKey(args.template, args.userId),
  });
}

export async function sendWelcomeEmail(userId: string, _displayName: string, email: string) {
  return sendEmail({
    to: email,
    template: "welcome-5-credits",
    data: { displayName: _displayName },
    userId,
    dedupeKey: `welcome-5-credits:${userId}`,
  });
}

export async function sendFirstGenerationEmail(userId: string) {
  const { data: user } = await supabaseAdmin
    .from("profiles")
    .select("email, display_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (!user?.email) return;
  const { data: firstGeneration } = await supabaseAdmin
    .from("generations")
    .select("result_image_url")
    .eq("user_id", userId)
    .eq("status", "succeeded")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();
  return sendEmail({
    to: user.email,
    template: "first_generation_complete",
    data: {
      displayName: user.display_name || "Creator",
      resultUrl: firstGeneration?.result_image_url ?? null,
    },
    userId,
    dedupeKey: firstGenerationDedupeKey(userId),
  });
}

export async function sendDailyTipEmail(userId: string) {
  const { data: user } = await supabaseAdmin
    .from("profiles")
    .select("email, display_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (!user?.email) return;
  return sendEmail({ to: user.email, template: "daily_tip", data: { displayName: user.display_name || "Creator" }, userId });
}

export async function sendRenderCompleteEmail(userId: string, _generationId: string, kind: string) {
  const { data: user } = await supabaseAdmin
    .from("profiles")
    .select("email, display_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (!user?.email) return;
  return sendEmail({
    to: user.email,
    template: "render-complete",
    data: { displayName: user.display_name || "Creator", kind: kind === "video" ? "Video" : "Image" },
    userId,
  });
}

export async function sendLowCreditNudge(userId: string) {
  const { data: user } = await supabaseAdmin
    .from("profiles")
    .select("email, display_name, credits")
    .eq("user_id", userId)
    .maybeSingle();
  if (!user?.email || user.credits == null || user.credits > 5) return;
  return sendEmail({
    to: user.email,
    template: "low-credit-nudge",
    data: { displayName: user.display_name || "Creator", creditsRemaining: user.credits },
    userId,
  });
}

export async function sendWeeklyDigest(userId: string) {
  const { data: user } = await supabaseAdmin
    .from("profiles")
    .select("email, display_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (!user?.email) return;
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: gens } = await supabaseAdmin
    .from("generations")
    .select("id, kind, status")
    .eq("user_id", userId)
    .gte("created_at", weekAgo);
  const counts = {
    images: gens?.filter((g) => g.kind === "image").length ?? 0,
    videos: gens?.filter((g) => g.kind === "video").length ?? 0,
    lipsyncs: gens?.filter((g) => g.kind === "lipsync").length ?? 0,
  };
  return sendEmail({
    to: user.email,
    template: "weekly-digest",
    data: { displayName: user.display_name || "Creator", ...counts },
    userId,
  });
}

export async function sendPaymentReceipt(
  userId: string,
  paymentId: string,
  amount: number,
  currency: string,
  creditsGranted: number,
) {
  const { data: user } = await supabaseAdmin
    .from("profiles")
    .select("email, display_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (!user?.email) return;
  return sendEmail({
    to: user.email,
    template: "payment-receipt",
    data: {
      displayName: user.display_name || "Creator",
      amount: amount.toFixed(2),
      currency,
      creditsGranted,
      reference: paymentId,
    },
    userId,
  });
}

export async function sendReEngagementEmail(userId: string) {
  const { data: user } = await supabaseAdmin
    .from("profiles")
    .select("email, display_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (!user?.email) return;
  return sendEmail({ to: user.email, template: "re_engagement", data: { displayName: user.display_name || "Creator" }, userId });
}

export async function sendFirstPurchaseNudgeEmail(userId: string) {
  const { data: user } = await supabaseAdmin
    .from("profiles")
    .select("email, display_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (!user?.email) return;
  return sendLifecycleEmail({
    userId,
    to: user.email,
    template: "first_purchase_nudge",
    vars: { displayName: user.display_name || "Creator" },
  });
}

export async function sendOnboardingResumeEmail(userId: string) {
  const { data: user } = await supabaseAdmin
    .from("profiles")
    .select("email, display_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (!user?.email) return;
  return sendLifecycleEmail({
    userId,
    to: user.email,
    template: "onboarding_resume",
    vars: { displayName: user.display_name || "Creator" },
  });
}

export async function sendOnboardingDoneEmail(userId: string) {
  const { data: user } = await supabaseAdmin
    .from("profiles")
    .select("email, display_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (!user?.email) return;
  return sendLifecycleEmail({
    userId,
    to: user.email,
    template: "onboarding_done",
    vars: { displayName: user.display_name || "Creator" },
  });
}

export async function sendGiftRedeemedEmail(userId: string, fromUser: string, creditsRedeemed: number) {
  const { data: user } = await supabaseAdmin
    .from("profiles")
    .select("email, display_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (!user?.email) return;
  return sendEmail({
    to: user.email,
    template: "gift-redeemed",
    data: { displayName: user.display_name || "Creator", fromUser, creditsRedeemed },
    userId,
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
