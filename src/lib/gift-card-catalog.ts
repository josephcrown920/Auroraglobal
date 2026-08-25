import { PLANS, SUBSCRIPTION_TIERS } from "./billing.plans";

export const GIFT_CARD_PRODUCT_IDS = [
  "starter",
  "creator",
  "studio",
  "pro-1-month",
  "pro-3-month",
] as const;

export type GiftCardProductId = (typeof GIFT_CARD_PRODUCT_IDS)[number];
export type GiftCardKind = "aura" | "pro";

export type GiftCardProduct = {
  id: GiftCardProductId;
  kind: GiftCardKind;
  label: string;
  credits: number;
  proDays: number;
  usdMinor: number;
};

/**
 * Every sellable card is derived from the same plan source of truth as the
 * regular billing page.  Do not introduce a second gift-card price table.
 */
export const GIFT_CARD_PRODUCTS: Record<GiftCardProductId, GiftCardProduct> = {
  starter: {
    id: "starter",
    kind: "aura",
    label: `Starter · ${PLANS.starter.credits.toLocaleString()} Aura`,
    credits: PLANS.starter.credits,
    proDays: 0,
    usdMinor: Math.round(PLANS.starter.usd * 100),
  },
  creator: {
    id: "creator",
    kind: "aura",
    label: `Creator · ${PLANS.creator.credits.toLocaleString()} Aura`,
    credits: PLANS.creator.credits,
    proDays: 0,
    usdMinor: Math.round(PLANS.creator.usd * 100),
  },
  studio: {
    id: "studio",
    kind: "aura",
    label: `Studio · ${PLANS.studio.credits.toLocaleString()} Aura`,
    credits: PLANS.studio.credits,
    proDays: 0,
    usdMinor: Math.round(PLANS.studio.usd * 100),
  },
  "pro-1-month": {
    id: "pro-1-month",
    kind: "pro",
    label: "Aurora Pro · 1 month",
    credits: 0,
    proDays: 30,
    usdMinor: SUBSCRIPTION_TIERS.pro.price_amount_minor,
  },
  "pro-3-month": {
    id: "pro-3-month",
    kind: "pro",
    label: "Aurora Pro · 3 months",
    credits: 0,
    proDays: 90,
    usdMinor: SUBSCRIPTION_TIERS.pro.price_amount_minor * 3,
  },
};

export function getGiftCardProduct(id: GiftCardProductId): GiftCardProduct {
  return GIFT_CARD_PRODUCTS[id];
}