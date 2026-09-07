import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Check } from "lucide-react";
import { useFeatureVisibility } from "@/components/FeatureVisibilityProvider";
import { featureKeyForRoute } from "@/lib/feature-visibility";
import { TOOL_DIRECTORY } from "@/lib/tool-directory";

export function ToolDirectorySection() {
  const { showFeature } = useFeatureVisibility();
  const toolDirectory = TOOL_DIRECTORY.filter((t) => showFeature(featureKeyForRoute(t.to)));

  return (
    <section className="border-b border-white/8 bg-[#0a0910] px-5 py-16 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.34em] text-violet-300">Every Aurora tool</span>
            <h2 className="mt-4 max-w-3xl text-[clamp(2.75rem,8vw,6.5rem)] font-black uppercase leading-[0.83] tracking-[-0.055em] text-zinc-100">
              Create<br />
              <span className="text-transparent [-webkit-text-stroke:1px_rgba(255,255,255,0.56)]">something</span><br />
              new.
            </h2>
          </div>
          <p className="max-w-[30ch] text-sm leading-relaxed text-zinc-500 sm:text-right">
            One balance across every tool. Prices below use Aurora&apos;s live Aura economy.
          </p>
        </div>

        <div className="border-t border-white/10">
          {toolDirectory.map((tool) => (
            <Link
              key={tool.name}
              to={tool.to}
              className="group grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-white/10 py-4 no-underline transition-colors hover:bg-white/[0.035] sm:grid-cols-[3rem_minmax(0,1fr)_auto_auto_auto]"
            >
              <span className="text-xs font-semibold tabular-nums text-zinc-600">{tool.number}</span>
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="text-lg font-black uppercase tracking-tight text-zinc-100 transition-colors group-hover:text-violet-300 sm:text-2xl">{tool.name}</span>
                {tool.label && <span className="hidden rounded-sm bg-violet-400/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.13em] text-violet-200 ring-1 ring-violet-300/25 sm:inline-flex">{tool.label}</span>}
              </div>
              <span className="hidden text-right text-xs text-zinc-500 sm:block">{tool.description}</span>
              <span className="rounded-full bg-white/[0.07] px-2.5 py-1 text-[10px] font-bold tabular-nums text-zinc-300 ring-1 ring-white/10">{tool.price}</span>
              <ArrowUpRight className="size-4 text-zinc-600 transition-colors group-hover:text-violet-300" />
            </Link>
          ))}
        </div>
        <div className="mt-6 flex items-center justify-between gap-4 text-xs text-zinc-500">
          <span>Plans and Aura top-ups available anytime</span>
          <Link to="/tools" className="font-semibold text-violet-300 hover:text-white">Explore all tools →</Link>
        </div>
      </div>
    </section>
  );
}
