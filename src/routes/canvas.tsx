import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/canvas")({
  // All optional so existing plain canvas links remain type-safe.
  validateSearch: (search: Record<string, unknown>): {
    template?: string; marketplaceTemplateId?: string; workflow?: string; run?: boolean;
  } => ({
    template: typeof search.template === "string" ? search.template : undefined,
    marketplaceTemplateId: typeof search.marketplaceTemplateId === "string" ? search.marketplaceTemplateId : undefined,
    workflow: typeof search.workflow === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(search.workflow) ? search.workflow : undefined,
    run: search.run === true || search.run === "1" || search.run === "true",
  }),
  head: () => ({
    meta: [
      { title: "Canvas — Aurora Orchestration" },
      { name: "description", content: "Node-based AI orchestration. Chain models, add lip-sync, motion and color in one trending workflow." },
      { property: "og:title", content: "Aurora Canvas — Trending AI workflows" },
      { property: "og:description", content: "Drag, chain and run multi-model AI workflows with an in-canvas agent." },
      { property: "og:url", content: "https://auroraperformancestudio.com/canvas" },
    ],
    links: [{ rel: "canonical", href: "https://auroraperformancestudio.com/canvas" }],
  }),
});

