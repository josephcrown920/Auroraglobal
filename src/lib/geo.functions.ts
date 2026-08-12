import { createServerFn } from "@tanstack/react-start";
import type { Currency } from "./billing.plans";

// NGN-only pricing: the Paystack merchant account is Nigerian and rejects any
// other currency with "Currency not supported by merchant". Every checkout
// must charge NGN until the account is approved for multi-currency, so this
// pins NGN for all callers (studio pricing display + checkout currency param).
export const detectCurrency = createServerFn({ method: "GET" }).handler(async () => {
  const currency: Currency = "NGN";
  return { currency, country: null as string | null };
});
