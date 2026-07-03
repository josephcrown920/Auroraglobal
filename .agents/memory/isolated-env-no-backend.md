---
name: Isolated-env backend provisioning varies by task
description: Don't assume task-agent containers lack backend/provider creds — check per-session, it varies.
---

Earlier sessions found a bare Replit sandbox for Aurora Studio with NO Supabase env and NO AI provider/payment keys, blocking all live auth/generation QA. That is **not universally true** — a later session in the same repo found `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` AND the Replit AI Integrations proxy vars (`AI_INTEGRATIONS_OPENAI_BASE_URL/_API_KEY`, `AI_INTEGRATIONS_GEMINI_BASE_URL/_API_KEY`) genuinely live and callable (confirmed via direct curl smoke tests returning real 200s).

**Why:** provisioning is per-session/per-container, not a fixed property of "isolated task-agent env for this repo" — trusting a stale absence-of-creds memory could make you skip real, cheap, high-value verification (like a direct proxy smoke call) that was actually available.
**How to apply:** at the start of any task that might need backend/provider creds, check with `node -e "console.log(!!process.env.X)"` for the specific vars you need rather than assuming they're absent. If genuinely absent, `providerStatus`/`supabase.auth` will fail fast and confirm it. If present, prefer real smoke tests over skipping verification — but avoid writes to real Supabase tables / real paid generations beyond a minimal, justified smoke call, since data and billing effects are real.
