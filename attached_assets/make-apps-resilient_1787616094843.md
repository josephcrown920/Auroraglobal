---
name: Make apps resilient to abuse and overload
description: Use when building public endpoints, APIs, auth/login routes, forms, file uploads, search, or any endpoint that calls a paid service (AI, email, SMS) — to add rate limiting, timeouts, and quotas that prevent abuse, runaway cost, and denial of service.
---

**Activation:** On-demand — fires when building public or expensive endpoints. Guardrail + actionable: Agent adds the limits/timeouts in code; cost ceilings on usage-based services are also set by humans.

# Instructions

An endpoint with no limits is a denial-of-service and runaway-cost risk: attackers (or a bug) can hammer it, exhaust resources, or run up a bill on paid downstream services. This is OWASP LLM10 (Unbounded Consumption) generalized. Add controls proportional to the endpoint's exposure and cost.

- Rate-limit public and sensitive endpoints — especially auth/login (brute force), sign-up, password reset, search, and anything triggering a paid call. Apply per-IP and, where possible, per-user limits with sensible windows.
- Cap and time-bound work: set request timeouts, maximum payload/upload sizes, pagination limits, and a maximum result-set size. Reject oversized or overly broad requests instead of processing them.
- Protect expensive downstream calls (LLM/model APIs, email/SMS, third-party APIs): add quotas/throttling and a per-user or per-period ceiling so one caller can't exhaust credits or budget, and respect any org budget.
- Validate inputs early and cheaply, and fail fast with a clear error rather than doing expensive work on invalid input.
- Degrade gracefully under load: return 429 (Too Many Requests) with a Retry-After where appropriate; don't crash or leak internals.
- Lean on the platform but don't rely on it alone: Replit provides edge-level DDoS protection, but per-route rate limits, quotas, and timeouts are the app's responsibility.

When building such an endpoint, state which controls you added (rate limits, timeouts, size caps, downstream quotas) and which still need attention. Source: OWASP LLM10 Unbounded Consumption + Replit security checklist (rate limiting).
