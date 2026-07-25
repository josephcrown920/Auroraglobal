import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMyAffiliate, updateAffiliate } from "@/lib/affiliate.functions";
import { PARTNER_COMMISSION_PCT, REFERRAL_AURA_EACH } from "@/lib/partners";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { SiteFooter } from "@/components/SiteFooter";
import { Copy, DollarSign, Gift, MousePointerClick, Rocket, Share2, Sparkles, Star, Users } from "lucide-react";

export const Route = createLazyFileRoute("/partners")({ component: PartnersPage });

const BENEFITS = [
  { icon: DollarSign, title: `${PARTNER_COMMISSION_PCT}% recurring commission`, body: "on every Aura purchase from creators you refer. No cap, paid monthly." },
  { icon: Gift, title: `+${REFERRAL_AURA_EACH} Aura for you both`, body: "each time a friend joins with your link, you both get free Aura instantly." },
  { icon: Rocket, title: "Early access", body: "test new Aurora features before everyone else." },
  { icon: Star, title: "Featured on Aurora", body: "the best partner videos get featured on our homepage and socials." },
];

function PartnersPage() {
  const { user, loading } = useAuth();

  return (
    <main className="aurora-page-shell text-foreground">
      <span aria-hidden className="aurora-ambient" />
      <header className="relative z-10 border-b border-border/40 bg-background/70 backdrop-blur-xl px-6 py-4 flex items-center justify-between">
        <Link to="/" className="font-semibold no-underline text-foreground">Aurora</Link>
        <Link to="/dashboard" className="text-sm text-foreground/70 no-underline">Dashboard</Link>
      </header>

      <section className="relative z-10 max-w-3xl mx-auto px-6 py-10">
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-emerald-200">
          <Sparkles className="size-3.5" /> Aurora Partners
        </span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">Become an Aurora Partner.</h1>
        <p className="mt-3 text-muted-foreground max-w-xl">
          Earn <strong className="text-foreground">{PARTNER_COMMISSION_PCT}% recurring commission</strong> on every Aura purchase you refer — and
          you and every friend who joins each get <strong className="text-foreground">+{REFERRAL_AURA_EACH} free Aura</strong>.
        </p>

        <ul className="mt-8 grid gap-3">
          {BENEFITS.map((b) => (
            <li key={b.title} className="flex items-start gap-3 rounded-xl aurora-glass p-4">
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-emerald-300/15 text-emerald-200"><b.icon className="size-4" /></span>
              <span className="text-sm"><strong>{b.title}</strong> <span className="text-muted-foreground">— {b.body}</span></span>
            </li>
          ))}
        </ul>

        {loading ? (
          <div className="mt-10 text-center text-muted-foreground">Loading…</div>
        ) : user ? (
          <PartnerDashboard />
        ) : (
          <div className="mt-10 rounded-2xl aurora-glass-strong p-6 text-center">
            <h2 className="text-xl font-semibold">Apply in under 60 seconds.</h2>
            <p className="mt-2 text-sm text-muted-foreground">Create a free account and your personal referral link is ready instantly.</p>
            <Link to="/auth" className="mt-5 inline-flex items-center gap-2 rounded-full bg-emerald-300 px-8 py-3 text-sm font-bold text-emerald-950 no-underline hover:opacity-95">
              Become a Partner
            </Link>
          </div>
        )}
      </section>
      <SiteFooter tone="light" />
    </main>
  );
}

function PartnerDashboard() {
  const get = useServerFn(getMyAffiliate);
  const save = useServerFn(updateAffiliate);
  const [data, setData] = useState<Awaited<ReturnType<typeof getMyAffiliate>> | null>(null);
  const [email, setEmail] = useState("");

  useEffect(() => { get({}).then(d => { setData(d); setEmail(d.affiliate?.payout_email ?? ""); }).catch(() => {}); }, []);

  if (!data) return <div className="mt-10 text-center text-muted-foreground">Loading your dashboard…</div>;
  const link = typeof window !== "undefined" ? `${window.location.origin}/?ref=${data.affiliate?.code}` : `/?ref=${data.affiliate?.code}`;

  const copyLink = () => { navigator.clipboard.writeText(link); toast.success("Link copied"); };
  const shareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join me on Aurora",
          text: `Make cinematic AI music videos with me on Aurora — we both get +${REFERRAL_AURA_EACH} free Aura when you join.`,
          url: link,
        });
        return;
      } catch { /* user cancelled — fall through to copy */ }
    }
    copyLink();
  };

  return (
    <div className="mt-10 space-y-6">
      <div className="rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-transparent p-6">
        <div className="flex items-center gap-2"><Gift className="size-5 text-emerald-300" /><h2 className="text-lg font-semibold">Earn Free Aura</h2></div>
        <p className="mt-2 text-sm text-muted-foreground">
          Invite a friend — when they sign up you <strong className="text-foreground">both get +{REFERRAL_AURA_EACH} Aura</strong>, and you earn {data.affiliate?.commission_pct ?? PARTNER_COMMISSION_PCT}% on everything they buy.
        </p>
        <div className="flex gap-2 mt-4">
          <Input readOnly value={link} />
          <Button aria-label="Copy referral link" variant="secondary" onClick={copyLink}><Copy className="size-4" /></Button>
          <Button aria-label="Share referral link" onClick={shareLink}><Share2 className="size-4" /></Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Code: <code className="bg-muted px-1.5 py-0.5 rounded">{data.affiliate?.code}</code></p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Stat icon={<MousePointerClick className="size-4" />} label="Clicks" value={String(data.clicks)} />
        <Stat icon={<Users className="size-4" />} label="Conversions" value={String(data.conversionsCount)} />
        <Stat icon={<DollarSign className="size-4" />} label="Earned" value={`$${data.earned.toFixed(2)}`} />
      </div>

      <div className="aurora-glass rounded-xl p-5">
        <Label htmlFor="payout">Payout email</Label>
        <div className="flex gap-2 mt-2">
          <Input id="payout" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          <Button onClick={async () => { await save({ data: { payout_email: email } }); toast.success("Saved"); }}>Save</Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Commission payouts processed monthly via PayPal / bank transfer once you reach $50.</p>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="aurora-glass rounded-xl p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
