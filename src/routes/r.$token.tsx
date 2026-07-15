import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { queryOptions } from "@tanstack/react-query";
import { getPublicShare } from "@/lib/share.functions";

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

export const Route = createFileRoute("/r/$token")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(shareQuery(params.token)),
  head: ({ loaderData }) => {
    const s = loaderData as
      | { prompt: string; result_image_url?: string | null; result_video_url?: string | null; author: string }
      | undefined;
    const title = s ? `${s.author} on Aurora — ${s.prompt.slice(0, 60)}` : "Aurora — shared render";
    const desc = s ? s.prompt.slice(0, 160) : "A cinematic render made in Aurora Studio.";
    const img = s?.result_image_url || undefined;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        ...(img ? [{ property: "og:image", content: img }, { name: "twitter:image", content: img }] : []),
        { name: "twitter:card", content: img ? "summary_large_image" : "summary" },
      ],
    };
  },
  errorComponent: ShareErrorComponent,
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center text-white bg-[#070612] px-6 text-center">
      <div>
        <h1 className="text-3xl font-bold mb-2">This render isn't public</h1>
        <p className="text-white/60 mb-6">The owner may have unpublished it.</p>
        <Link to="/" className="px-5 py-2.5 rounded-full bg-pink-400 text-pink-950 font-semibold no-underline">
          Explore Aurora →
        </Link>
      </div>
    </div>
  ),
});

function ShareErrorComponent({ reset }: { reset: () => void }) {
  const router = useRouter();
  return (
    <div className="min-h-screen flex items-center justify-center text-white bg-[#070612] px-6 text-center">
      <div>
        <h1 className="text-2xl font-bold mb-2">Couldn't load that render</h1>
        <p className="text-white/60 mb-6">It may have been unpublished, or the link is wrong.</p>
        <button
          className="px-5 py-2.5 rounded-full bg-pink-400 text-pink-950 font-semibold"
          onClick={() => {
            reset();
            router.invalidate();
          }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
