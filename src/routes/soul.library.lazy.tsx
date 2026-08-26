import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Sparkles, Video as VideoIcon } from "lucide-react";
import { SoulShell } from "@/features/soul/soul-shell";
import { Button } from "@/components/ui/button";
import { listSouls, listSoulVideoJobs, type SoulVideoJobRow } from "@/lib/soul.functions";

export const Route = createLazyFileRoute("/soul/library")({
  component: () => (
    <SoulShell>
      <SoulLibraryPage />
    </SoulShell>
  ),
});

function SoulLibraryPage() {
  const listSoulsFn = useServerFn(listSouls);
  const listJobsFn = useServerFn(listSoulVideoJobs);

  const { data: souls = [], isLoading: soulsLoading } = useQuery({ queryKey: ["souls"], queryFn: () => listSoulsFn() });
  const { data: jobs = [], isLoading: jobsLoading } = useQuery<SoulVideoJobRow[]>({
    queryKey: ["soul-video-jobs"],
    queryFn: () => listJobsFn({ data: {} }),
  });

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-white">
          <Sparkles className="size-4" /> Souls
        </h2>
        {soulsLoading ? (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        ) : souls.length === 0 ? (
          <p className="text-sm text-muted-foreground">No souls trained yet.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3">
            {souls.map((s) => (
              <li key={s.id} className="rounded-xl border border-[color:var(--border-strong)] p-3">
                <p className="truncate font-medium text-white">{s.name}</p>
                <p className="text-xs text-muted-foreground">{s.status}</p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Generated images also appear in your regular Studio history.
        </p>
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-white">
          <VideoIcon className="size-4" /> Videos
        </h2>
        {jobsLoading ? (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        ) : jobs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[color:var(--border-strong)] p-6 text-center">
            <p className="mb-3 text-sm text-muted-foreground">No videos generated yet.</p>
            <Button asChild variant="premium" size="sm">
              <Link to="/soul/generate/video">Generate a video</Link>
            </Button>
          </div>
        ) : (
          <ul className="space-y-3">
            {jobs.map((job) => (
              <li key={job.id} className="rounded-xl border border-[color:var(--border-strong)] p-3">
                <p className="mb-1 truncate text-sm text-white">{job.prompt}</p>
                <p className="mb-2 text-xs text-muted-foreground">
                  {job.status} · {job.duration_secs}s · {job.aspect_ratio}
                </p>
                {job.status === "completed" && job.result_url && (
                  <video src={job.result_url} controls playsInline className="w-full rounded-lg" />
                )}
                {job.status === "failed" && job.error_message && (
                  <p className="text-xs text-destructive">{job.error_message}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
