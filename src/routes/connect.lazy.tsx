import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Asterisk, Check, Copy, KeyRound, Plug, MessageSquare, Star, Film, Heart, Play, TrendingUp, Music2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { track } from "@/lib/tracking";
import { McpConnector } from "@/components/landing/McpConnector";
import { ApiKeysPanel } from "@/components/dashboard/ApiKeysPanel";
import { SiteFooter } from "@/components/SiteFooter";
import avatarMaya from "@/assets/ugc/maya.jpg.asset.json";
import avatarLuna from "@/assets/ugc/luna.jpg.asset.json";
import avatarAva from "@/assets/ugc/ava.jpg.asset.json";
import avatarRio from "@/assets/ugc/rio.jpg.asset.json";
import avatarScarlet from "@/assets/ugc/scarlet.jpg.asset.json";
import avatarNova from "@/assets/ugc/nova.jpg.asset.json";
import ugcStreet from "@/assets/ugc/ugc-street-coffee.jpeg.asset.json";
import ugcMale from "@/assets/ugc/ugc-male-shades.jpeg.asset.json";

export const Route = createLazyFileRoute("/connect")({ component: ConnectPage });

const AVATAR_LIBRARY = [
  { name: "Maya", img: avatarMaya.url, status: "READY" as const },
  { name: "Luna", img: avatarLuna.url, status: "READY" as const },
  { name: "Ava", img: avatarAva.url, status: "READY" as const },
  { name: "Rio", img: avatarRio.url, status: "READY" as const },
  { name: "Scarlet", img: avatarScarlet.url, status: "TRAINING" as const },
  { name: "Nova", img: avatarNova.url, status: "READY" as const },
];

const SEEDANCE_CLIPS = [
  { handle: "maya", img: avatarMaya.url, caption: "Morning glow routine ☀️", dur: "8s", likes: "184K" },
  { handle: "sasha", img: ugcStreet.url, caption: "Coffee-run fit check ☕", dur: "6s", likes: "131K" },
  { handle: "luna", img: avatarLuna.url, caption: "Golden-hour unboxing ✨", dur: "10s", likes: "311K" },
  { handle: "marcus", img: ugcMale.url, caption: "New shades, who dis 😎", dur: "8s", likes: "98K" },
];

const SEEDANCE_STATS = [
  { label: "Clips rendered", value: "50" },
  { label: "Avg. render", value: "41s" },
  { label: "Watch-through", value: "78%" },
  { label: "Aura spent", value: "1,250" },
];

const SETUP = [
  {
    icon: <KeyRound className="size-4" />,
    title: "Get your API key",
    body: "Create a personal key below (or in your dashboard). Claude Desktop and Cursor authenticate with it via a Bearer token.",
  },
  {
    icon: <Plug className="size-4" />,
    title: "Add the connector",
    body: "In Claude Desktop or Cursor, add the Aurora server URL as a custom MCP server with an Authorization: Bearer <key> header. It registers all 13 Aurora tools instantly.",
  },
  {
    icon: <MessageSquare className="size-4" />,
    title: "Start creating in chat",
    body: "Ask for avatars by name, talking UGC ads, videos or a full campaign. Aurora queues the jobs and reports back with trackable IDs.",
  },
];

const FAQ = [
  {
    q: "Which clients can connect?",
    a: "Any MCP client that authenticates with a Bearer token — Claude Desktop and Cursor are the tested ones. Point them at the Aurora server URL and add an Authorization: Bearer <key> header. (claude.ai web custom connectors require an OAuth flow, which isn't enabled yet.)",
  },
  {
    q: "What can Claude do once connected?",
    a: "All 13 Aurora tools: list and create avatars, generate images and videos, image-to-video, bulk generate, produce talking UGC ads, spin up full campaigns, performance reskin, animate from a driving video, submit render jobs to the editor queue, and list, track or cancel jobs.",
  },
  {
    q: "How do talking UGC ads work over MCP?",
    a: "Name an avatar and describe the product — Aurora writes the script, voices it, generates a still, animates it, and lip-syncs, all async. You get a job ID to track. Voice and lip-sync apply when those models are configured; otherwise you get a silent animated clip.",
  },
  {
    q: "How do I authenticate?",
    a: "Create a personal aurk_ API key below and pass it as an Authorization: Bearer <key> header from your MCP client (Claude Desktop or Cursor). A Supabase session JWT works too. Keep your key secret — anyone with it can spend your credits.",
  },
];

function ConnectorMark({ className = "size-6" }: { className?: string }) {
  return (
    <span aria-hidden className="relative inline-grid place-items-center rounded-lg bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 shadow-lg shadow-orange-500/30 p-1.5 align-middle">
      <Asterisk className={`${className} text-white`} strokeWidth={2.5} />
    </span>
  );
}

function ConnectPage() {
  const { user } = useAuth();
  const [mcpUrl, setMcpUrl] = useState("https://your-domain/api/mcp");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMcpUrl(`${window.location.origin}/api/mcp`);
  }, []);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(mcpUrl);
      setCopied(true);
      void track("mcp_url_copy");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <main className="aurora-page-shell text-foreground">
      <div className="aurora-ambient" />
      {/* Header */}
      <header className="sticky top-0 z-20 aurora-hairline border-t-0 border-x-0 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 font-semibold text-foreground no-underline">
            <ConnectorMark className="size-4" /> Aurora
          </Link>
          <nav className="flex items-center gap-2 md:gap-3 text-sm">
            <Link to="/ugc" className="hidden sm:inline-flex rounded-full px-3 py-1.5 text-muted-foreground no-underline hover:bg-white/5 hover:text-foreground">UGC</Link>
            <Link to="/studio" className="hidden sm:inline-flex rounded-full px-3 py-1.5 text-muted-foreground no-underline hover:bg-white/5 hover:text-foreground">Studio</Link>
            {user ? (
              <Link to="/dashboard" className="rounded-full border border-border px-3 py-1.5 text-foreground/90 no-underline hover:bg-white/5">Dashboard</Link>
            ) : (
              <Link to="/auth" className="rounded-full border border-border px-3 py-1.5 text-foreground/90 no-underline hover:bg-white/5">Sign in</Link>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-70" style={{ background: "var(--gradient-stage)" }} />
        <div className="relative mx-auto max-w-6xl px-6 pt-16 pb-6 md:pt-24">
          <span className="aurora-kicker inline-flex items-center gap-2 rounded-full border border-orange-300/25 bg-orange-300/10 px-3 py-1 text-orange-200">
            MCP Connector · 5-minute setup
          </span>
          <h1 className="mt-5 max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
            Connect <ConnectorMark className="size-7 md:size-9" /> Claude to{" "}
            <span className="aurora-gradient-text">Aurora.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
            Generate avatar images, talking UGC ads, videos and full campaigns from a chat.
            Thirteen tools, one connection — Claude calls Aurora directly, no tab-switching.
          </p>

          {/* Social proof */}
          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {AVATAR_LIBRARY.slice(0, 4).map((a) => (
                  <img key={a.name} src={a.img} alt={a.name} className="size-8 rounded-full border-2 border-background object-cover" loading="lazy" />
                ))}
              </div>
              <span className="font-semibold text-foreground">400k+ creators</span>
              <span className="text-muted-foreground">building with Aurora</span>
            </div>
            <div className="flex items-center gap-1.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} className="size-4 fill-amber-300 text-amber-300" />
              ))}
              <span className="ml-1 font-semibold text-foreground">4.9</span>
              <span className="text-muted-foreground">average rating</span>
            </div>
          </div>

          <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Link
              to={user ? "/dashboard" : "/auth"}
              onClick={() => void track("connect_hero_cta")}
              className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-primary-foreground no-underline shadow-[var(--shadow-glow)] hover:opacity-90"
              style={{ background: "var(--gradient-hero)" }}
            >
              {user ? "Get your API key" : "Create your account"} <ArrowRight className="size-4" />
            </Link>
            <a href="#setup" className="aurora-glass inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-foreground no-underline hover:bg-white/10">
              See setup steps
            </a>
          </div>
        </div>
      </section>

      {/* Avatar library strip */}
      <section className="relative mx-auto max-w-6xl px-6 py-8">
        <h2 className="aurora-kicker">Your avatar library, callable by name</h2>
        <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
          {AVATAR_LIBRARY.map((a) => (
            <div key={a.name} className="relative overflow-hidden rounded-xl border border-border">
              <img src={a.img} alt={a.name} className="aspect-square w-full object-cover" loading="lazy" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-2">
                <p className="text-sm font-semibold leading-none text-white">{a.name}</p>
                <span className={`mt-1 inline-block text-[9px] font-semibold uppercase tracking-widest ${a.status === "READY" ? "text-emerald-400" : "text-amber-400"}`}>
                  {a.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Reusable connector showcase */}
      <McpConnector />

      {/* Seedance 2.0 × Claude */}
      <section className="relative mx-auto max-w-6xl px-6 py-12">
        <span className="aurora-kicker inline-flex items-center gap-2 rounded-full border border-orange-300/25 bg-orange-300/10 px-3 py-1 text-orange-200">
          <Film className="size-3.5" /> Seedance 2.0 × Claude
        </span>
        <h2 className="mt-5 max-w-3xl text-3xl font-extrabold leading-[1.05] tracking-tight md:text-5xl">
          Vertical video, rendered in a chat —{" "}
          <span className="aurora-gradient-text">straight to feed.</span>
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
          Ask Claude for a batch of TikToks — Aurora routes them through{" "}
          <strong className="text-foreground">Seedance 2.0</strong> at 9:16, lip-syncs the talent and
          hands back ready-to-post clips with the numbers baked in.
        </p>

        {/* TikTok-style vertical phone frames */}
        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {SEEDANCE_CLIPS.map((c) => (
            <div
              key={c.handle}
              className="group relative overflow-hidden rounded-[26px] border border-border bg-black/50 shadow-xl shadow-black/40"
            >
              <div className="absolute left-1/2 top-2 z-10 h-1.5 w-12 -translate-x-1/2 rounded-full bg-white/25" />
              <div className="relative aspect-[9/16]">
                <img src={c.img} alt={`@${c.handle}`} className="absolute inset-0 size-full object-cover" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/35" />
                <span className="absolute left-2 top-4 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-white/90 ring-1 ring-white/15 backdrop-blur">
                  Seedance 2.0 · 9:16 · {c.dur}
                </span>
                <span className="absolute inset-0 grid place-items-center">
                  <span className="grid size-11 place-items-center rounded-full bg-white/85 text-black shadow-lg transition group-hover:scale-105">
                    <Play className="ml-0.5 size-5 fill-black" />
                  </span>
                </span>
                <div className="absolute bottom-3 right-2 flex flex-col items-center gap-3 text-white">
                  <span className="flex flex-col items-center">
                    <Heart className="size-5 fill-white/90" />
                    <span className="text-[9px] font-semibold">{c.likes}</span>
                  </span>
                  <span className="flex flex-col items-center">
                    <MessageSquare className="size-5" />
                    <span className="text-[9px] font-semibold">2.1K</span>
                  </span>
                  <Music2 className="size-5" />
                </div>
                <div className="absolute inset-x-2 bottom-3 pr-10">
                  <p className="text-xs font-semibold leading-tight text-white drop-shadow">@{c.handle}</p>
                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-white/85">{c.caption}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Flow into results */}
        <div className="mt-6 flex items-center justify-center gap-2 text-muted-foreground">
          <span className="h-px w-12 bg-gradient-to-r from-transparent to-border" />
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em]">
            <TrendingUp className="size-3.5 text-emerald-400" /> Results roll in
          </span>
          <span className="h-px w-12 bg-gradient-to-l from-transparent to-border" />
        </div>

        {/* Analytics strip */}
        <div className="mt-6 grid grid-cols-2 gap-3 aurora-glass rounded-2xl p-4 sm:grid-cols-4 sm:p-5">
          {SEEDANCE_STATS.map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-black/30 px-4 py-3">
              <p className="text-2xl font-extrabold tracking-tight text-foreground">{s.value}</p>
              <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Setup */}
      <section id="setup" className="relative mx-auto max-w-6xl px-6 py-12">
        <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">Connect in three steps</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">From zero to generating in a chat in about five minutes.</p>

        <div className="mt-8 grid gap-3 md:grid-cols-3">
          {SETUP.map((s, i) => (
            <div key={s.title} className="aurora-card rounded-2xl p-5">
              <div className="flex items-center gap-2 text-orange-200/80">
                <span className="font-mono text-sm font-semibold">{String(i + 1).padStart(2, "0")}</span>
                {s.icon}
              </div>
              <h3 className="mt-3 text-base font-semibold text-foreground">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>

        {/* Connector URL + API keys */}
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="aurora-card rounded-2xl p-6">
            <h3 className="aurora-kicker">Server URL</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Add this URL as a custom MCP connector in your client:
            </p>
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-black/50 px-3 py-2.5">
              <code className="flex-1 truncate font-mono text-[13px] text-foreground/90">{mcpUrl}</code>
              <button
                onClick={copyUrl}
                className="aurora-glass inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-white/10"
              >
                {copied ? <><Check className="size-3.5" /> Copied</> : <><Copy className="size-3.5" /> Copy</>}
              </button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Pair this URL with an Authorization: Bearer &lt;key&gt; header in Claude Desktop or Cursor. (claude.ai web connectors need OAuth, which isn't enabled yet.)
            </p>
          </div>

          <div className="text-foreground">
            {user ? (
              <ApiKeysPanel />
            ) : (
              <div className="aurora-card rounded-2xl p-6">
                <h3 className="aurora-kicker">Personal API key</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Sign in to create a personal API key for Claude Desktop and Cursor.
                </p>
                <Link
                  to="/auth"
                  className="mt-4 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-primary-foreground no-underline hover:opacity-90"
                  style={{ background: "var(--gradient-hero)" }}
                >
                  Sign in to continue <ArrowRight className="size-4" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="relative mx-auto max-w-3xl px-6 py-12">
        <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">Connector FAQ</h2>
        <div className="mt-6 divide-y divide-border aurora-glass rounded-2xl">
          {FAQ.map((f) => (
            <details key={f.q} className="group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between text-base font-semibold text-foreground">
                {f.q}
                <ArrowRight className="size-4 text-muted-foreground transition group-open:rotate-90" />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <SiteFooter tone="dark" />
    </main>
  );
}
