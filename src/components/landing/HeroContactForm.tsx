import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, ArrowRight, Play, Loader2, CheckCircle2 } from "lucide-react";
import { z } from "zod";
import { submitContactMessage } from "@/lib/legal.functions";
import { track } from "@/lib/tracking";

const Schema = z.object({
  name: z.string().trim().min(1, "Name required").max(120),
  email: z.string().trim().email("Enter a valid email").max(255),
  message: z.string().trim().min(10, "Tell us a little more (10+ chars)").max(2000),
});

export function HeroContactForm({ greeting }: { greeting: string }) {
  const submit = useServerFn(submitContactMessage);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = Schema.safeParse({ name, email, message });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the form");
      return;
    }
    setLoading(true);
    try {
      await submit({ data: { ...parsed.data, topic: "general" } });
      void track("hero_contact_submit");
      setDone(true);
      setName(""); setEmail(""); setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="relative z-10 px-6 md:px-12 pt-6 md:pt-14 pb-14 grid lg:grid-cols-12 gap-10 items-center">
      {/* Left: pitch */}
      <div className="lg:col-span-7 space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-violet-400/30 bg-violet-500/10 text-violet-200 text-xs">
          <span className="size-1.5 rounded-full bg-violet-400 animate-pulse" />
          {greeting} · A creative supercomputer
        </div>
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-semibold tracking-tight leading-[1.02]">
          One selfie in.
          <span className="block bg-gradient-to-r from-violet-300 via-fuchsia-300 to-pink-200 bg-clip-text text-transparent">
            A full campaign out.
          </span>
        </h1>
        <p className="text-lg text-white/70 max-w-xl">
          Aurora bundles Seedance, Kling 3.0, Seedream 4.5, Nano Banana Pro and Sync lip-sync into one premium studio.
          Cinematic photos, videos, lip-sync, UGC ads and virtual try-ons — generated in minutes, not weeks.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/studio"
            onClick={() => void track("hero_cta_click", { variant: "primary" })}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-full font-medium text-white no-underline bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:opacity-95 shadow-xl shadow-violet-500/30"
          >
            <Play className="size-4" /> Start free — 5 Aura
          </Link>
          <a href="#services" className="inline-flex items-center gap-2 px-5 py-3 rounded-full font-medium text-white/90 border border-white/15 hover:bg-white/5 no-underline">
            See what's inside <ArrowRight className="size-4" />
          </a>
        </div>
      </div>

      {/* Right: contact form card */}
      <div className="lg:col-span-5">
        <form
          onSubmit={onSubmit}
          className="relative rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6 md:p-7 shadow-2xl shadow-violet-950/40"
        >
          <div className="pointer-events-none absolute -inset-px rounded-3xl bg-gradient-to-br from-violet-500/30 via-fuchsia-500/10 to-transparent opacity-60 blur-2xl -z-10" />
          <div className="flex items-center gap-2 mb-5">
            <span className="size-8 rounded-xl flex items-center justify-center bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/40">
              <Sparkles className="size-4 text-white" />
            </span>
            <div>
              <div className="text-sm font-semibold text-white">Talk to Aurora</div>
              <div className="text-xs text-white/50">Tell us what you want to create. We reply within a day.</div>
            </div>
          </div>

          {done ? (
            <div className="flex flex-col items-center text-center py-8 gap-3">
              <CheckCircle2 className="size-10 text-emerald-300" />
              <div className="text-base font-medium text-white">Got it — we'll be in touch.</div>
              <div className="text-sm text-white/60">In the meantime, claim your 5 free Aura and start exploring.</div>
              <Link to="/studio" className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-white no-underline bg-gradient-to-r from-violet-500 to-fuchsia-500">
                Open Performance Studio <ArrowRight className="size-4" />
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-white/60" htmlFor="hero-name">Name</label>
                <input
                  id="hero-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={120}
                  required
                  className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 focus:border-violet-400/60 outline-none px-3.5 py-2.5 text-sm text-white placeholder:text-white/30"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="text-xs text-white/60" htmlFor="hero-email">Email</label>
                <input
                  id="hero-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={255}
                  required
                  className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 focus:border-violet-400/60 outline-none px-3.5 py-2.5 text-sm text-white placeholder:text-white/30"
                  placeholder="you@studio.com"
                />
              </div>
              <div>
                <label className="text-xs text-white/60" htmlFor="hero-message">What do you want to create?</label>
                <textarea
                  id="hero-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={2000}
                  required
                  rows={3}
                  className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 focus:border-violet-400/60 outline-none px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 resize-none"
                  placeholder="E.g. a 15s lip-sync music video from my selfie + this beat."
                />
              </div>
              {error && <p className="text-xs text-rose-300">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-medium text-white bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:opacity-95 shadow-lg shadow-violet-500/30 disabled:opacity-60"
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                {loading ? "Sending…" : "Get my creative plan"}
              </button>
              <p className="text-[11px] text-white/40 text-center">
                No spam. By submitting you agree to our <Link to="/legal/$slug" params={{ slug: "privacy" }} className="underline hover:text-white/70">privacy policy</Link>.
              </p>
            </div>
          )}
        </form>
      </div>
    </section>
  );
}
