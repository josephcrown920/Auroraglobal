import { createFileRoute } from "@tanstack/react-router";
import { submitMaster, isLandrConfigured } from "@/lib/landr-mastering.server";

export const Route = createFileRoute("/api/audio/master")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isLandrConfigured()) {
          return new Response(
            JSON.stringify({ error: "LANDR_MASTERING_API_KEY is not configured. Add it in Settings → Secrets." }),
            { status: 503, headers: { "Content-Type": "application/json" } },
          );
        }

        const body = (await request.json()) as {
          inputUri: string;
          loudness?: string;
          style?: string;
          format?: string;
        };

        if (!body.inputUri) {
          return new Response("Missing inputUri", { status: 400 });
        }

        try {
          const result = await submitMaster({
            inputUri: body.inputUri,
            loudness: (body.loudness as "low" | "medium" | "high") ?? "medium",
            style: (body.style as "balanced" | "warm" | "open" | "punchy" | "clean") ?? "balanced",
            format: (body.format as "mp3" | "wav" | "aiff" | "flac" | "cd") ?? "mp3",
          });

          return new Response(JSON.stringify(result), {
            status: 202,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Mastering submission failed";
          return new Response(JSON.stringify({ error: msg }), {
            status: 502,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
