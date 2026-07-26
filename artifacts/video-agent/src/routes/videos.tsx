import { createFileRoute } from "@tanstack/react-router";
import { Film } from "lucide-react";

export const Route = createFileRoute("/videos")({
  head: () => ({
    meta: [
      { title: "Videos — AI Studio" },
      { name: "description", content: "Generated video projects." },
      { property: "og:title", content: "Videos — AI Studio" },
      { property: "og:description", content: "Generated video projects." },
    ],
  }),
  component: Videos,
});

function Videos() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <div className="glass rounded-2xl p-12 text-center">
        <Film className="mx-auto h-10 w-10 text-primary" />
        <h1 className="mt-4 text-2xl font-semibold">Video generation</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
          Coming next. Video pipelines (image-to-video, lip sync, motion control) will
          plug in here through the Lovable AI Gateway once you enable a video provider.
        </p>
      </div>
    </div>
  );
}
