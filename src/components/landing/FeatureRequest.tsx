import { useState } from "react";
import { Lightbulb, Send } from "lucide-react";
import { toast } from "sonner";

export function FeatureRequest() {
  const [email, setEmail] = useState("");
  const [idea, setIdea] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!idea.trim()) {
      toast.error("Tell us what you'd like to see");
      return;
    }
    setSubmitting(true);
    const subject = encodeURIComponent("Aurora feature request");
    const body = encodeURIComponent(
      `Idea:\n${idea}\n\n${email ? `From: ${email}\n` : ""}`,
    );
    window.location.href = `mailto:hello@aurorastudiostar.com?subject=${subject}&body=${body}`;
    setTimeout(() => {
      setSubmitting(false);
      toast.success("Thanks — your email client should open with your request.");
      setIdea("");
      setEmail("");
    }, 400);
  };

  return (
    <section
      id="request-a-feature"
      className="relative z-10 mx-4 md:mx-12 my-16 overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-[#0b0a1f] via-[#0a0618] to-[#050410] animate-fade-in"
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-60"
        style={{
          background:
            "radial-gradient(circle at 20% 10%, rgba(250,204,21,.18), transparent 40%), radial-gradient(circle at 85% 80%, rgba(168,85,247,.22), transparent 45%)",
        }}
      />
      <div className="relative grid gap-10 px-6 py-14 md:grid-cols-[0.9fr_1.1fr] md:items-center md:px-12 md:py-20">
        <div>
          <span className="inline-flex items-center gap-2 rounded-md aurora-glass px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-amber-200">
            <Lightbulb className="size-3.5" /> Request a feature
          </span>
          <h2 className="mt-5 text-3xl font-bold tracking-tight text-white md:text-5xl">
            Tell us what to build next.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-white/68 md:text-lg">
            Missing a model, a workflow, an export format, or a new style?
            Send it our way — we read every request and ship weekly.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-white/60">
            <li>· New models, presets, or motion styles</li>
            <li>· Integrations (DAWs, editors, social platforms)</li>
            <li>· CLI flags, batch jobs, and automations</li>
          </ul>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-border bg-black/50 p-5 shadow-2xl shadow-violet-500/10 backdrop-blur-xl md:p-6"
        >
          <label className="block text-xs font-semibold uppercase tracking-widest text-white/55">
            What would you like Aurora to do?
          </label>
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            rows={5}
            maxLength={1000}
            placeholder="e.g. Add Suno music generation, export to CapCut, or a vertical 9:16 ad template…"
            className="mt-2 w-full resize-none rounded-xl border border-border bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/35 focus:border-primary/60 focus:outline-none"
          />

          <label className="mt-4 block text-xs font-semibold uppercase tracking-widest text-white/55">
            Email (optional — so we can follow up)
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@studio.com"
            className="mt-2 w-full rounded-xl border border-border bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/35 focus:border-primary/60 focus:outline-none"
          />

          <button
            type="submit"
            disabled={submitting}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white shadow-lg shadow-brand/30 hover:bg-brand/90 disabled:opacity-60"
          >
            <Send className="size-4" /> {submitting ? "Sending…" : "Send request"}
          </button>
        </form>
      </div>
    </section>
  );
}