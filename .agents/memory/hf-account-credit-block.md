---
name: HuggingFace account credit block
description: How to tell an HF account-level credit exhaustion apart from a code/slug bug
---

# HF 402 "depleted your monthly included credits" is account-level, not code

**Observed July 2026:** HF_TOKEN authenticates fine (`whoami` works — user NBA-Josh-Hugingface2, plan None, canPay false) and the router lists 128 models (incl. Llama-3.3-70B), but EVERY inference call returns 402 "You have depleted your monthly included credits."

**Rule:** when HF calls fail, first check `GET https://huggingface.co/api/whoami-v2` (plan/canPay) and try one cheap chat call. A 402 credits message means the free-tier monthly inference allowance is used up — no slug change, retry logic, or code fix helps. The account needs PRO or a payment method.

**How to apply:** report it to the user as a billing issue and route generations through the other providers (orchestrator fallback chain) instead of debugging HF adapters.
