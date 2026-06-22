import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Mail, Loader2, Check, Gift, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { submitLead } from "@/lib/leads.functions";
import { toast } from "sonner";

export function LeadCapture() {
  const submit = useServerFn(submitLead);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) return;
    setState("loading");
    try {
      const refCode = typeof window !== "undefined" ? localStorage.getItem("aurora_ref") : null;
      await submit({ data: { email, source: "landing", refCode, userAgent: navigator.userAgent.slice(0, 500) } });
      setState("done");
      toast.success("You're on the list. Watch your inbox.");
    } catch (err) {
      setState("idle");
      toast.error(err instanceof Error ? err.message : "Could not subscribe");
    }
  };

  return (
    <section className="relative z-10 px-6 md:px-12 pb-24">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-violet-600/15 via-fuchsia-600/10 to-emerald-600/10 p-8 md:p-12 grid md:grid-cols-2 gap-8 items-center">
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs text-violet-200 border border-violet-400/30 bg-violet-500/10 px-3 py-1 rounded-full mb-3">
            <Gift className="size-3" /> Early access · 10 free Aurora
          </span>
          <h3 className="text-2xl md:text-3xl font-semibold leading-tight">
            Get on the list. Get the gift.
          </h3>
          <p className="text-white/70 mt-2 text-sm md:text-base">
            New models, recipes, and shoots in your inbox weekly. Subscribers get a 10-Aurora head start the moment they sign in.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-white/60">
            <Link to="/gifts" className="inline-flex items-center gap-1 hover:text-white">
              <Gift className="size-3" /> Gift Aurora to a creator <ArrowRight className="size-3" />
            </Link>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <label htmlFor="lead-email" className="block text-xs uppercase tracking-[0.2em] text-white/50">Email</label>
          <div className="flex items-center gap-2 px-3 rounded-full border border-white/15 bg-black/40 focus-within:border-violet-400/60 transition">
            <Mail className="size-4 text-white/40" aria-hidden="true" />
            <input
              id="lead-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={state !== "idle"}
              placeholder="you@studio.com"
              aria-label="Email address"
              className="flex-1 bg-transparent py-3 outline-none text-sm placeholder:text-white/30"
            />
          </div>
          <button
            type="submit"
            disabled={state !== "idle"}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full font-medium text-white bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:opacity-95 shadow-xl shadow-violet-500/30 disabled:opacity-60"
          >
            {state === "loading" && <><Loader2 className="size-4 animate-spin" /> Subscribing…</>}
            {state === "done" && <><Check className="size-4" /> You're in</>}
            {state === "idle" && <>Reserve my Aurora <ArrowRight className="size-4" /></>}
          </button>
          <p className="text-[10px] text-white/40">By subscribing you agree to our terms. Unsubscribe anytime.</p>
        </form>
      </div>
    </section>
  );
}
