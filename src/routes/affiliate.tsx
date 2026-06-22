import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMyAffiliate, updateAffiliate } from "@/lib/affiliate.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { SiteFooter } from "@/components/SiteFooter";
import { Copy, DollarSign, MousePointerClick, Users, Sparkles } from "lucide-react";

export const Route = createFileRoute("/affiliate")({
  component: AffiliatePage,
  head: () => ({
    meta: [
      { title: "Affiliate program — Aurora Studio" },
      { name: "description", content: "Earn 20% recurring on every Aurora credit purchase you refer. Track clicks, conversions and payouts in one dashboard." },
      { property: "og:title", content: "Aurora Affiliate Program — 20% recurring" },
      { property: "og:description", content: "Refer creators, earn 20% recurring commission on every credit purchase." },
      { property: "og:url", content: "https://aurorastudiostar.lovable.app/affiliate" },
    ],
    links: [{ rel: "canonical", href: "https://aurorastudiostar.lovable.app/affiliate" }],
  }),
});

function AffiliatePage() {
  const get = useServerFn(getMyAffiliate);
  const save = useServerFn(updateAffiliate);
  const [data, setData] = useState<Awaited<ReturnType<typeof getMyAffiliate>> | null>(null);
  const [email, setEmail] = useState("");

  useEffect(() => { get({}).then(d => { setData(d); setEmail(d.affiliate?.payout_email ?? ""); }).catch(() => {}); }, []);

  if (!data) return <main className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</main>;
  const link = typeof window !== "undefined" ? `${window.location.origin}/?ref=${data.affiliate?.code}` : `/?ref=${data.affiliate?.code}`;

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border/40 px-6 py-4 flex items-center justify-between">
        <Link to="/" className="font-semibold no-underline text-foreground">Aurora</Link>
        <Link to="/dashboard" className="text-sm text-foreground/70 no-underline">Dashboard</Link>
      </header>
      <section className="max-w-3xl mx-auto px-6 py-10">
        <div className="flex items-center gap-2 mb-2"><Sparkles className="h-6 w-6 text-primary" /><h1 className="text-3xl font-bold">Affiliate program</h1></div>
        <p className="text-muted-foreground mb-8">Earn <strong>{data.affiliate?.commission_pct ?? 20}%</strong> on every credit purchase from people you refer.</p>

        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          <Stat icon={<MousePointerClick className="h-4 w-4" />} label="Clicks" value={String(data.clicks)} />
          <Stat icon={<Users className="h-4 w-4" />} label="Conversions" value={String(data.conversionsCount)} />
          <Stat icon={<DollarSign className="h-4 w-4" />} label="Earned" value={`$${data.earned.toFixed(2)}`} />
        </div>

        <div className="rounded-xl border border-border bg-card p-5 mb-6">
          <Label>Your referral link</Label>
          <div className="flex gap-2 mt-2">
            <Input readOnly value={link} />
            <Button aria-label="Copy referral link" onClick={() => { navigator.clipboard.writeText(link); toast.success("Copied"); }}><Copy className="h-4 w-4" /></Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Code: <code className="bg-muted px-1.5 py-0.5 rounded">{data.affiliate?.code}</code></p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <Label htmlFor="payout">Payout email</Label>
          <div className="flex gap-2 mt-2">
            <Input id="payout" type="email" value={email} onChange={e => setEmail(e.target.value)} />
            <Button onClick={async () => { await save({ data: { payout_email: email } }); toast.success("Saved"); }}>Save</Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Payouts processed monthly via PayPal / bank transfer once you reach $50.</p>
        </div>
      </section>
      <SiteFooter tone="light" />
    </main>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
