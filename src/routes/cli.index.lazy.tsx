import { createLazyFileRoute, Link } from "@tanstack/react-router";
import {
  Terminal,
  ArrowRight,
  Sparkles,
  Film,
  Mic,
  KeyRound,
  ScrollText,
  Copy,
  Check,
} from "lucide-react";
import { useState } from "react";
import { AuroraTerminal } from "@/components/cli/AuroraTerminal";
import { SiteFooter } from "@/components/SiteFooter";

export const Route = createLazyFileRoute("/cli/")({
  component: CliPage,
});

type Cmd = { cmd: string; desc: string; cost?: string };

const COMMANDS: Cmd[] = [
  { cmd: "aurora login", desc: "Start the device-code sign-in flow and link the CLI to your account." },
  { cmd: "aurora whoami", desc: "Show the signed-in account, current plan and remaining Aura." },
  { cmd: 'aurora generate --prompt "neon street" --out shot.png', desc: "Render a still image with Nano Banana Pro and save it to disk.", cost: "10 Aura" },
  { cmd: 'aurora video --prompt "slow dolly through fog"', desc: "Generate a 5-second cinematic clip with Seedance 2.0.", cost: "100 Aura" },
  { cmd: "aurora lipsync --audio vo.mp3 --image face.png", desc: "Align an audio track to mouth shapes with Sync 1.9.", cost: "60 Aura" },
  { cmd: "aurora help", desc: "List every command and its flags." },
];

const CAPS = [
  { icon: Sparkles, label: "Images", hint: "Nano Banana Pro · Seedream 4.5" },
  { icon: Film, label: "Video", hint: "Seedance 2.0 · Kling 3.0" },
  { icon: Mic, label: "Lip-sync", hint: "Sync 1.9" },
];

const STEPS = [
  {
    icon: Terminal,
    title: "Run aurora login",
    body: "In your terminal, run aurora login. The CLI prints a short device code and a link to this site.",
  },
  {
    icon: KeyRound,
    title: "Authorize the device",
    body: "Open the authorize page, sign in, and enter the device code shown in your terminal to grant access.",
  },
  {
    icon: Check,
    title: "Start rendering",
    body: "Return to your terminal — you're signed in. Every command spends from the same Aura balance as the web app.",
  },
];

function CliPage() {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (text: string) => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(text);
      setTimeout(() => setCopied((c) => (c === text ? null : c)), 1600);
    });
  };

  return (
    <main className="min-h-screen relative overflow-hidden bg-background text-foreground pb-28 md:pb-24">
      <div
        className="pointer-events-none absolute -top-40 -right-40 size-[640px] rounded-full blur-3xl opacity-50"
        style={{ background: "radial-gradient(circle, rgba(34,211,238,0.4), transparent 60%)" }}
      />
      <div
        className="pointer-events-none absolute top-1/3 -left-40 size-[520px] rounded-full blur-3xl opacity-40"
        style={{ background: "radial-gradient(circle, hsl(290 80% 55% / 0.5), transparent 60%)" }}
      />

      <header className="phone-fixed-x fixed top-0 z-40 w-full bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="flex items-center justify-between pl-24 pr-6 md:px-12 py-4">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight no-underline">
            <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20"><span className="inline-block size-2.5 rounded-full bg-primary" /></span>
            <span className="text-foreground">Aurora</span>
          </Link>
          <Link
            to="/studio"
            className="inline-flex items-center gap-1.5 rounded-full bg-cyan-300 px-4 py-1.5 text-sm font-bold text-cyan-950 no-underline hover:opacity-95"
          >
            Open Studio <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-6xl px-5 pt-28 md:px-8 md:pt-36">
        <div className="text-center">
          <span className="aurora-kicker inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/[0.06] px-3 py-1 text-cyan-200">
            <Terminal className="size-3.5" /> Aurora CLI
          </span>
          <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-bold tracking-tight md:text-6xl md:leading-[1.05]">
            The whole studio,{" "}
            <span className="bg-gradient-to-r from-cyan-200 via-white to-orange-200 bg-clip-text text-transparent">
              from your terminal.
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
            Render images, video and lip-sync without leaving the command line. Script it, pipe it,
            drop it into CI — the same models and the same Aura balance as the web app.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-2">
            {CAPS.map((c) => (
              <span
                key={c.label}
                className="aurora-glass inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm text-foreground/80"
              >
                <c.icon className="size-4 text-cyan-200" />
                <span className="font-semibold text-foreground">{c.label}</span>
                <span className="hidden text-muted-foreground sm:inline">· {c.hint}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="mt-12">
          <AuroraTerminal heightClass="h-[420px] md:h-[520px]" title="aurora-cli — interactive" />
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Live sandbox — type a command and press Enter. Use ↑ / ↓ for history, <code>clear</code> to reset.
          </p>
        </div>

        <section className="mt-20">
          <div className="flex items-center gap-2.5">
            <ScrollText className="size-5 text-cyan-200" />
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Command reference</h2>
          </div>
          <p className="mt-2 text-muted-foreground">Every command spends from your Aura balance. Hover a row to copy it.</p>
          <div className="mt-6 overflow-hidden rounded-2xl aurora-glass">
            {COMMANDS.map((c, i) => (
              <div
                key={c.cmd}
                className={`group flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:gap-5 ${i !== 0 ? "border-t border-border" : ""}`}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <code className="truncate text-sm text-cyan-200">{c.cmd}</code>
                  <button
                    type="button"
                    onClick={() => copy(c.cmd)}
                    aria-label={`Copy ${c.cmd}`}
                    className="shrink-0 rounded-md p-1 text-muted-foreground transition hover:bg-white/10 hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    {copied === c.cmd ? (
                      <Check className="size-3.5 text-emerald-300" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </button>
                </div>
                <p className="flex-1 text-sm text-muted-foreground">{c.desc}</p>
                {c.cost && (
                  <span className="w-fit shrink-0 rounded-full bg-cyan-300/10 px-2.5 py-1 text-xs font-semibold text-cyan-200">
                    {c.cost}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="mt-20">
          <div className="flex items-center gap-2.5">
            <KeyRound className="size-5 text-cyan-200" />
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Sign in from the CLI</h2>
          </div>
          <p className="mt-2 text-muted-foreground">
            The CLI uses a secure device-code flow — no API keys to paste, no secrets in your shell history.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.title} className="aurora-card rounded-2xl p-5">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-cyan-300/10 text-cyan-200">
                    <s.icon className="size-4.5" />
                  </span>
                  <span className="text-xs text-muted-foreground">Step {i + 1}</span>
                </div>
                <h3 className="mt-4 font-semibold text-foreground">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              to="/cli/authorize"
              className="inline-flex items-center gap-2 rounded-full bg-cyan-300 px-6 py-3 text-sm font-bold text-cyan-950 no-underline transition hover:opacity-95"
            >
              Authorize a device <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/connect"
              className="aurora-glass inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-foreground no-underline transition hover:bg-white/[0.08]"
            >
              Prefer Claude? Connect via MCP
            </Link>
          </div>
        </section>
      </div>

      <div className="mt-24">
        <SiteFooter />
      </div>
    </main>
  );
}
