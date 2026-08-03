import { createFileRoute } from "@tanstack/react-router";

// Returns a free Pollinations.ai image URL for a given prompt.
// No API key needed — Pollinations is open-access.
// Used by the Video Agent pipeline to generate storyboard keyframes.
export const Route = createFileRoute("/api/video-agent/generate-frame")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { prompt } = (await request.json()) as { prompt: string };
        if (!prompt || typeof prompt !== "string") {
          return new Response("Missing prompt", { status: 400 });
        }

        // Trim and encode for Pollinations
        const encoded = encodeURIComponent(prompt.slice(0, 500));
        const seed = Math.floor(Math.random() * 999999);
        const url = `https://image.pollinations.ai/prompt/${encoded}?width=896&height=504&nologo=true&enhance=false&seed=${seed}`;

        // Verify the image is reachable (HEAD request)
        try {
          const check = await fetch(url, { method: "HEAD" });
          if (!check.ok) throw new Error(`Pollinations returned ${check.status}`);
        } catch {
          // Fallback URL with minimal params
          const fallback = `https://image.pollinations.ai/prompt/${encoded}?width=512&height=288&nologo=true&seed=${seed}`;
          return new Response(JSON.stringify({ url: fallback }), {
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ url }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
