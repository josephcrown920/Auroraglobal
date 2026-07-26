import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "Docs — AI Studio" },
      { name: "description", content: "How the AI Studio workspace is organized." },
      { property: "og:title", content: "Docs — AI Studio" },
      { property: "og:description", content: "How the AI Studio workspace is organized." },
    ],
  }),
  component: Docs,
});

function Docs() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10 prose prose-invert">
      <h1 className="text-3xl font-semibold tracking-tight">Documentation</h1>

      <h2 className="mt-8 text-lg font-semibold">Architecture</h2>
      <p className="text-sm text-muted-foreground">
        AI Studio runs on TanStack Start (React + Vite) with a single dark, glassy
        design system defined in <code>src/styles.css</code>. Every color, gradient, and
        shadow is a semantic token.
      </p>

      <h2 className="mt-6 text-lg font-semibold">Image generation</h2>
      <p className="text-sm text-muted-foreground">
        The Playground POSTs to <code>/api/generate-image</code>, which streams SSE from{" "}
        <code>ai.gateway.lovable.dev</code> using the <code>google/gemini-3-pro-image</code>{" "}
        model. Partial frames render blurred until the completed event arrives.
      </p>

      <h2 className="mt-6 text-lg font-semibold">Storage (v1)</h2>
      <p className="text-sm text-muted-foreground">
        Gallery, prompts, and references live in localStorage via{" "}
        <code>src/lib/studio-store.ts</code>. Migrate to Lovable Cloud storage when you're
        ready — the store surface stays the same.
      </p>

      <h2 className="mt-6 text-lg font-semibold">Providers</h2>
      <p className="text-sm text-muted-foreground">
        OpenAI and Google Gemini are wired via the Lovable AI Gateway with no extra keys.
        For Claude / Fal / Replicate / Runware / Kling / Minimax / Luma / Veo, add each
        provider's secret and create an adapter under <code>src/lib/providers/</code>.
      </p>

      <h2 className="mt-6 text-lg font-semibold">Routes</h2>
      <ul className="text-sm text-muted-foreground list-disc list-inside">
        <li><code>/</code> — Dashboard</li>
        <li><code>/playground</code> — Streaming image generation</li>
        <li><code>/gallery</code> — Saved generations</li>
        <li><code>/videos</code> — Video pipelines (coming)</li>
        <li><code>/references</code> — Moodboard</li>
        <li><code>/prompts</code> — Prompt library</li>
        <li><code>/workflows</code> — Automation templates</li>
        <li><code>/settings</code> — Providers & keys</li>
      </ul>
    </div>
  );
}
