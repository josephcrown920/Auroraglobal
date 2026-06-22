import { createServerFn } from "@tanstack/react-start";
import type { Currency } from "./billing.plans";

// USD-only pricing. Kept as a server fn so existing callers continue to work.
export const detectCurrency = createServerFn({ method: "GET" }).handler(async () => {
  const currency: Currency = "USD";
  return { currency, country: null as string | null };
});
