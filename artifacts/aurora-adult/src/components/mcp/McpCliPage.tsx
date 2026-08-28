// Eromify-style "Connect" page — real /api/mcp server, MCP/CLI/Skill tabs,
// app picker, and a live "test connection" call using the creator's own
// session bearer (same Supabase project as the main app, verified server-side).
import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import { ArrowLeft, Check, Copy, Loader2, Sparkles, Terminal, Wrench } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Props {
  user: User;
  onBack: () => void;
}

type Tab = "mcp" | "cli" | "skill";
type AppId = "claude" | "cursor" | "openclaw" | "hermes";

const APPS: { id: AppId; label: string }[] = [
  { id: "claude", label: "Claude Desktop" },
  { id: "cursor", label: "Cursor" },
  { id: "openclaw", label: "OpenClaw" },
  { id: "hermes", label: "Hermes" },
];

function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-white/35">{label}</label>
      <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
        <code className="flex-1 truncate text-[11px] text-white/80">{value}</code>
        <button
          onClick={() => {
            navigator.clipboard.writeText(value).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="text-white/40 hover:text-white"
        >
          {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
        </button>
      </div>
    </div>
  );
}

export function McpCliPage({ user, onBack }: Props) {
  const [tab, setTab] = useState<Tab>("mcp");
  const [app, setApp] = useState<AppId>("claude");
  const [testState, setTestState] = useState<"idle" | "testing" | "ok" | "error">("idle");
  const [toolCount, setToolCount] = useState<number | null>(null);

  const origin = window.location.origin;
  const connectorUrl = `${origin}/api/mcp`;
  const cliInstall = `npx mcp-remote ${connectorUrl}`;

  const appConfig: Record<AppId, string> = {
    claude: `{
  "mcpServers": {
    "aurora-adult-school": {
      "command": "npx",
      "args": ["mcp-remote", "${connectorUrl}", "--header", "Authorization:Bearer YOUR_AURORA_API_KEY"]
    }
  }
}`,
    cursor: `{
  "mcpServers": {
    "aurora-adult-school": {
      "url": "${connectorUrl}",
      "headers": { "Authorization": "Bearer YOUR_AURORA_API_KEY" }
    }
  }
}`,
    openclaw: `mcp add aurora-adult-school --url ${connectorUrl} --header "Authorization: Bearer YOUR_AURORA_API_KEY"`,
    hermes: `hermes connect --mcp ${connectorUrl} --token YOUR_AURORA_API_KEY`,
  };

  async function testConnection() {
    setTestState("testing");
    try {
      const { data } = await supabase.auth.getSession();
      const bearer = data.session?.access_token;
      if (!bearer) throw new Error("no session");
      const res = await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      });
      const body = await res.json();
      const tools = body?.result?.tools;
      if (!res.ok || !Array.isArray(tools)) throw new Error("bad response");
      setToolCount(tools.length);
      setTestState("ok");
    } catch {
      setTestState("error");
    }
  }

  return (
    <div className="min-h-screen bg-[#050207] text-white">
      <header className="sticky top-0 z-20 flex h-12 items-center gap-3 border-b border-white/6 bg-[#050207]/90 px-5 backdrop-blur-xl">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white">
          <ArrowLeft size={12} /> Back
        </button>
        <span className="text-[13px] font-bold">Connect</span>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-14">
        {/* Hero */}
        <div className="mb-10 text-center">
          <p className="er-eyebrow mb-3">Model Context Protocol</p>
          <h1 className="er-display text-3xl sm:text-4xl">
            Generate from <span className="er-gradient-text">anywhere</span>
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-[13px] text-white/45">
            Adult School runs a real MCP server. Connect Claude, Cursor, or any MCP-aware
            client and generate identity-locked shots without opening the browser.
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex justify-center gap-1 rounded-full border border-white/8 bg-white/[0.02] p-1">
          {([
            { id: "mcp" as Tab, label: "MCP", icon: Sparkles },
            { id: "cli" as Tab, label: "CLI", icon: Terminal },
            { id: "skill" as Tab, label: "Skill", icon: Wrench },
          ]).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[11px] font-bold transition-colors ${
                tab === t.id ? "bg-white text-black" : "text-white/50 hover:text-white"
              }`}
            >
              <t.icon size={11} /> {t.label}
            </button>
          ))}
        </div>

        {tab === "mcp" && (
          <div className="space-y-5">
            <div className="flex flex-wrap justify-center gap-2">
              {APPS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setApp(a.id)}
                  className={`rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                    app === a.id ? "border-rose-400/60 bg-rose-500/10 text-white" : "border-white/10 text-white/40 hover:text-white"
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>

            <div className="er-card space-y-4 p-5">
              <CopyField label="Connector URL" value={connectorUrl} />
              <div>
                <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-white/35">
                  {APPS.find((a) => a.id === app)!.label} config
                </label>
                <pre className="overflow-x-auto rounded-lg border border-white/10 bg-black/40 p-3 text-[10.5px] leading-relaxed text-white/70">
                  {appConfig[app]}
                </pre>
              </div>
              <p className="text-[11px] text-white/35">
                Replace <code className="text-rose-300">YOUR_AURORA_API_KEY</code> with a personal API key from{" "}
                <a href={`${origin}/connect`} target="_blank" rel="noreferrer" className="text-rose-300 underline">
                  Aurora's Connect page
                </a>{" "}
                — the same key works across the whole platform, this studio included.
              </p>
            </div>

            <div className="er-card p-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[11px] font-bold text-white/70">Test connection</span>
                <button
                  onClick={testConnection}
                  disabled={testState === "testing"}
                  className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-white/15 disabled:opacity-50"
                >
                  {testState === "testing" && <Loader2 size={11} className="animate-spin" />}
                  Run with my session
                </button>
              </div>
              {testState === "ok" && (
                <p className="text-[11px] text-emerald-400">
                  Connected as {user.email} — {toolCount} tool{toolCount === 1 ? "" : "s"} available.
                </p>
              )}
              {testState === "error" && (
                <p className="text-[11px] text-red-400">Couldn't reach the MCP server with your session — try again or use an API key.</p>
              )}
              {testState === "idle" && (
                <p className="text-[11px] text-white/30">
                  Uses your current sign-in for a quick check — a real client should use a long-lived API key instead.
                </p>
              )}
            </div>
          </div>
        )}

        {tab === "cli" && (
          <div className="space-y-5">
            <div className="er-card space-y-4 p-5">
              <CopyField label="Install & connect" value={cliInstall} />
              <p className="text-[11px] text-white/35">
                Pipes tool calls over stdio to the connector above. Add{" "}
                <code className="text-rose-300">--header "Authorization:Bearer YOUR_AURORA_API_KEY"</code> to authenticate.
              </p>
            </div>
          </div>
        )}

        {tab === "skill" && (
          <div className="space-y-5">
            <div className="er-card space-y-3 p-5">
              <p className="text-[12px] text-white/60">
                Drop this into an agent's skills directory so it knows how to reach Adult School's
                generation tools without extra prompting:
              </p>
              <pre className="overflow-x-auto rounded-lg border border-white/10 bg-black/40 p-3 text-[10.5px] leading-relaxed text-white/70">
{`---
name: adult-school-generate
description: Generate identity-locked images/video via Aurora Adult School's MCP server
---
Connector: ${connectorUrl}
Auth: Authorization: Bearer <AURORA_API_KEY>
Primary tool: aurora_submit_job (kind: image | video | lipsync | upscale)
Roster: request an identity by name (e.g. Yuki, Lily, Aria, Maya)`}
              </pre>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
