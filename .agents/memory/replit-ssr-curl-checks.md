---
name: SSR curl checks in this repl
description: How to verify server-rendered HTML from the shell in this Aurora repl when curl to the public dev domain comes back empty.
---

To inspect rendered/SSR HTML from the bash tool, curl the **local Vite server** at
`http://localhost:8080/<route>` (the workflow runs `vite dev --port 8080`).

- `curl $REPLIT_DEV_DOMAIN/<route>` returns **0 bytes** — the public preview is an
  mTLS-protected proxy, so an unauthenticated curl gets nothing. Don't trust an empty
  result there as "the markup is missing"; re-check against localhost.
- Writing the response to a file from the bash tool fails (`curl -o /tmp/x.html` and
  even `-o .local/x.html` → "No such file or directory"). Capture into a shell variable
  instead: `html=$(curl -s http://localhost:8080/route); echo "$html" | grep ...`.
  (The `write`/`edit` tools can still create files normally — this only affects
  shell-created files.)

**Why:** cost several failed verification attempts before realizing the dev-domain
empties and shell file writes were the problem, not the code.
**How to apply:** any time you want to grep server-rendered HTML (checking a component
SSRs, an element is hidden on a route, etc.), hit localhost:8080 and keep output in a var.
