# Security and secrets

Secrets are injected by the runtime and must never be committed, copied into
client code, or printed in logs. Use Replit Secrets for the app and GitHub
Actions Secrets only for CI jobs that genuinely require a value.

## Important server secrets

| Secret | Use |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | server-side database/admin operations |
| `SUPABASE_PUBLISHABLE_KEY` | public Supabase client and ordinary maintenance endpoints |
| `INTER_APP_API_KEY` | private internal calls, including the durable account-deletion sweep |
| `SENTRY_DSN` | optional server-side exception reporting |
| provider keys | AI, payments, storage, and worker integrations |

The account-deletion sweep is privileged: it purges storage and database rows
after authentication has already been removed. It accepts only
`x-aurora-internal-key: $INTER_APP_API_KEY`, never the public Supabase key.

Rotate a secret in the platform secret manager, restart the affected workflow,
and verify the corresponding 401/200 smoke checks. Never paste a token into
chat, source files, issue descriptions, or test output.