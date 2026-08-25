import { authNextSearch } from "@/lib/auth-return-path";
import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  issueGiftCard,
  issueGiftCardBatch,
  listGiftCards,
  listMyPurchasedGiftCards,
  redeemGiftCard,
} from "@/lib/gifts.functions";
import { createGiftCardPaystackCheckout, getMyProfile } from "@/lib/billing.functions";
import { createCryptoGiftCardCheckout } from "@/lib/crypto-checkout.functions";
import { GIFT_CARD_PRODUCTS, type GiftCardProductId } from "@/lib/gift-card-catalog";
import { Sparkles, Loader2, ArrowLeft, Gift, Copy, Check, Shield, Crown, CreditCard, Bitcoin, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createLazyFileRoute("/gifts")({ component: GiftsPage });

type Design = "aurora" | "midnight" | "neon" | "rose";
const DESIGNS: Record<Design, { name: string; bg: string; ring: string; text: string }> = {
  aurora: { name: "Aura", bg: "bg-gradient-to-br from-red-500 via-orange-500 to-amber-400", ring: "ring-red-400/40", text: "text-white" },
  midnight: { name: "Midnight", bg: "bg-gradient-to-br from-slate-900 via-indigo-900 to-cyan-900", ring: "ring-indigo-400/40", text: "text-white" },
  neon: { name: "Neon", bg: "bg-gradient-to-br from-emerald-400 via-cyan-400 to-orange-500", ring: "ring-emerald-400/40", text: "text-black" },
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
            <div className="text-[10px] uppercase tracking-wider opacity-80">Aura</div>
          </div>
        </div>
        {note && <p className="text-xs italic opacity-90 line-clamp-2">"{note}"</p>}
        <div className="flex items-end justify-between">
          <div className="text-xs tracking-widest opacity-90">{code ?? "AURA-••••-••••"}</div>
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
  const issueBatchFn = useServerFn(issueGiftCardBatch);
  const listFn = useServerFn(listGiftCards);
  const listMineFn = useServerFn(listMyPurchasedGiftCards);
  const redeemFn = useServerFn(redeemGiftCard);
  const paystackGiftFn = useServerFn(createGiftCardPaystackCheckout);
  const cryptoGiftFn = useServerFn(createCryptoGiftCardCheckout);
  const profileFn = useServerFn(getMyProfile);

  const { data: profile } = useQuery({ queryKey: ["profile", user?.id], queryFn: () => profileFn(), enabled: !!user });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: authNextSearch() });
  }, [user, loading, navigate]);

  // Redeem state
  const [redeemCode, setRedeemCode] = useState("");
  const redeemMut = useMutation({
    mutationFn: async () => redeemFn({ data: { code: redeemCode } }),
    onSuccess: (r) => {
      toast.success(r.kind === "pro" ? `Aurora Pro extended by ${r.pro_days} days` : `+${r.credits} Aura added`);
      setRedeemCode("");
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["my-gift-cards"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  // Admin: issue
  const [issueDesign, setIssueDesign] = useState<Design>("aurora");
  const [issueCredits, setIssueCredits] = useState(800);
  const [issueUsd, setIssueUsd] = useState(10);
  const [issueNote, setIssueNote] = useState("");
  const [issueKind, setIssueKind] = useState<"aura" | "pro">("aura");
  const [issueProDays, setIssueProDays] = useState(30);
  const [batchCount, setBatchCount] = useState(10);
  const [productId, setProductId] = useState<GiftCardProductId>("creator");
  const [purchaseDesign, setPurchaseDesign] = useState<Design>("aurora");
  const [purchaseNote, setPurchaseNote] = useState("");

  const issueMut = useMutation({
    mutationFn: async () =>
      issueFn({
        data: {
          credits: issueKind === "aura" ? issueCredits : 0,
          amountUsd: issueUsd,
          kind: issueKind,
          proDays: issueKind === "pro" ? issueProDays : 0,
          design: issueDesign,
          note: issueNote || null,
        },
      }),
    onSuccess: () => {
      toast.success("Gift card created");
      setIssueNote("");
      qc.invalidateQueries({ queryKey: ["gift-cards"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const batchMut = useMutation({
    mutationFn: () => issueBatchFn({
      data: {
        count: batchCount,
        credits: issueKind === "aura" ? issueCredits : 0,
        amountUsd: issueUsd,
        kind: issueKind,
        proDays: issueKind === "pro" ? issueProDays : 0,
        design: issueDesign,
        note: issueNote || null,
      },
    }),
    onSuccess: (newCards) => {
      toast.success(`${newCards.length} active cards created`);
      qc.invalidateQueries({ queryKey: ["gift-cards"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const paystackGiftMut = useMutation({
    mutationFn: () => paystackGiftFn({ data: { productId, design: purchaseDesign, note: purchaseNote || null } }),
    onSuccess: ({ authorizationUrl }) => { window.location.href = authorizationUrl; },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Checkout failed"),
  });
  const cryptoGiftMut = useMutation({
    mutationFn: () => cryptoGiftFn({ data: { productId, design: purchaseDesign, note: purchaseNote || null } }),
    onSuccess: ({ authorizationUrl }) => { window.location.href = authorizationUrl; },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Crypto checkout failed"),
  });

  const { data: cards } = useQuery({
    queryKey: ["gift-cards"],
    queryFn: () => listFn(),
    enabled: !!profile?.isAdmin,
  });
  const { data: myCards } = useQuery({
    queryKey: ["my-gift-cards", user?.id],
    queryFn: () => listMineFn(),
    enabled: !!user,
    refetchOnWindowFocus: true,
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
    <main className="aurora-page-shell text-foreground">
      <span aria-hidden className="aurora-ambient" />
      <header className="relative z-10 flex items-center justify-between pl-5 pr-5 py-5 border-b border-border bg-background/80 backdrop-blur-xl">
        <Link to="/studio" className="flex items-center gap-2 font-semibold tracking-tight">
          <ArrowLeft className="size-4 text-muted-foreground" />
          <span className="size-8 rounded-xl flex items-center justify-center bg-[image:var(--gradient-hero)] shadow-[var(--shadow-glow-soft)]">
            <Gift className="size-4 text-primary-foreground" />
          </span>
          Gift Cards
        </Link>
      </header>

      <div className="relative z-10 max-w-6xl mx-auto p-6 md:p-10 space-y-10">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Give a creative run.</h1>
          <p className="text-muted-foreground mt-1">Choose Aura or a fixed Pro term, then share a private code after payment clears.</p>
        </div>

        {/* Visual-first gift shop: the card shows the entitlement before copy. */}
        <section className="space-y-4" aria-label="Buy a gift card">
          <div className="grid md:grid-cols-2 gap-4">
            {Object.values(GIFT_CARD_PRODUCTS).map((product, i) => {
              const design: Design = (["aurora", "midnight", "neon", "rose"] as Design[])[i % 4]!;
              const selected = productId === product.id;
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => setProductId(product.id)}
                  aria-pressed={selected}
                  className={`rounded-2xl border p-2 text-left transition-colors ${selected ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:border-primary/40"}`}
                >
                  <GiftCardArt
                    design={design}
                    credits={product.kind === "aura" ? product.credits : product.proDays}
                    amountUsd={product.usdMinor / 100}
                  />
                  <div className="px-2 pt-3 pb-2 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{product.kind === "pro" ? `${product.proDays}-day Aurora Pro` : product.label}</p>
                      <p className="text-xs text-muted-foreground">{product.kind === "pro" ? "One-time access, no renewal" : "Aura never expires once redeemed"}</p>
                    </div>
                    {product.kind === "pro" ? <Crown className="size-4 text-primary shrink-0" /> : <Sparkles className="size-4 text-primary shrink-0" />}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="grid lg:grid-cols-[1fr_1.15fr] gap-5 aurora-panel p-5">
            <div className="space-y-3">
              <p className="aurora-kicker">Choose the card art</p>
              <div className="grid grid-cols-4 gap-2">
                {(Object.keys(DESIGNS) as Design[]).map((design) => (
                  <button
                    key={design}
                    type="button"
                    onClick={() => setPurchaseDesign(design)}
                    aria-label={`Use ${DESIGNS[design].name} card art`}
                    className={`rounded-xl border p-1 ${purchaseDesign === design ? "border-primary ring-1 ring-primary/40" : "border-transparent"}`}
                  >
                    <GiftCardArt
                      design={design}
                      credits={GIFT_CARD_PRODUCTS[productId].kind === "aura" ? GIFT_CARD_PRODUCTS[productId].credits : GIFT_CARD_PRODUCTS[productId].proDays}
                      size="sm"
                    />
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-sm font-semibold">{GIFT_CARD_PRODUCTS[productId].label}</p>
              <Input placeholder="Optional gift note" value={purchaseNote} maxLength={200} onChange={(e) => setPurchaseNote(e.target.value)} />
              <div className="grid sm:grid-cols-2 gap-2">
                <Button variant="premium" onClick={() => paystackGiftMut.mutate()} disabled={paystackGiftMut.isPending || cryptoGiftMut.isPending}>
                  {paystackGiftMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4 mr-2" />}
                  Pay with card
                </Button>
                <Button variant="outline" onClick={() => cryptoGiftMut.mutate()} disabled={paystackGiftMut.isPending || cryptoGiftMut.isPending}>
                  {cryptoGiftMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Bitcoin className="size-4 mr-2" />}
                  Pay with crypto
                </Button>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">Cards activate only after the verified Paystack or NOWPayments webhook settles the payment. The code is then shown here and emailed to you.</p>
            </div>
          </div>
        </section>

        {/* Redeem */}
        <section className="aurora-panel p-6 space-y-4">
          <h2 className="aurora-kicker">Redeem a card</h2>
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="AURA-XXXX-XXXX-XXXX"
              value={redeemCode}
              onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
              className="flex-1 min-w-[260px] tracking-widest"
            />
            <Button variant="premium" onClick={() => redeemMut.mutate()} disabled={!redeemCode || redeemMut.isPending}>
              {redeemMut.isPending ? <Loader2 className="size-4 animate-spin" /> : "Redeem"}
            </Button>
          </div>
        </section>

        <section className="space-y-3" aria-label="My purchased gift cards">
          <div className="flex items-center gap-2">
            <Share2 className="size-4 text-primary" />
            <h2 className="text-base font-semibold">My gift cards</h2>
          </div>
          {(myCards?.items ?? []).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              Paid cards appear here with a copyable private code once the payment is confirmed.
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(myCards?.items ?? []).map((card: unknown) => <IssuedCard key={(card as { id: string }).id} card={card as Parameters<typeof IssuedCard>[0]["card"]} />)}
            </div>
          )}
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
                  <button type="button" onClick={() => setIssueKind("aura")} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${issueKind === "aura" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>Aura card</button>
                  <button type="button" onClick={() => setIssueKind("pro")} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${issueKind === "pro" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>Pro access</button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs space-y-1">
                    <span className="text-muted-foreground">Aura</span>
                    <Input type="number" disabled={issueKind === "pro"} value={issueCredits} onChange={(e) => setIssueCredits(parseInt(e.target.value || "0"))} />
                  </label>
                  <label className="text-xs space-y-1">
                    <span className="text-muted-foreground">{issueKind === "pro" ? "Pro days" : "USD value"}</span>
                    <Input type="number" value={issueKind === "pro" ? issueProDays : issueUsd} onChange={(e) => issueKind === "pro" ? setIssueProDays(parseInt(e.target.value || "0")) : setIssueUsd(parseFloat(e.target.value || "0"))} />
                  </label>
                </div>
                <Input placeholder="Optional note (e.g. Happy Birthday!)" value={issueNote} onChange={(e) => setIssueNote(e.target.value)} />
                <Button variant="premium" onClick={() => issueMut.mutate()} disabled={issueMut.isPending} className="w-full">
                  {issueMut.isPending ? <Loader2 className="size-4 animate-spin" /> : "Create gift card"}
                </Button>
                <div className="flex gap-2">
                  <Input aria-label="Batch card count" type="number" min={1} max={50} value={batchCount} onChange={(e) => setBatchCount(parseInt(e.target.value || "1"))} />
                  <Button variant="outline" onClick={() => batchMut.mutate()} disabled={batchMut.isPending} className="shrink-0">
                    {batchMut.isPending ? <Loader2 className="size-4 animate-spin" /> : `Create ${batchCount}`}
                  </Button>
                </div>
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
