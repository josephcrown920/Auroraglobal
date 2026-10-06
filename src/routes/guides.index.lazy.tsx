import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listPublishedGuidedWorkflows } from "@/lib/guided-workflows.functions";
import {
  CATEGORY_LABELS,
  WORKFLOW_CATEGORIES,
  type GuidedWorkflowCategory,
} from "@/lib/guided-workflows.schema";
import { BookOpen, Loader2, ArrowRight, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createLazyFileRoute("/guides/")({
  component: GuidesGallery,
});

function GuidesGallery() {
  const listFn = useServerFn(listPublishedGuidedWorkflows);
  const { data, isLoading, error } = useQuery({
    queryKey: ["guided-workflows"],
    queryFn: () => listFn(),
    staleTime: 5 * 60_000,
  });

  const [category, setCategory] = useState<GuidedWorkflowCategory | "all">("all");

  const workflows = data?.workflows ?? [];
  const presentCategories = useMemo(
    () => WORKFLOW_CATEGORIES.filter((c) => workflows.some((w) => w.category === c)),
    [workflows],
  );
  const visible =
    category === "all" ? workflows : workflows.filter((w) => w.category === category);

  return (
    <div className="aurora-page-shell text-foreground">
      <span aria-hidden className="aurora-ambient" />
      <div className="relative z-10 mx-auto w-full max-w-5xl px-4 pb-24 pt-10">
        <header className="mb-8">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
            <BookOpen className="size-3.5" />
            Playbooks
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Viral Guides</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Step-by-step playbooks distilled from viral AI music videos. Pick one, follow the
            steps, and generate every shot without leaving Aurora.
          </p>
        </header>

        {presentCategories.length > 1 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {(["all", ...presentCategories] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                  category === c
                    ? "border-primary/60 bg-primary/15 text-primary"
                    : "border-border bg-card/40 text-muted-foreground hover:border-primary/40",
                )}
              >
                {c === "all" ? "All" : CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Couldn't load the guides"}
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
            No guides published yet — check back soon.
          </div>
        ) : (
          <div className="grid gap-4">
            {visible.map((w) => (
              <Link
                key={w.slug}
                to="/guides/$slug"
                params={{ slug: w.slug }}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card/40 p-5 transition-colors hover:border-primary/50"
              >
                <div className="flex items-start gap-4">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border bg-background/60 text-2xl">
                    {w.icon || "🎬"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold leading-tight">{w.title}</h2>
                      <span className="rounded-full border border-border bg-background/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        {CATEGORY_LABELS[w.category]}
                      </span>
                    </div>
                    {w.tagline && (
                      <p className="mt-1 text-sm text-muted-foreground">{w.tagline}</p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Layers className="size-3" />
                        {w.steps.length} step{w.steps.length === 1 ? "" : "s"}
                      </span>
                      {w.sourceCredit && <span>Based on: {w.sourceCredit}</span>}
                    </div>
                  </div>
                  <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
