# Deployment and runtime boundaries

## Canonical release target

The supported production target for Aurora is the Replit Node server produced
by the Vite/Nitro build. It binds `process.env.PORT` and serves both SSR and
the built client assets. The Replit `prod-build` workflow is the release build
check.

```sh
NODE_OPTIONS=--max-old-space-size=4608 \
  bash scripts/replit-node.sh node_modules/vite/bin/vite.js build
```

Run the same command locally and in CI with:

```sh
npm run production:gate
```

Do not deploy the development server or the `node_modules/.nitro` working
directory directly.

## Cloudflare compatibility

`wrangler.jsonc` and the Cloudflare Vite plugin remain available for
experimentation, but they are not the canonical release path. Native media
routes (`sharp`, ffmpeg/child-process helpers, and local worker-file access)
are explicitly Node-only. `node scripts/ci/audit-worker-entry.mjs` guards that
boundary so a future Worker build cannot accidentally pull those imports into
shared code.

If Cloudflare Workers becomes a release target, move those routes to a separate
Node media service or replace their native processing with a Worker-compatible
provider before enabling automatic deployment.

## GitHub Actions

`.github/workflows/ci.yml` runs lint, typecheck, unit tests, the Worker-boundary
audit, and the production build on pushes and pull requests. It also runs the
Playwright suite when the repository's Supabase staging secrets are available:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_PUBLISHABLE_KEY`

Fork pull requests skip the secret-dependent E2E job rather than exposing
credentials. The quality job still runs.

There is intentionally no automatic Play Console submission workflow. Android
releases are uploaded manually in Google Play Console from the versioned AAB
in `artifacts/aurora-mobile/store/builds/`.