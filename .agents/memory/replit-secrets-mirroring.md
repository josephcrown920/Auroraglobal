---
name: Replit secrets mirroring
description: How to populate the same backend value into several differently-named env vars without asking the user to paste it repeatedly.
---

# Mirroring one value into multiple env-var names

Constraint: `setEnvVars` cannot write secrets, and secret *values* cannot be read back
(`viewEnvVars` only shows existence). So a value provided via `requestEnvVar` as a
**secret** cannot be copied into another env-var name by the agent.

**How to apply:** when several env-var names must hold the *same* value and the value is
public/non-sensitive (e.g. a Supabase anon/publishable key, project URL):
- Request it ONCE via `requestEnvVar({ requestType: "env" })` (env-type = readable).
- Read it back with `viewEnvVars` and `setEnvVars` it into the duplicate names.
Keep genuinely sensitive values (service_role key, provider API keys) as `requestType:
"secret"`.

Deterministic values don't need the user at all: a Supabase project URL is always
`https://<project_ref>.supabase.co` (project_ref is in `supabase/config.toml`).
