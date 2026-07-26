import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, KeyRound } from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — AI Studio" },
      { name: "description", content: "Manage providers, keys, and preferences." },
      { property: "og:title", content: "Settings — AI Studio" },
      { property: "og:description", content: "Manage providers, keys, and preferences." },
    ],
  }),
  component: Settings,
});

const providers = [
  { name: "Lovable AI Gateway", status: "Ready", note: "OpenAI + Google (Gemini) built in." },
  { name: "OpenAI", status: "Via Gateway", note: "GPT-5.x, gpt-image-2." },
  { name: "Google Gemini", status: "Via Gateway", note: "Gemini 3 Pro Image, Nano Banana 2." },
  { name: "Claude", status: "Not configured", note: "Add ANTHROPIC_API_KEY to enable." },
  { name: "Fal.ai", status: "Not configured", note: "Add FAL_KEY." },
  { name: "Replicate", status: "Not configured", note: "Add REPLICATE_API_TOKEN." },
  { name: "Runware", status: "Not configured", note: "Add RUNWARE_API_KEY." },
  { name: "Kling / Minimax / Luma / Veo", status: "Not configured", note: "Provider keys required." },
];

function Settings() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Providers and API keys. Lovable manages secrets — never hardcode.
        </p>
      </header>

      <div className="glass rounded-2xl divide-y divide-border/40">
        {providers.map((p) => (
          <div key={p.name} className="flex items-center gap-4 p-4">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary/30 to-primary-glow/20 border border-primary/30 flex items-center justify-center">
              <KeyRound className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium">{p.name}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{p.note}</div>
            </div>
            <div
              className={
                "text-xs px-2 py-1 rounded-md " +
                (p.status === "Ready" || p.status === "Via Gateway"
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "bg-muted text-muted-foreground border border-border")
              }
            >
              {p.status === "Ready" && (
                <CheckCircle2 className="inline h-3 w-3 mr-1" />
              )}
              {p.status}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        To add third-party providers, request the key be added as a secret and wire an
        adapter under <code className="text-foreground">src/lib/providers/</code>.
      </p>
    </div>
  );
}
