---
name: Isolated-env backend not provisioned
description: Why live QA/generation can't run in task-agent containers for this repo
---

The isolated task-agent environment for Aurora Studio is a bare Replit sandbox:
- No Supabase env (`VITE_SUPABASE_URL/_PUBLISHABLE_KEY`, `SUPABASE_URL/_PUBLISHABLE_KEY/_SERVICE_ROLE_KEY`) → `src/integrations/supabase/client.ts` throws on first access; `use-auth.tsx` calls `supabase.auth` on mount so the whole client crashes for any authed context. No login possible.
- No AI provider or payment keys (`providerStatus` returns all 9 false; no `PAYSTACK_SECRET_KEY`). No generation can run even if auth worked.
- The built-in Replit Postgres is EMPTY (0 tables) — app data lives only in Supabase.
- Web app is NOT registered as an artifact (`listArtifacts()` == []), so it's invisible in the preview pane and screenshot tooling can't target it (reachable directly on localhost:8080).

**Why:** matters for any "live QA"/"test the running app" task — don't waste cycles trying to sign in or run real generations; they will legitimately be BLOCKED.
**How to apply:** verify what IS testable (public SSR via `curl localhost:8080`, route 200s, `bun test src/`, code-level audits) and mark backend-dependent areas BLOCKED with the missing-secret reason. A live pass needs the user to provision Supabase + ≥1 provider key per modality + Paystack test key + a seeded test/admin account.
