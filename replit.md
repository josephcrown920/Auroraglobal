# Aurora Performance Studio

AI creative studio for artists, performers, and labels. Generate cinematic performance shots, music-video stills, lip-sync clips, and UGC ads — all powered by AI with a credit-based economy and Paystack monetization.

## Run & Operate

- `pnpm --filter @workspace/aurora-studio run dev` — run the frontend (auto-managed via workflow)
- `pnpm --filter @workspace/api-server run dev` — run the API server (auto-managed via workflow)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY` — auto-provisioned via Clerk
- Optional env: `PAYSTACK_SECRET_KEY` — for real payment checkout (Paystack NGN); required for `/api/paystack/webhook` to credit users automatically
- Optional env: `FAL_KEY`, `KLING_API_KEY`, `SEEDANCE_API_KEY`, `SYNC_API_KEY`, `HEYGEN_API_KEY`, `REPLICATE_API_TOKEN` — AI provider keys

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite, Wouter, TanStack Query, Tailwind CSS v4, Framer Motion
- Auth: Clerk (Replit-managed, auto-provisioned)
- API: Express 5 (at `/api`)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec at `lib/api-spec/openapi.yaml`)
- Payments: Paystack (NGN credit top-ups)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/aurora-studio/` — React + Vite frontend
- `artifacts/aurora-studio/src/pages/` — page components (landing, dashboard, studio, motion, lipsync, ugc, music-video, gallery, settings, pricing)
- `artifacts/api-server/src/routes/` — API route handlers (me, dashboard, gallery, generate, credits, providers)
- `artifacts/api-server/src/lib/auth.ts` — Clerk auth middleware + JIT user provisioning
- `lib/db/src/schema/` — Drizzle schema (users, generations, credit_transactions)
- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth)
- `lib/api-client-react/src/generated/` — generated React Query hooks

## Product

- **Landing page** (`/`) — Public hero, features, pricing tiers, CTAs
- **Colors Studio** (`/studio`) — AI photo generation with style/aspect/provider controls
- **Video Agent** (`/motion`) — Motion transfer video generation (Kling/Seedance/fal)
- **Lip Sync Studio** (`/lipsync`) — Frame-perfect AI lip-sync (Sync.so / HeyGen)
- **Music Video Studio** (`/music-video`) — Beat-synced music video generation
- **UGC Factory** (`/ugc`) — AI UGC ad clips with avatar styles
- **Gallery** (`/gallery`) — Full library with filters, favorites, downloads
- **Dashboard** (`/dashboard`) — Credits, usage stats, recent generations
- **Settings** (`/settings`) — Profile, credit history, buy credits (Paystack)
- **Pricing** (`/pricing`) — Public credit packages page

## Credit Economy

- New users: 50 free credits on signup
- Photo generation: 2 credits
- Video generation: 10 credits
- Lip-sync: 8 credits
- UGC: 6 credits
- Music video: 12 credits
- Packages: Starter (100 credits / ₦2,500), Creator (500 / ₦10,000), Pro (1,200 / ₦20,000), Studio (3,000 / ₦45,000)

## Architecture decisions

- Clerk auth is cookie-based on web — no Authorization headers needed for browser requests
- JIT user provisioning in `getOrCreateUser()` — DB row created on first `/api/me` call
- Generation processing is async — client polls `/api/generate/:id` every 2s until status = completed/failed
- Credit deduction uses SQL `GREATEST(0, credits - cost) WHERE credits >= cost` to prevent races
- Paystack checkout uses NGN (kobo) — falls back to demo URL if `PAYSTACK_SECRET_KEY` is not set
- Provider keys are optional — `/api/providers/status` shows which are configured

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After any OpenAPI spec change: run `pnpm --filter @workspace/api-spec run codegen` then `pnpm run typecheck:libs` before touching server routes. The `codegen` command includes a post-processing step (`lib/api-spec/scripts/post-process-codegen.mjs`) that patches Orval's `react-query` output to be compatible with TanStack Query v5 (`UseQueryOptions` requires `queryKey`/`queryFn` in v5, but Orval supplies them itself).
- Clerk proxy middleware must be mounted BEFORE body parsers in `app.ts` (it streams raw bytes)
- The `tailwindcss({ optimize: false })` in `vite.config.ts` is required for Clerk themes to work correctly in production builds
- `@layer theme, base, clerk, components, utilities;` must come BEFORE `@import 'tailwindcss';` in index.css for Clerk styling

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See the `clerk-auth` skill for auth setup and customization
