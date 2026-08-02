import { createFileRoute } from "@tanstack/react-router";

// process.uptime() is captured from process start — gives real cold-start
// latency in the health response so operators can verify the startup probe
// passes within the target window.
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(
          JSON.stringify({
            ok: true,
            uptime_s: Math.round(process.uptime()),
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              // Never cache — every probe must hit the live process.
              "Cache-Control": "no-store",
            },
          },
        );
      },
    },
  },
});
