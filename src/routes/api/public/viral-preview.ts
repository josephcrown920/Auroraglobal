import { createFileRoute } from "@tanstack/react-router";
import { ZodError } from "zod";
import { assertRateLimit, RateLimitError } from "@/lib/rate-limit.server";
import { buildViralPreviewUrl, ViralPreviewInputSchema } from "@/lib/viral-preview";

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "private, max-age=300",
};

export const Route = createFileRoute("/api/public/viral-preview")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip =
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          request.headers.get("x-real-ip") ||
          "unknown";

        try {
          assertRateLimit(`viral-preview:${ip}`, 12, 60_000);
        } catch (error) {
          if (error instanceof RateLimitError) {
            return new Response(JSON.stringify({ error: "Too many preview requests" }), {
              status: 429,
              headers: { ...JSON_HEADERS, "Retry-After": "60" },
            });
          }
          throw error;
        }

        try {
          const contentLength = Number(request.headers.get("content-length") ?? 0);
          if (contentLength > 1_024) {
            return new Response(JSON.stringify({ error: "Request too large" }), {
              status: 413,
              headers: JSON_HEADERS,
            });
          }

          const data = ViralPreviewInputSchema.parse(await request.json());
          const url = buildViralPreviewUrl(data.topic);
          return new Response(JSON.stringify({ url }), { headers: JSON_HEADERS });
        } catch (error) {
          if (error instanceof ZodError || error instanceof SyntaxError) {
            return new Response(JSON.stringify({ error: "Invalid topic" }), {
              status: 400,
              headers: JSON_HEADERS,
            });
          }
          return new Response(JSON.stringify({ error: "Preview unavailable" }), {
            status: 504,
            headers: JSON_HEADERS,
          });
        }
      },
    },
  },
});