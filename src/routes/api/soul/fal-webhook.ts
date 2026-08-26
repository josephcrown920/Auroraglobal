import { createFileRoute } from "@tanstack/react-router";
import { applyTrainingResult } from "@/lib/soul.server";
import { verifySoulFalWebhook } from "@/lib/soul-fal-webhook.server";

/**
 * fal.ai LoRA-training webhook — transport dispatcher only. Signature/timestamp
 * verification lives in soul-fal-webhook.server.ts; training-result business
 * logic lives in soul.server.ts's applyTrainingResult (per the paystack-webhook
 * pattern). Keep nothing here except verification, JSON parsing, and dispatch.
 */
export const Route = createFileRoute("/api/soul/fal-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const verification = await verifySoulFalWebhook(request);
        if (!verification.ok) {
          return new Response(verification.message, { status: verification.status });
        }
        const { requestId, body } = verification;

        let event: {
          request_id?: string;
          status?: string;
          error?: string;
          payload?: { diffusers_lora_file?: { url?: string }; lora_file?: { url?: string } };
        };
        try {
          event = JSON.parse(body);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const reqId = event.request_id || requestId;
        if (event.status === "OK") {
          const loraUrl = event.payload?.diffusers_lora_file?.url ?? event.payload?.lora_file?.url;
          if (!loraUrl) {
            await applyTrainingResult(reqId, { ok: false, error: "Training completed with no LoRA file url" });
            return new Response("ok", { status: 200 });
          }
          await applyTrainingResult(reqId, { ok: true, loraUrl });
        } else {
          await applyTrainingResult(reqId, { ok: false, error: event.error || "Training failed" });
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});
