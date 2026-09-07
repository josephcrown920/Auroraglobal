---
name: AI router provider quirks
description: Why every LLM router provider went dead at once (2026-09) and the structured-output settings each OpenAI-compatible endpoint actually accepts.
---

# AI router (src/lib/ai-router) — provider quirks

**Rule:** when the Video Agent / Prime chat "stops answering", probe every
provider in the registry live with the REAL schema (ChatTurnSchema) before
touching UI code. Slugs and endpoint semantics rot independently.

**Why (2026-09-07 incident, all providers failing simultaneously):**
- Anthropic OpenAI-compat: rejects `response_format: json_object`; needs
  `supportsStructuredOutputs: true` (json_schema) AND `strict: true`, and rejects
  `minItems` > 1 → it can never serve the rich chat schema; simple schemas OK.
- Replit Gemini proxy speaks the NATIVE Gemini API only — no
  `/chat/completions`; use `@ai-sdk/google` with the proxy base URL as-is (no
  `/v1beta` suffix). Enable only when key AND base URL are both present.
- Groq retired `llama-3.3-70b-versatile`; OpenRouter retired every `:free`
  qwen/deepseek slug. Verify slugs against the provider's models API.
- xAI 403 = account credits exhausted (falls through fast, not a bug).
- OpenRouter low balance rejects models whose default max_tokens exceed what the
  balance can afford (qwen3-coder) — looks like a model error, is billing.
- Direct OPENAI_API_KEY had no credits; the Replit OpenAI proxy
  (`AI_INTEGRATIONS_OPENAI_*`, gpt-5.4-mini) is the always-on backstop.

**Structured outputs (the big one):** in bare `json_object` mode the model
never sees the schema, so OpenRouter/Groq models fail zod validation on
ChatTurnSchema almost every time ("No object generated"). Turn on
`supportsStructuredOutputs: true` AND forward
`providerOptions: { <providerName>: { strictJsonSchema: false } }` — the
adapter defaults strict:true, which OpenAI and Groq reject for schemas with
optional props / unions / missing additionalProperties:false. Verified live:
openai, qwen, deepseek, groq all pass with json_schema+non-strict.

**How to apply:** new OpenAI-compatible provider → set both flags (except
Anthropic); `RouterProvider.providerOptions` is forwarded by routedGenerate.
Also: `npm install <new pkg>` can prune the root `@tanstack/router-core`
(it wasn't in the lockfile) — it's now an explicit exact dep; re-check after
any install and run prod-build (kill tsserver first if it OOMs silently).
