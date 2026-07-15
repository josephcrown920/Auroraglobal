import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { notFound } from "@tanstack/react-router";
import { ArrowLeft, Download, Sparkles } from "lucide-react";
import { getPublicShare } from "@/lib/share.functions";

export const Route = createLazyFileRoute("/r/$token")({
  component: SharePage,
});

const shareQuery = (token: string) =>
  queryOptions({
    queryKey: ["public-share", token],
    queryFn: async () => {
      const res = await getPublicShare({ data: { token } });
      if (!res.found) throw notFound();
      return res.share;
    },
    staleTime: 60_000,
  });

function SharePage() {
  const { token } = Route.useParams();
  const { data: s } = useSuspenseQuery(shareQuery(token));
  const isVideo = !!s.result_video_url;
  const mediaUrl = s.result_video_url || s.result_image_url || "";

  return (
    <div className="min-h-screen text-white" style={{ background: "radial-gradient(circle at 30% 0%, #1a0d3a 0%, #0a0717 60%, #050410 100%)" }}>
      <header className="px-6 py-4 flex items-center justify-between border-b border-white/10">
        <Link to="/" className="inline-flex items-center gap-2 text-white/70 hover:text-white no-underline text-sm">
          <ArrowLeft className="size-4" /> Aurora
        </Link>
        <Link
          to="/studio"
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2 text-sm font-bold no-underline text-white"
        >
          <Sparkles className="size-4" /> Make your own
        </Link>
      </header>

      <main className="max-w-4xl mx-auto px-4 md:px-8 py-10">
        <div className="rounded-3xl overflow-hidden border border-white/10 bg-black/40">
          {isVideo ? (
            <video src={mediaUrl} controls playsInline className="w-full h-auto" />
          ) : (
            <img src={mediaUrl} alt={s.prompt} className="w-full h-auto" />
          )}
        </div>

        <div className="mt-6 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-pink-200/80">Shared by {s.author}</p>
            <p className="mt-2 text-white/85 max-w-2xl leading-relaxed">{s.prompt}</p>
            {s.model && (
              <p className="mt-2 text-xs text-white/50">Rendered with {s.model}</p>
            )}
          </div>
          <a
            href={mediaUrl}
            target="_blank"
            rel="noopener"
            download
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium no-underline text-white hover:bg-white/10"
          >
            <Download className="size-4" /> Download
          </a>
        </div>

        <div className="mt-10 rounded-2xl border border-pink-300/30 bg-pink-500/10 p-5 text-sm text-pink-100">
          Built in <Link to="/studio" className="underline">Aurora Studio</Link> in under 60 seconds — drop a selfie, pick a vibe, get a singing cinematic shot.
        </div>
      </main>
    </div>
  );
}
