# Aurora Global — Release Readiness

Use this document as the final handoff checklist after code changes are complete.

## Verified in code

- GitHub Actions quality gate runs the repository's `production:gate` on pull requests and pushes to both `main` and `Main`.
- Playwright E2E suites that require Supabase credentials skip cleanly when those credentials are not injected; with credentials present they still provision their temporary admin users and execute normally.
- The CLI publish workflow now follows both `main` and `Main` so branch-name casing cannot silently prevent releases.
- Aurora Soul already has a pinned direct Seedance adapter (`model === "seedance-soul"`) and the UI explicitly identifies `SEEDANCE_API_URL` / `SEEDANCE_API_KEY` as owner configuration.
- The Soul fal webhook unit test uses a local JWKS fixture rather than requiring the live fal JWKS endpoint during tests.

## Owner-controlled release gates

These cannot be completed by repository code alone:

1. Provide valid production Supabase secrets to the E2E workflow.
2. Provide `SEEDANCE_API_URL` and `SEEDANCE_API_KEY` in the runtime secret store if Soul video generation is to be enabled.
3. Confirm any provider-specific integration secrets in the deployment environment.
4. Run the production deployment/redeploy in Replit and verify the live deployment.
5. Approve the final Publish action where Replit requires an interactive owner approval.
6. Run a staging/live E2E pass after secrets are available.

## Explicitly deferred architecture work

- Large audio upload streaming: current `/api/audio/upload` intentionally accepts up to 200 MB and buffers the file before storage upload. Replacing this safely requires a streaming/direct-to-storage design and should not be patched with a memory-bound workaround.
- Wan/GFPGAN Soul pipeline: no verified provider URL/model contract is present in the repository, so no speculative integration is enabled.
- Daily spend aggregation: the current implementation remains intentionally unbounded until a dedicated database-side aggregation migration and correctness tests prove that a faster implementation cannot undercount spend.

## Final acceptance

The project should be called Production Complete only after the deterministic code gate is green **and** the owner-controlled deployment/provider gates above are confirmed.
