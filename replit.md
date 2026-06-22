# Aurora Studio — Replit Setup

AI content/video generation app (TanStack Start + Cloudflare Workers SSR + Supabase),
originally generated in Lovable. Bun-based.

## Source of truth
This project was consolidated from 3 GitHub repos of the same Lovable app. The repo
**`aurora-sparkle-charm`** was selected as the single source of truth (most routes,
most source files, most DB migrations, newest features). The other two contributed:
- One contributed no unique code.
- One contributed a single missing feature: **Visual Edit** (one-click / prompt-based
  image edits in the gallery), which was cherry-picked in:
  - `src/components/gallery/VisualEditDialog.tsx`
  - `editGeneration` + `EditSchema` server fn in `src/lib/studio.functions.ts`
  - wired into `src/routes/gallery.tsx` (Wand2 button on image cards)

## How it runs here
- Dev server: `bunx vite dev --host 0.0.0.0 --port 8080` (workflow "Start application").
- Port 8080 maps to external 80. Must bind IPv4 (`0.0.0.0`) — the sandbox has no IPv6.
- `vite.config.ts` adds a `vite.server` block (`host: 0.0.0.0`, `allowedHosts: true`)
  so the proxied Replit preview host is accepted.
- The original Replit monorepo scaffold was moved to `.scaffold-backup/` during import.

## Backend
The app connects to a remote Supabase project (ref `bjjcpiwglvigrpixryvg`). The DB
schema, storage buckets ("studio"), auth, and RLS live in Supabase cloud, not Replit.

### Required environment variables
Set automatically (public, derived from project ref):
- `VITE_SUPABASE_URL`, `SUPABASE_URL` = `https://bjjcpiwglvigrpixryvg.supabase.co`

Must be provided by the user:
- `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_ANON_KEY`
  — all the same value: the Supabase anon/publishable key (public, RLS-enforced).
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (secret).
- `LOVABLE_API_KEY` — Lovable AI gateway key (powers image generation + Visual Edit).

### Optional, per-feature providers (only needed for those features)
- Image: `GEMINI_API_KEY`, `HF_TOKEN`, `REPLICATE_API_KEY` / `LOVABLE_CONNECTOR_REPLICATE_API_KEY`, `FAL_KEY`
- Video/avatar/lipsync: `KLING_ACCESS_KEY`, `KLING_SECRET_KEY`, `HEYGEN_API_KEY`, `SYNC_API_KEY`
- LLM routing: `OPENROUTER_API_KEY`, `OPENAI_API_KEY`
- Payments: `PAYSTACK_SECRET_KEY`
- Email: `RESEND_API_KEY`, `AURORA_FROM_EMAIL`, `SITE_URL`
- Admin panel: `ADMIN_USERNAME`, `ADMIN_PASSCODE`

## User preferences
- User is non-technical. Explain in plain language; avoid jargon.
- Goal was: pick the best of 3 repos, merge missing features, and run it fully in Replit.
