---
name: Keep secrets out of code
description: Use this skill whenever wiring up an API key, token, password, database URL, OAuth client secret, or any credential, and before every commit or publish.
---
**Activation:** On-demand — fires when wiring a credential or before commit/publish. Agent-actionable: it moves secrets to env/Secrets and scans the diff itself.

# Instructions

A leaked credential is one of the most expensive mistakes an app can make. Secrets must never appear as literals in code, in config committed to git, or in anything sent to the browser.

- Store every secret in an environment variable. On Replit, use Secrets. Read the value at runtime; never paste the literal into source.
- Before committing or publishing, review the changes for hardcoded credentials: API keys, tokens, passwords, private keys, and connection strings that contain a password. If you find one, move it to a Secret and replace it with an environment-variable reference.
- Never put a secret anywhere that reaches the browser: client-side JavaScript, values bundled into the frontend, `localStorage`, `sessionStorage`, cookies without HttpOnly+Secure, HTML, or API responses. If a third party (payments, a model API, a database) needs a secret, the call must happen on the server, not the client.
- If a real secret was already committed, removing it from the latest change is not enough — it remains in git history and must be treated as compromised. Rotate it at the provider (revoke and reissue) and tell the user it was exposed and rotated. Do not claim it is simply "removed."

When done, confirm that no credential is hardcoded and that every secret is referenced from an environment variable / Secret.
