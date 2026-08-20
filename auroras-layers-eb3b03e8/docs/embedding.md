# Embedding Aurora Layers

Aurora Layers provides a full editor at `/embed`. It uses the same `LayerStudio` component as the standalone application and runs inside an iframe, so Aurora Global host styles cannot change its existing look, settings, or editor behavior.

## Required deployment settings

Set these secrets/environment variables on the Layers deployment:

```text
AURORA_EMBED_ALLOWED_ORIGINS=https://your-aurora.replit.app,https://your-production-domain.example
AURORA_EMBED_SSO_SECRET=<a-long-random-shared-secret>
```

`AURORA_EMBED_ALLOWED_ORIGINS` must contain exact HTTPS origins without a trailing
slash. Wildcards, paths, HTTP origins, and malformed values are rejected. It
controls CSP `frame-ancestors`, the API preflight allow-list, and which hosts
can exchange a session token. If it is unset, external framing and SSO are
disabled rather than falling back to a broad development allow-list.

The `/embed` page intentionally does not set `X-Frame-Options`: that header cannot safely allow selected cross-origin iframe hosts. CSP `frame-ancestors` is the modern allow-list used instead.

## Optional session sync

The host mints a single-use HMAC-SHA256 token with this JSON payload:

```json
{
  "sub": "host-user-id",
  "email": "user@example.com",
  "name": "Optional name",
  "aud": "https://your-aurora.replit.app",
  "exp": 1735689600
}
```

The token format is `base64url(payload).hex(hmac-sha256(payload))`. The `aud`
claim is required and must match the host origin exactly. `exp` must be no more
than five minutes in the future; sixty seconds is recommended. Layers stores a
digest of a successfully exchanged token, so each token can mint a session only
once. Aurora Global's `AuroraEmbed` component sends this token through
`postMessage`; it is not put into the iframe URL.

## Host integration

```tsx
<AuroraEmbed
  kind="layers"
  src="https://your-layers-domain/embed"
  ssoToken={shortLivedEmbedToken}
  title="Aurora Layers"
/>
```

The iframe reports its content height after layout changes, allowing Aurora Global to fit the full editor without iframe scrollbars or a style rewrite.

## Copy-paste host wrappers

The repository ships two host-facing wrappers:

- `public/aurora-layers-embed.js` is a dependency-free widget. Add a
  `data-aurora-layers` container with `data-src` pointing at the deployed
  `/embed` route, then load the script from the same deployment.
- `src/components/embed/AuroraLayersEmbed.tsx` is a typed React wrapper with
  automatic height sync and an optional `ssoToken` prop.

Both wrappers append `hostOrigin` to the iframe URL, validate the iframe's
origin and source window before accepting messages, and send the SSO token by
`postMessage` after the iframe emits `ready`.

```html
<div
  data-aurora-layers
  data-src="https://your-layers-domain/embed"
  data-sso-token="<short-lived-signed-token>"
></div>
<script src="https://your-layers-domain/aurora-layers-embed.js" defer></script>
```

For a minimal direct integration, a host may also load
`/embed?hostOrigin=https%3A%2F%2Fyour-aurora-domain` and send the token after
the iframe posts `{ source: "aurora-layers", type: "ready" }`. Avoid placing a
token in an iframe URL unless there is no host messaging option: the wrappers
keep it out of browser history, referrers, and server logs.

## Node host signing example

```ts
import { createHmac } from "node:crypto";

const payload = {
  sub: user.id,
  email: user.email,
  name: user.name,
  aud: "https://your-aurora-domain.example",
  exp: Math.floor(Date.now() / 1000) + 60,
};
const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
const signature = createHmac("sha256", process.env.AURORA_EMBED_SSO_SECRET!)
  .update(body)
  .digest("hex");
const token = `${body}.${signature}`;
```

Set `AURORA_EMBED_SSO_SECRET` as a secret in both the host and Layers
deployments. It must never appear in a client-side environment variable or
source file.
