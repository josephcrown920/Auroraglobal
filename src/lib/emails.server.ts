import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Lovable Emails integration — transactional email service.
 * Helpers are plain async functions (not server fns) so they can be called
 * from any server-only module without RPC overhead.
 */

export type EmailTemplate =
  | "welcome-5-credits"
  | "render-complete"
  | "low-credit-nudge"
  | "weekly-digest"
  | "payment-receipt"
  | "gift-redeemed";

export type LifecycleTemplate =
  | "signup_welcome"
  | "onboarding_done"
  | "password_reset_acknowledged";

type EmailPayload = {
  to: string;
  template: EmailTemplate | LifecycleTemplate;
  data: Record<string, unknown>;
  userId?: string;
};

/**
 * Send a transactional email. Logs to email_log table.
 */
export async function sendEmail(payload: EmailPayload) {
  const { to, template, userId } = payload;

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

  // Send via Resend.
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.AURORA_FROM_EMAIL || "Aurora Studio <onboarding@resend.dev>";
  if (!apiKey) {
    await supabaseAdmin.from("email_log").update({ status: "skipped" }).eq("id", record.id);
    return { success: true as const, emailId: record.id, skipped: true };
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
      await supabaseAdmin.from("email_log").update({ status: "failed", error: errText.slice(0, 500) }).eq("id", record.id);
      return { success: false as const, emailId: record.id, error: errText };
    }
    await supabaseAdmin.from("email_log").update({ status: "sent" }).eq("id", record.id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "send_failed";
    await supabaseAdmin.from("email_log").update({ status: "failed", error: msg }).eq("id", record.id);
    return { success: false as const, emailId: record.id, error: msg };
  }

  return { success: true as const, emailId: record.id };
}

function subjectFor(template: string, data: Record<string, unknown>): string {
  switch (template) {
    case "welcome-5-credits":
    case "signup_welcome":
      return "Welcome to Aurora — 5 free Aura inside";
    case "onboarding_done":
      return "You're all set on Aurora";
    case "render-complete":
      return `Your ${(data.kind as string) || "render"} is ready`;
    case "low-credit-nudge":
      return "Your Aura is running low";
    case "weekly-digest":
      return "Your week on Aurora";
    case "payment-receipt":
      return `Receipt — ${data.creditsGranted ?? ""} Aura`;
    case "gift-redeemed":
      return "You received Aura";
    case "password_reset_acknowledged":
      return "Your Aurora password was reset";
    default:
      return "Aurora Studio";
  }
}

function renderTemplate(template: string, data: Record<string, unknown>): string {
  const name = (data.displayName as string) || (data.name as string) || "there";
  const intro = `<p>Hi ${escapeHtml(name)},</p>`;
  const cta = `<p><a href="https://aurorastudiostar.lovable.app/studio" style="display:inline-block;padding:12px 18px;background:#5b6cff;color:#fff;border-radius:8px;text-decoration:none">Open Studio</a></p>`;
  let body = "";
  switch (template) {
    case "welcome-5-credits":
    case "signup_welcome":
      body = `<p>Welcome to Aurora Studio. You've got <strong>5 free Aura</strong> to play with — enough to render your first performance shot.</p>`;
      break;
    case "render-complete":
      body = `<p>Your <strong>${escapeHtml(String(data.kind ?? "render"))}</strong> just finished cooking. Hop back in to grab it.</p>`;
      break;
    case "low-credit-nudge":
      body = `<p>You've only got <strong>${Number(data.creditsRemaining ?? 0)}</strong> Aura left. Top up to keep the streak going.</p>`;
      break;
    case "weekly-digest":
      body = `<p>This week: <strong>${Number(data.images ?? 0)}</strong> images, <strong>${Number(data.videos ?? 0)}</strong> videos, <strong>${Number(data.lipsyncs ?? 0)}</strong> lip-syncs. Keep going.</p>`;
      break;
    case "payment-receipt":
      body = `<p>Thanks for the top-up. <strong>${Number(data.creditsGranted ?? 0)}</strong> Aura added (${escapeHtml(String(data.currency ?? ""))} ${escapeHtml(String(data.amount ?? ""))}). Ref: ${escapeHtml(String(data.reference ?? ""))}.</p>`;
      break;
    case "gift-redeemed":
      body = `<p>${escapeHtml(String(data.fromUser ?? "A friend"))} just sent you <strong>${Number(data.creditsRedeemed ?? 0)}</strong> Aura. Enjoy.</p>`;
      break;
    case "password_reset_acknowledged":
      body = `<p>Your password was reset. If this wasn't you, contact support immediately.</p>`;
      break;
    case "onboarding_done":
      body = `<p>Nice — your studio is set up. Start with a performance shot or a UGC ad.</p>`;
      break;
    default:
      body = `<p>Update from Aurora Studio.</p>`;
  }
  return `<!doctype html><html><body style="font-family:system-ui,-apple-system,sans-serif;color:#0b0b14;background:#f6f6fb;padding:24px"><div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;border:1px solid #ececf5">${intro}${body}${cta}<p style="color:#7a7a8c;font-size:12px;margin-top:24px">— Aurora Studio · <a href="https://aurorastudiostar.lovable.app" style="color:#7a7a8c">aurorastudiostar.lovable.app</a></p></div></body></html>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

/**
 * Lifecycle email entrypoint used by emails.functions.ts.
 */
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
  });
}

export async function sendWelcomeEmail(userId: string, _displayName: string, email: string) {
  return sendEmail({
    to: email,
    template: "welcome-5-credits",
    data: { displayName: _displayName },
    userId,
  });
}

export async function sendRenderCompleteEmail(
  userId: string,
  generationId: string,
  kind: string,
  duration?: number,
) {
  const { data: user } = await supabaseAdmin
    .from("profiles")
    .select("email, display_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (!user?.email) return;
  return sendEmail({
    to: user.email,
    template: "render-complete",
    data: {
      displayName: user.display_name || "Creator",
      kind: kind === "video" ? "Video" : "Image",
      duration,
      generationId,
    },
    userId,
  });
}

export async function sendLowCreditNudge(userId: string) {
  const { data: user } = await supabaseAdmin
    .from("profiles")
    .select("email, display_name, credits")
    .eq("user_id", userId)
    .maybeSingle();
  if (!user?.email || !user.credits || user.credits > 5) return;
  return sendEmail({
    to: user.email,
    template: "low-credit-nudge",
    data: {
      displayName: user.display_name || "Creator",
      creditsRemaining: user.credits,
    },
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

export async function sendGiftRedeemedEmail(
  userId: string,
  fromUser: string,
  creditsRedeemed: number,
) {
  const { data: user } = await supabaseAdmin
    .from("profiles")
    .select("email, display_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (!user?.email) return;
  return sendEmail({
    to: user.email,
    template: "gift-redeemed",
    data: {
      displayName: user.display_name || "Creator",
      fromUser,
      creditsRedeemed,
    },
    userId,
  });
}
