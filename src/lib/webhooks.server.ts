import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";
import crypto from "crypto";

/**
 * User webhooks — let pro users register callbacks for generation events.
 * Supports: render_complete, share_created, low_credits
 */

const WebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.enum(["render_complete", "share_created", "low_credits"])),
  active: z.boolean().default(true),
});

export type Webhook = z.infer<typeof WebhookSchema> & { id: string; secret: string; created_at: string };

/**
 * Register a new webhook for the authenticated user
 */
export const registerWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof WebhookSchema>) => WebhookSchema.parse(d))
  .handler(async ({ data: input, context }) => {
    const { userId } = context;

    const secret = crypto.randomBytes(32).toString("hex");

    const { data: webhook, error } = await supabaseAdmin
      .from("user_webhooks")
      .insert({
        user_id: userId,
        url: input.url,
        events: input.events,
        secret,
        active: input.active,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return webhook;
  });


/**
 * List all webhooks for the authenticated user
 */
export const listWebhooks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;

    const { data, error } = await supabaseAdmin
      .from("user_webhooks")
      .select("id, url, events, active, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  });

/**
 * Delete a webhook
 */
export const deleteWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { webhookId: string }) => d)
  .handler(async ({ data, context }) => {
    const { webhookId } = data;
    const { userId } = context;

    const { error } = await supabaseAdmin
      .from("user_webhooks")
      .delete()
      .eq("id", webhookId)
      .eq("user_id", userId);

    if (error) throw new Error(error.message);
    return { success: true };
  });

/**
 * Test a webhook by sending a sample payload
 */
export const testWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { webhookId: string }) => d)
  .handler(async ({ data, context }) => {
    const { webhookId } = data;
    const { userId } = context;


    const { data: webhook } = await supabaseAdmin
      .from("user_webhooks")
      .select("*")
      .eq("id", webhookId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!webhook) throw new Error("Webhook not found");

    const payload = {
      event: "test",
      timestamp: new Date().toISOString(),
      data: { message: "This is a test webhook" },
    };

    const signature = crypto
      .createHmac("sha256", webhook.secret)
      .update(JSON.stringify(payload))
      .digest("hex");

    try {
      const response = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Aurora-Signature": signature,
          "X-Aurora-Webhook-ID": webhook.id,
        },
        body: JSON.stringify(payload),
      });

      return {
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  });

/**
 * Dispatch a webhook event to all registered webhooks for a user
 */
export async function dispatchWebhookEvent(
  userId: string,
  eventType: "render_complete" | "share_created" | "low_credits",
  payload: Record<string, any>
) {
  const { data: webhooks } = await supabaseAdmin
    .from("user_webhooks")
    .select("*")
    .eq("user_id", userId)
    .eq("active", true)
    .contains("events", [eventType]);

  if (!webhooks || webhooks.length === 0) return;

  for (const webhook of webhooks) {
    const signature = crypto
      .createHmac("sha256", webhook.secret)
      .update(JSON.stringify(payload))
      .digest("hex");

    // Fire and forget — log failures but don't block
    fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Aurora-Signature": signature,
        "X-Aurora-Webhook-ID": webhook.id,
        "X-Aurora-Event": eventType,
      },
      body: JSON.stringify({ event: eventType, timestamp: new Date().toISOString(), data: payload }),
    }).catch((err) => {
      console.error(`Webhook dispatch failed for ${webhook.id}: ${err.message}`);
    });
  }
}
