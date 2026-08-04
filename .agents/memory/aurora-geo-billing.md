---
name: Aurora geo/PPP billing state
description: Geo-based pricing is designed but switched OFF (USD-only live); owner-only region preview on /billing; live payments table was empty as of 2026-08-04.
---

# Aurora geo/PPP billing

## Current state (2026-08-04)
- Geo/PPP price tables are fully defined (packs + day passes + Pro) for USD/NGN/GHS/KES/ZAR/EGP in `billing.plans.ts` (+ a parallel copy in `geo-pricing.ts` — TWO sources that can drift), but geo pricing is **deliberately OFF**: the `detectCurrency` server fn is pinned to USD and `detectGeoRegion()` has no consumers. Every user worldwide sees and pays USD; only Paystack's hosted checkout varies by region (payment channels like bank transfer vs card are Paystack-side, currency-dependent).
- **Live `payments` table had ZERO rows** — no Paystack checkout init has ever succeeded in production. Any "payment worked/failed" claim from the owner refers to something that never reached `transaction/initialize`, or happened outside the app. Verify against the table before reasoning about payment history.
- Owner asked to *see* international billing → built an admin-only region preview on /billing (gated by `amIAdmin`; non-admins hard-locked to USD; buy buttons disabled while previewing). Display-only — checkout still charges USD.

## Rules
- **PPP secrecy:** never expose cross-region prices to regular users; each user sees only their own region. The owner-preview is the single sanctioned exception.
- **Why:** stated in billing.plans.ts/geo-pricing.ts headers; standard PPP practice to avoid VPN price-shopping.
- **Turning geo pricing ON is a business decision** (revenue cut ~35% for African regions) — never enable it as a side effect. It also needs Paystack account support: a Nigerian Paystack business typically charges NGN (+USD if enabled); GHS/KES/ZAR/EGP generally require locally-registered Paystack businesses.
- **How to apply:** any billing-page or checkout change must keep the non-admin path pinned to the live currency source (`detectCurrency`), and keep preview state out of `createPaystackCheckout` inputs.
