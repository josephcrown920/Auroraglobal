"use server";

import { createServerFn } from "@tanstack/react-start";
import { computePaystackPrice } from "./billing.plans";
import { getRequest } from "@tanstack/react-start/server";

function normalizeCountry(value: string | null): string | null {
  const raw = value?.trim().toUpperCase() ?? "";
  if (/^[A-Z]{2}$/.test(raw)) return raw;
  const match = raw.match(/(?:COUNTRY|GEO|CC)\s*[=:]\s*([A-Z]{2})/);
  return match?.[1] ?? null;
}

/** Cloudflare supplies the country directly; the forwarded fallback is useful
 * in local/proxy environments that pass a country token instead of CF's header. */
export function countryFromRequestHeaders(headers: Headers): string | null {
  const cfCountry = normalizeCountry(headers.get("cf-ipcountry"));
  if (cfCountry) return cfCountry;

  // In production only Cloudflare's injected header is trustworthy. A browser
  // or direct caller can forge X-Forwarded-* values and otherwise buy a lower
  // PPP price. Keep the proxy-token fallbacks available for local development
  // and controlled test environments where Cloudflare is not in the request.
  if (process.env.NODE_ENV === "production") return null;

  const forwardedCountry = normalizeCountry(headers.get("x-forwarded-country"));
  if (forwardedCountry) return forwardedCountry;

  const forwardedFor = headers.get("x-forwarded-for")?.split(",")[0] ?? "";
  return normalizeCountry(forwardedFor);
}

export const detectCurrency = createServerFn({ method: "GET" }).handler(async () => {
  const request = getRequest();
  const country = countryFromRequestHeaders(request.headers);
  // Use the same checkout-safe resolution as billing so the UI never shows a
  // currency Paystack will reject. The amount is only a scale-free probe.
  const geo = computePaystackPrice(100, country);
  return {
    currency: geo.currency,
    country,
    pppMultiplier: geo.pppMultiplier,
    displayLocale: geo.displayLocale,
  };
});
