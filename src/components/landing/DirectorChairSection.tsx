import { Suspense, lazy } from "react";
import { Link } from "@tanstack/react-router";
import { Play } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const FeaturedArtist = lazy(() =>
  import("@/components/landing/FeaturedArtist").then((m) => ({ default: m.FeaturedArtist })),
);

export function DirectorChairSection() {
  const { user } = useAuth();
  const ctaTo = user ? "/studio" : "/auth";

  return (
    <>
      <Suspense fallback={null}><FeaturedArtist /></Suspense>

      <section className="py-20 px-5 border-b border-white/5">
        <span className="text-xs font-bold uppercase tracking-[0.3em] text-[#8b5cf6]">
          The director&apos;s chair
        </span>
        <h2 className="mt-3 text-4xl font-semibold leading-tight mb-5">
          Most musicians never get to
          <br />
          <span className="bg-gradient-to-r from-violet-200 via-violet-400 to-fuchsia-300 bg-clip-text font-sans font-semibold text-transparent">direct their own music video.</span>
        </h2>
        <p className="text-zinc-400 text-base leading-relaxed max-w-[38ch] mb-8">
          With Aurora they step into the director&apos;s chair, choose Hollywood-grade cinematic looks, and shape unlimited endings. Because artists deserve the ending they want.
        </p>
        <Link
          to={ctaTo}
          className="inline-flex items-center gap-2 rounded-full bg-white/8 ring-1 ring-white/15 px-5 py-3 text-sm font-semibold text-zinc-200 transition-colors hover:bg-white/12 no-underline"
        >
          <Play className="size-4 fill-current" />
          Start directing
        </Link>
      </section>
    </>
  );
}
