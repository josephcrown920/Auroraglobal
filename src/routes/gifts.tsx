import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { issueGiftCard, listGiftCards, redeemGiftCard } from "@/lib/gifts.functions";
import { getMyProfile } from "@/lib/billing.functions";
import { PLANS } from "@/lib/billing.plans";
import { Sparkles, Loader2, ArrowLeft, Gift, Copy, Check, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/gifts")({
  component: GiftsPage,
  head: () => ({
    meta: [
      { title: "Gift Cards — Aurora" },
      { name: "description", content: "Gift Aurora to another creator, or redeem a gift card to top up your own balance." },
      { property: "og:title", content: "Aurora Gift Cards" },
      { property: "og:description", content: "Gift Aurora to a creator, or redeem a card on your account." },
      { property: "og:url", content: "https://aurorastudiostar.lovable.app/gifts" },
    ],
    links: [{ rel: "canonical", href: "https://aurorastudiostar.lovable.app/gifts" }],
  }),
});

type Design = "aurora" | "midnight" | "neon" | "rose";
const DESIGNS: Record<Design, { name: string; bg: string; ring: string; text: string }> = {
  aurora: { name: "Aurora", bg: "bg-gradient-to-br from-violet-500 via-fuchsia-500 to-amber-400", ring: "ring-violet-400/40", text: "text-white" },
  midnight: { name: "Midnight", bg: "bg-gradient-to-br from-slate-900 via-indigo-900 to-cyan-900", ring: "ring-indigo-400/40", text: "text-white" },
  neon: { name: "Neon", bg: "bg-gradient-to-br from-emerald-400 via-cyan-400 to-fuchsia-500", ring: "ring-emerald-400/40", text: "text-black" },
  rose: { name: "Rose", bg: "bg-gradient-to-br from-rose-300 via-pink-400 to-amber-200", ring: "ring-rose-400/40", text: "text-rose-950" },
};

function GiftCardArt({
  design,
  credits,
  amountUsd,
  code,
  note,
  size = "md",
}: {
  design: Design;
  credits: number;
  amountUsd?: number;
  code?: string;
  note?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const d = DESIGNS[design];
  const heights = { sm: "h-32", md: "h-48", lg: "h-56" }[size];
  return (
    <div className={`relative rounded-2xl ${heights} w-full ${d.bg} ${d.text} p-5 overflow-hidden shadow-xl ring-1 ${d.ring}`}>
      {/* Decorative shapes */}
      <div className="absolute -right-10 -top-10 size-40 rounded-full bg-white/10 blur-xl" />
      <div className="absolute -left-12 -bottom-12 size-48 rounded-full bg-black/10 blur-2xl" />
      <div className="relative flex flex-col justify-between h-full">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-lg bg-white/25 backdrop-blur flex items-center justify-center">
              <Sparkles className="size-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] opacity-80">Aurora</div>
              <div className="text-sm font-semibold leading-tight">Gift Card</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold leading-none">{credits}</div>
            <div className="text-[10px] uppercase tracking-wider opacity-80">Aurora</div>
          </div>
        </div>
        {note && <p className="text-xs italic opacity-90 line-clamp-2">"{note}"</p>}
        <div className="flex items-end justify-between">
          <div className="font-mono text-xs tracking-widest opacity-90">{code ?? "AURA-••••-••••"}</div>
          {amountUsd !== undefined && amountUsd > 0 && (
            <div className="text-[10px] opacity-80">${amountUsd.toFixed(2)} value</div>
          )}
        </div>
      </div>
    </div>
  );
}

function GiftsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const issueFn = useServerFn(issueGiftCard);
  const listFn = useServerFn(listGiftCards);
  const redeemFn = useServerFn(redeemGiftCard);
  const profileFn = useServerFn(getMyProfile);

  const { data: profile } = useQuery({ queryKey: ["profile", user?.id], queryFn: () => profileFn(), enabled: !!user });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  // Redeem state
  const [redeemCode, setRedeemCode] = useState("");
  const redeemMut = useMutation({
    mutationFn: async () => redeemFn({ data: { code: redeemCode } }),
    onSuccess: (r) => {
      toast.success(`+${r.credits} Aurora added`);
      setRedeemCode("");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  // Admin: issue
  const [issueDesign, setIssueDesign] = useState<Design>("aurora");
  const [issueCredits, setIssueCredits] = useState(80);
  const [issueUsd, setIssueUsd] = useState(10);
  const [issueNote, setIssueNote] = useState("");

  const issueMut = useMutation({
    mutationFn: async () =>
      issueFn({
        data: { credits: issueCredits, amountUsd: issueUsd, design: issueDesign, note: issueNote || null },
      }),
    onSuccess: () => {
      toast.success("Gift card created");
      setIssueNote("");
      qc.invalidateQueries({ queryKey: ["gift-cards"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const { data: cards } = useQuery({
    queryKey: ["gift-cards"],
    queryFn: () => listFn(),
    enabled: !!profile?.isAdmin,
  });

  const showAdmin = !!profile?.isAdmin;

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between px-6 md:px-10 py-5 border-b border-border bg-card/40 backdrop-blur-xl">
        <Link to="/studio" className="flex items-center gap-2 font-semibold tracking-tight">
          <ArrowLeft className="size-4 text-muted-foreground" />
          <span className="size-8 rounded-xl flex items-center justify-center" style={{ background: "var(--gradient-hero)" }}>
            <Gift className="size-4 text-primary-foreground" />
          </span>
          Gift Cards
        </Link>
      </header>

      <div className="max-w-6xl mx-auto p-6 md:p-10 space-y-10">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Aurora Gift Cards</h1>
          <p className="text-muted-foreground mt-1">Beautiful, designed cards matched to our pricing tiers.</p>
        </div>

        {/* Showcase — three cards matching pricing tiers */}
        <section className="grid md:grid-cols-3 gap-5">
          {(Object.keys(PLANS) as Array<keyof typeof PLANS>).map((k, i) => {
            const p = PLANS[k];
            const design: Design = (["aurora", "midnight", "rose"] as Design[])[i];
            return (
              <div key={k} className="space-y-2">
                <GiftCardArt design={design} credits={p.credits} amountUsd={p.usd} />
                <div className="text-xs text-muted-foreground capitalize">{k} tier · ${p.usd}</div>
              </div>
            );
          })}
        </section>

        {/* Redeem */}
        <section className="rounded-2xl border border-border bg-card/40 p-6 space-y-4">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Redeem a card</h2>
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="AURA-XXXX-XXXX-XXXX"
              value={redeemCode}
              onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
              className="flex-1 min-w-[260px] font-mono tracking-widest"
            />
            <Button onClick={() => redeemMut.mutate()} disabled={!redeemCode || redeemMut.isPending}>
              {redeemMut.isPending ? <Loader2 className="size-4 animate-spin" /> : "Redeem"}
            </Button>
          </div>
        </section>

        {/* Admin issue panel (only renders when server returned rows = admin) */}
        {showAdmin && (
          <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 space-y-4">
            <h2 className="text-sm font-medium uppercase tracking-wider text-amber-500 flex items-center gap-2">
              <Shield className="size-4" /> Issue a card
            </h2>
            <div className="grid md:grid-cols-[1fr_320px] gap-6">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(DESIGNS) as Design[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setIssueDesign(d)}
                      className={`rounded-xl border-2 p-1.5 transition-colors ${issueDesign === d ? "border-primary" : "border-border hover:border-primary/40"}`}
                    >
                      <GiftCardArt design={d} credits={issueCredits} amountUsd={issueUsd} size="sm" />
                      <div className="text-[10px] text-center mt-1 text-muted-foreground">{DESIGNS[d].name}</div>
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs space-y-1">
                    <span className="text-muted-foreground">Credits</span>
                    <Input type="number" value={issueCredits} onChange={(e) => setIssueCredits(parseInt(e.target.value || "0"))} />
                  </label>
                  <label className="text-xs space-y-1">
                    <span className="text-muted-foreground">USD value</span>
                    <Input type="number" value={issueUsd} onChange={(e) => setIssueUsd(parseFloat(e.target.value || "0"))} />
                  </label>
                </div>
                <Input placeholder="Optional note (e.g. Happy Birthday!)" value={issueNote} onChange={(e) => setIssueNote(e.target.value)} />
                <Button onClick={() => issueMut.mutate()} disabled={issueMut.isPending} className="w-full" style={{ background: "var(--gradient-hero)" }}>
                  {issueMut.isPending ? <Loader2 className="size-4 animate-spin" /> : "Create gift card"}
                </Button>
              </div>
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Preview</div>
                <GiftCardArt design={issueDesign} credits={issueCredits} amountUsd={issueUsd} note={issueNote || null} />
              </div>
            </div>

            {/* Issued cards */}
            <div className="space-y-3 pt-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Issued cards</div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(cards?.items ?? []).map((c) => (
                  <IssuedCard key={c.id} card={c} />
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function IssuedCard({ card }: { card: { id: string; code: string; credits: number; amount_usd: number; design: string; note: string | null; redeemed_by: string | null; created_at: string } }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-2">
      <GiftCardArt design={(card.design as Design) ?? "aurora"} credits={card.credits} amountUsd={Number(card.amount_usd)} code={card.code} note={card.note} />
      <div className="flex items-center justify-between text-xs">
        <span className={card.redeemed_by ? "text-emerald-500" : "text-muted-foreground"}>
          {card.redeemed_by ? "Redeemed" : "Active"} · {new Date(card.created_at).toLocaleDateString()}
        </span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(card.code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-border hover:bg-accent"
        >
          {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
          {copied ? "Copied" : "Copy code"}
        </button>
      </div>
    </div>
  );
}
