import { Link } from "@tanstack/react-router";
import { Asterisk, ArrowRight, Check, Sparkles, Layers, Clapperboard, Users } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { track } from "@/lib/tracking";

/** Gradient placeholder tiles for the chat mockups (kept on-brand, no stock photos). */
const GRID_TILES = [
  "from-rose-500 to-pink-600",
  "from-fuchsia-500 to-purple-600",
  "from-violet-500 to-indigo-600",
  "from-sky-500 to-blue-600",
  "from-pink-400 to-rose-500",
  "from-purple-500 to-fuchsia-600",
  "from-indigo-500 to-violet-600",
  "from-fuchsia-400 to-pink-500",
] as const;

const STEPS = [
  {
    n: "01",
    icon: <Users className="size-4" />,
    title: "Talk to your avatars by name",
    body: "Lily, Aria, Maya — Claude knows which trained LoRA to use and never breaks character.",
  },
  {
    n: "02",
    icon: <Layers className="size-4" />,
    title: "Batch-generate up to 50 at a time",
    body: "One prompt. One coffee. A week of content rendered while you focus on shipping.",
  },
  {
    n: "03",
    icon: <Clapperboard className="size-4" />,
    title: "Spin up videos without leaving the chat",
    body: "Bring stills to life with Kling, Veo and Sora — Claude routes the right model automatically.",
  },
];

function ConnectorMark({ className = "size-6" }: { className?: string }) {
  return (
    <span aria-hidden className="relative inline-grid place-items-center rounded-lg bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 shadow-lg shadow-orange-500/30 p-1.5 align-middle">
      <Asterisk className={`${className} text-white`} strokeWidth={2.5} />
    </span>
  );
}

function WindowChrome({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
      <span className="flex items-center gap-2" aria-hidden>
        <span className="size-2.5 rounded-full bg-white/15" />
        <span className="size-2.5 rounded-full bg-white/15" />
        <span className="size-2.5 rounded-full bg-white/15" />
      </span>
      <span className="ml-auto text-[10px] font-semibold uppercase tracking-[0.25em] text-white/40">
        {label}
      </span>
    </div>
  );
}

function UserBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-md border border-white/10 bg-white/[0.06] px-4 py-3 text-sm leading-relaxed text-white/90">
        {children}
      </div>
    </div>
  );
}

function AssistantLine({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <ConnectorMark className="size-4" />
      <div className="flex-1 text-sm leading-relaxed text-white/80">{children}</div>
    </div>
  );
}

export function McpConnector() {
  const { user } = useAuth();
  const connectTo = user ? "/dashboard" : "/auth";

  return (
    <section
      id="mcp"
      className="relative z-10 mx-4 md:mx-12 my-16 overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-[#160a22] via-[#0d0820] to-[#06070d]"
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-60"
        style={{
          background:
            "radial-gradient(circle at 85% -10%, rgba(249,115,22,.20), transparent 42%), radial-gradient(circle at 0% 110%, rgba(168,85,247,.28), transparent 45%)",
        }}
      />

      <div className="relative px-6 py-14 md:px-12 md:py-20">
        {/* Heading */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-orange-300/25 bg-orange-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-orange-200">
            <Sparkles className="size-3.5" /> MCP Connector · Growth & Creator
          </span>
        </div>

        <h2 className="mt-5 max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tight text-white md:text-6xl">
          Turn <ConnectorMark className="size-7 md:size-9" /> Claude into your{" "}
          <span className="bg-gradient-to-r from-amber-300 via-fuchsia-300 to-violet-300 bg-clip-text text-transparent">
            creative engine.
          </span>
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-white/72 md:text-lg">
          Connect Aurora to Claude and generate avatar images, videos, talking UGC
          ads and full campaigns right from your conversations. <strong className="text-white">10 tools, one
          connection</strong> — manage avatars, generate, edit and automate, all from a chat.
        </p>

        {/* Primary chat mockup — bulk generation */}
        <div className="mt-10 overflow-hidden rounded-3xl border border-white/10 bg-black/50 backdrop-blur">
          <WindowChrome label="Claude · Aurora Connector" />
          <div className="space-y-4 p-5 md:p-6">
            <UserBubble>
              Generate 8 IG-ready photos of <strong className="text-white">Lily</strong> for this week
              — vary the outfits, moods and lighting. Mix indoor and outdoor. 4:5 portrait.
            </UserBubble>
            <AssistantLine>
              On it. Generating 8 portraits of Lily — mixing café, rooftop and golden-hour
              outdoor scenes.
            </AssistantLine>
            <div className="grid grid-cols-4 gap-2">
              {GRID_TILES.map((g, i) => (
                <div
                  key={i}
                  className="relative aspect-[4/5] overflow-hidden rounded-xl border border-white/10"
                  style={{ animationDelay: `${i * 90}ms` }}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${g}`} />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_60%)]" />
                  <span className="absolute right-1.5 top-1.5 grid size-4 place-items-center rounded-full bg-black/50 text-white">
                    <Check className="size-2.5" />
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/45">
              8 images · 60 credits · ~38s
            </p>
          </div>
        </div>

        {/* Numbered steps */}
        <div className="mt-8 grid gap-3 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center gap-2 text-orange-200/80">
                <span className="font-mono text-sm font-semibold">{s.n}</span>
                {s.icon}
              </div>
              <h3 className="mt-3 text-base font-semibold text-white">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-white/65">{s.body}</p>
            </div>
          ))}
        </div>

        {/* Secondary mockups — avatar library + image to video */}
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {/* Avatar library */}
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
            <WindowChrome label="Claude · Aurora" />
            <div className="space-y-3 p-5">
              <UserBubble>List my avatars</UserBubble>
              <AssistantLine>You have 4 avatars:</AssistantLine>
              <div className="space-y-2">
                {[
                  { name: "Lily", status: "READY" },
                  { name: "Aria", status: "READY" },
                  { name: "Noa", status: "TRAINING" },
                  { name: "Maya", status: "READY" },
                ].map((a, i) => (
                  <div
                    key={a.name}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`size-7 rounded-full bg-gradient-to-br ${GRID_TILES[i % GRID_TILES.length]}`}
                      />
                      <span className="text-sm font-medium text-white">{a.name}</span>
                    </div>
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-widest ${
                        a.status === "READY" ? "text-emerald-400" : "text-amber-400"
                      }`}
                    >
                      {a.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Image to video */}
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
            <WindowChrome label="Claude · Aurora" />
            <div className="space-y-3 p-5">
              <UserBubble>
                Make a 5s video of this image — slow zoom in, cinematic. Use Kling 2.5 turbo.
              </UserBubble>
              <AssistantLine>
                <span className="inline-flex items-center gap-1.5">
                  Running
                  <code className="rounded bg-fuchsia-500/15 px-1.5 py-0.5 font-mono text-[12px] text-fuchsia-200">
                    kling-2.5-turbo
                  </code>
                  · 5s · 9:16
                </span>
              </AssistantLine>
              <div className="relative aspect-video overflow-hidden rounded-xl border border-white/10">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-fuchsia-600 to-rose-600" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(255,255,255,0.3),transparent_55%)]" />
                <span className="absolute inset-0 grid place-items-center">
                  <span className="grid size-12 place-items-center rounded-full bg-white/85 text-black shadow-lg">
                    <span className="ml-0.5 size-0 border-y-[8px] border-l-[13px] border-y-transparent border-l-black" />
                  </span>
                </span>
                <span className="absolute bottom-2 right-2 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-white/90">
                  00:05
                </span>
              </div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-400/80">
                ✓ 50 credits
              </p>
            </div>
          </div>
        </div>

        {/* How it works */}
        <div
          id="mcp-how"
          className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:p-6"
        >
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-300/80">
            How the Claude connector works
          </h3>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/70">
            Aurora runs a Model Context Protocol (MCP) server at{" "}
            <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[12px] text-white/90">
              /api/mcp
            </code>{" "}
            on your account domain. On claude.ai you add it as a custom connector and approve a
            one-click consent prompt — no API keys to paste. Claude Desktop, Cursor and other MCP
            clients can use the same URL plus a personal API key. Once connected, the assistant can
            list your avatars, generate images and videos, produce talking UGC ads, spin up full
            campaigns, edit existing assets, and check your credit balance from a normal chat.
          </p>
        </div>

        {/* CTA */}
        <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <Link
            to={connectTo}
            onClick={() => void track("mcp_connect_click")}
            className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-black no-underline shadow-lg shadow-white/10 hover:opacity-90"
          >
            Connect Claude <ArrowRight className="size-4" />
          </Link>
          <a
            href="#mcp-how"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white no-underline hover:bg-white/10"
          >
            See how it works
          </a>
        </div>
        <p className="mt-4 text-xs text-white/45">
          Available on Growth and Creator plans · 5-minute setup · Works with Claude Desktop,
          claude.ai &amp; Cursor
        </p>
      </div>
    </section>
  );
}
