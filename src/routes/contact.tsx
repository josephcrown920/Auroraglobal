import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { submitContactMessage } from "@/lib/legal.functions";
import { COMPANY } from "@/lib/legal";
import { SiteFooter } from "@/components/SiteFooter";
import { Sparkles, ArrowLeft, Mail, Loader2, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import auroraLogo from "@/assets/aurora-logo.png.asset.json";

export const Route = createFileRoute("/contact")({
  component: ContactPage,
  head: () => ({
    meta: [
      { title: `Contact — ${COMPANY.product}` },
      { name: "description", content: "Get in touch with the Aurora team — support, billing, abuse and press inquiries." },
      { property: "og:title", content: "Contact Aurora Studio" },
      { property: "og:description", content: "Reach Aurora for support, billing, press and abuse." },
      { property: "og:url", content: "https://aurorastudiostar.lovable.app/contact" },
    ],
    links: [{ rel: "canonical", href: "https://aurorastudiostar.lovable.app/contact" }],
  }),
});

function ContactPage() {
  const submit = useServerFn(submitContactMessage);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [topic, setTopic] = useState<"general" | "billing" | "abuse" | "privacy" | "bug">("general");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  const mut = useMutation({
    mutationFn: () => submit({ data: { email, name: name || null, topic, message } }),
    onSuccess: () => {
      setSent(true);
      setMessage("");
      toast.success("Message sent — we'll be in touch");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between px-6 md:px-10 py-5 border-b border-border bg-card/40 backdrop-blur-xl">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight no-underline">
          <ArrowLeft className="size-4 text-muted-foreground" />
          <img src={auroraLogo.url} alt="Aurora" className="size-8 rounded-xl object-contain" />
          {COMPANY.product}
        </Link>
      </header>

      <div className="max-w-3xl mx-auto px-6 md:px-10 py-12 space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-semibold tracking-tight">Get in touch</h1>
          <p className="text-muted-foreground">
            Questions, abuse reports, refunds, or just curious? Drop a note and we'll reply within 1–2 business days.
            You can also email us at{" "}
            <a href={`mailto:${COMPANY.email}`} className="underline">{COMPANY.email}</a>.
          </p>
        </div>

        {sent && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm flex items-start gap-3">
            <Check className="size-4 text-emerald-500 mt-0.5" />
            <div>
              <div className="font-medium">Message received</div>
              <div className="text-muted-foreground">We'll reply to {email}. Need to send another?</div>
              <button className="text-xs underline mt-1" onClick={() => setSent(false)}>Write another message</button>
            </div>
          </div>
        )}

        {!sent && (
          <form
            className="rounded-2xl border border-border bg-card/40 p-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              mut.mutate();
            }}
          >
            <div className="grid md:grid-cols-2 gap-3">
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Your name (optional)</span>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Email *</span>
                <Input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </label>
            </div>

            <div className="space-y-1 text-sm">
              <span className="text-muted-foreground">What's it about?</span>
              <div className="flex flex-wrap gap-2">
                {([
                  { v: "general", l: "General" },
                  { v: "billing", l: "Billing / refund" },
                  { v: "bug", l: "Bug report" },
                  { v: "abuse", l: "Report abuse" },
                  { v: "privacy", l: "Privacy / data" },
                ] as const).map((t) => (
                  <button
                    key={t.v}
                    type="button"
                    onClick={() => setTopic(t.v)}
                    className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${topic === t.v ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"}`}
                  >
                    {t.l}
                  </button>
                ))}
              </div>
            </div>

            <label className="space-y-1 text-sm block">
              <span className="text-muted-foreground">Your message *</span>
              <Textarea
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                minLength={10}
                maxLength={5000}
                placeholder="Tell us what's going on…"
              />
              <span className="text-[10px] text-muted-foreground">{message.length}/5000</span>
            </label>

            <p className="text-[11px] text-muted-foreground">
              By submitting you agree to our{" "}
              <Link to="/legal/$slug" params={{ slug: "privacy" }} className="underline">Privacy Policy</Link>.
            </p>

            <Button
              type="submit"
              disabled={mut.isPending || !email || message.length < 10}
              className="w-full"
              style={{ background: "var(--gradient-hero)" }}
            >
              {mut.isPending ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Mail className="size-4 mr-2" />}
              Send message
            </Button>
          </form>
        )}
      </div>

      <SiteFooter tone="light" />
    </main>
  );
}
