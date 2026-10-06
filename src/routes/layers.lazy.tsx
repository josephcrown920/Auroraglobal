import { createLazyFileRoute } from "@tanstack/react-router";
import { Layers3 } from "lucide-react";
import { AuroraLayersEmbed } from "@/components/layers/AuroraLayersEmbed";

export const Route = createLazyFileRoute("/layers")({ component: LayersPage });

function LayersPage() {
  return (
    <main className="min-h-[100dvh] bg-background text-foreground">
      <div className="mx-auto w-full max-w-[1800px] px-3 py-4 sm:px-5 lg:px-8 lg:py-6">
        <header className="mb-4 flex items-center gap-3 px-1">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
            <Layers3 className="size-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight">Aurora Layers</h1>
            <p className="text-xs text-muted-foreground">
              Non-destructive layers, compositing and creative editing inside Aurora.
            </p>
          </div>
        </header>
        <AuroraLayersEmbed />
      </div>
    </main>
  );
}
