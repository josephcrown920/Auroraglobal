import { createFileRoute } from "@tanstack/react-router";
import { SPIN_COUNT } from "@/lib/spin-engine";

export const Route = createFileRoute("/spin")({
  validateSearch: (search: Record<string, unknown>) => ({
    prompt: typeof search.prompt === "string" ? search.prompt : undefined,
    jobId: typeof search.jobId === "string" ? search.jobId : undefined,
  }),
  errorComponent: ({ error }) => (
    <div className="p-8 text-white">Spin failed: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8 text-white">Not found.</div>,
  head: () => ({
    meta: [
      { title: `TikTok30 · Aurora` },
      { name: "description", content: `Turn one prompt into ${SPIN_COUNT} scroll-stopping, high-variation posts — same face, endless looks.` },
    ],
    links: [{ rel: "canonical", href: "https://auroraperformancestudio.com/spin" }],
  }),
});

