import { Link } from "@tanstack/react-router";
import { ArrowRight, Terminal, Sparkles, Wand2, Film, Mic } from "lucide-react";
import { AuroraTerminal } from "@/components/cli/AuroraTerminal";

const CAPABILITIES = [
  { icon: Sparkles, label: "Images", hint: "generate --prompt" },
  { icon: Film, label: "Video", hint: "video --prompt" },
  { icon: Mic, label: "Lip-sync", hint: "lipsync --audio" },
  { icon: Wand2, label: "Scripts & CI", hint: "pipe & automate" },
];

export function CliSection() {
  return (
    <section className="relative z-10 mx-4 md:mx-12 my-16 overflow-hidden rounded-[32px] border border-white/10 bg-[#06070d] animate-fade-in">
      {/* Layered aurora glow + faint grid for depth */}
      <div
        className="absolute inset-0 pointer-events-none opacity-50"
        style={{
          background:
            "radial-gradient(circle at 80% 8%, rgba(34,211,238,.22), transparent 36%), radial-gradient(circle at 12% 82%, rgba(168,85,247,.26), transparent 40%)",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          maskImage: "radial-gradient(circle at 70% 30%, black, transparent 75%)",
        }}
      />

      <div className="relative grid gap-10 px-6 py-14 md:grid-cols-[0.92fr_1.08fr] md:px-12 md:py-20 md:items-center">
        <div>
          <span className="inline-flex items-center gap-2 rounded-md border border-cyan-300/25 bg-cyan-300/[0.06] px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-cyan-200">
            <Terminal className="size-3.5" /> Aurora CLI · interactive
          </span>
          <h2 className="mt-5 text-3xl font-bold tracking-tight text-white md:text-5xl md:leading-[1.05]">
            The whole studio,{" "}
            <span className="bg-gradient-to-r from-cyan-200 via-white to-fuchsia-200 bg-clip-text text-transparent">
              from your terminal.
            </span>
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-white/68 md:text-lg">
            Render images, video and lip-sync without leaving the command line. Script it, pipe it,
            drop it into CI — same models, same Aura, zero clicks. Try{" "}
            <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-cyan-300">
              aurora generate --prompt "neon street"
            </code>{" "}
            in the live terminal.
          </p>

          <ul className="mt-7 grid grid-cols-2 gap-3 sm:max-w-md">
            {CAPABILITIES.map((c) => (
              <li
                key={c.label}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-cyan-300/10 text-cyan-200">
                  <c.icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-white">{c.label}</span>
                  <span className="block truncate text-[11px] text-white/45">
                    {c.hint}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/cli"
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-6 py-3 text-sm font-bold text-cyan-950 no-underline transition hover:opacity-95"
            >
              Explore the CLI <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/studio"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-semibold text-white no-underline transition hover:bg-white/[0.08]"
            >
              Open Performance Studio
            </Link>
          </div>
        </div>

        <AuroraTerminal />
      </div>
    </section>
  );
}
