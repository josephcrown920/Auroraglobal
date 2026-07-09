---
name: LLM structured-output tolerance for the fallback chain
description: Hard-won rules for schemas passed to generateWithFallback (openai-compatible json_object mode) so weak fallback models don't fail whole turns.
---

The fallback chain ends at small models (Llama 3.3 via HF router), and openai-compatible `json_object` mode does NOT enforce the schema server-side — the model only follows prose. Zod does the real validation, so schemas must tolerate common model drift or the whole turn throws "No object generated".

Rules:
- The prompt (system or user) MUST contain the word "JSON" or openai-compat providers reject `response_format: json_object` outright.
- Weak models drift in predictable ways: numeric ids where strings are asked (`z.coerce.string()`), key/value objects where a plain string is asked (union + `.transform` flatten to bullet lines), bare arrays where a wrapper object is asked (union + `.transform` wrap with sensible defaults).
- Prefer `z.union([...]).transform(...)` over `z.preprocess` — preprocess breaks output-type inference through `z.ZodType<T>` generics (fields become `unknown`).
- Any generic like `schema: z.ZodType<T>` infers T from the schema's INPUT; transformed schemas need `z.ZodType<T, z.ZodTypeDef, unknown>` so T = output type.
- Make schema fields `.nullable().optional()` — models omit null fields as often as they emit them.
- OpenRouter free tier fails plan-sized outputs with "requires more credits, or fewer max_tokens" — it's a dead link in the chain for long generations; don't debug it as a schema problem.

**How to apply:** any new schema fed to `generateWithFallback` should be stress-tested live per-provider (a few varied messages) before shipping; capture `err.text` + zod issues from `AI_NoObjectGeneratedError` to see the actual drift.
