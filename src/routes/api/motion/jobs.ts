import { createFileRoute } from "@tanstack/react-router";
import { generateMimicMotion } from "@/lib/studio.functions";
import { authenticatedUserId } from "@/lib/api-auth.server";

function errorStatus(message: string): number {
  if (/unauthorized|not authenticated/i.test(message)) return 401;
  if (/not enough aura|insufficient_credits/i.test(message)) return 402;
  if (/no motion-capable gpu backend|no motion worker/i.test(message)) return 503;
  if (/already rendering|motion_enqueue_limit/i.test(message)) return 409;
  return 400;
}

export const Route = createFileRoute("/api/motion/jobs")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = await authenticatedUserId(request);
        if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

        try {
          const body = await request.json();
          const result = await generateMimicMotion({ data: body });
          return Response.json(result, { status: 202 });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Motion enqueue failed";
          return Response.json({ error: message }, { status: errorStatus(message) });
        }
      },
    },
  },
});
