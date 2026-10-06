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
- Always give selectable options (choice/boolean queries) when asking questions — never a blank text box.
- **Build it the way the owner describes it, not the way you would design it.** When the
  owner supplies a reference, a screenshot, or a written spec, follow it. If something in
  the spec looks wrong or is missing, ask — do not silently substitute your own layout,
  styling, or feature choices.
- **Do not spin up a new app/artifact for a feature that belongs in the main app.** Extra
  standalone copies have repeatedly accumulated and then had to be deleted. Add to the
  existing app unless the owner explicitly asks for a separate one.

## Cross-artifact sync rule

Every task must be propagated across all artifacts before it is considered done. The full list of artifacts + root:

1. `root src/` — shared app (TanStack Start, main Aurora Studio)
2. `artifacts/web` — Aurora (flat-root alias, same process as root src/)
3. `artifacts/aurora-adult` — Adult School
4. `artifacts/aurora-colors` — Aurora Colors Studio
5. `artifacts/ugc-line` — Aurora Content Line
6. `artifacts/video-agent` — Aurora Video Agent
7. `artifacts/perform-anywhere` — Perform Anywhere
8. `artifacts/aurora-mobile` — Aurora Studio (Expo mobile)

**Checklist before finishing any task:**

1. **Identify scope** — determine whether the change is shared (touches Supabase schema, auth, shared UI tokens, pricing, API contracts) or artifact-specific (touches only one app's UI or pipeline).
2. **Apply shared changes at root** — schema migrations, shared lib functions, CSS tokens, and API server functions live in root `src/`; change them once there, not in individual artifacts.
3. **Propagate artifact-specific fixes to siblings** — if a bug or feature exists in one artifact's standalone code (e.g. a Supabase query, a component pattern, a nav item), check every other artifact for the same issue and fix it there too.
4. **Never leave one artifact behind** — do not close a task if any artifact still shows the old behaviour, a broken import, or a missing feature that the others already have.
5. **Confirm TypeScript compiles across all** — after changes, run `tsc --noEmit` (or equivalent) in every affected artifact directory and in the root; zero new errors before marking complete.

## Tutorial PDF

The downloadable tutorial PDF is a static Playwright snapshot of `/tutorial`. It lives at three locations that must always be identical:

```
public/tutorial-guide.pdf
public/Aurora-Studio-Tutorial-Guide.pdf
artifacts/web/public/Aurora-Studio-Tutorial-Guide.pdf
```

**After editing any tutorial source file** (`src/components/tutorial/*.tsx`, `tokens.ts`, or `src/routes/tutorial.lazy.tsx`), regenerate the PDF:

```bash
# 1. Make sure the dev server is running (Start application workflow on :8080)
# 2. Then:
bash scripts/regen-tutorial-pdf.sh
```

The script writes the PDF to all three locations automatically.

A CI staleness check (`tutorial-pdf` validation command) will fail if tutorial sources are newer than the PDF — run the regen script above to fix it.

## Video Agent (durable renders)

Video Agent projects are server-state, not browser-state: rows in `video_agent_projects`
(Supabase), CRUD in `src/lib/video-agent-projects.functions.ts`, rendered by the
production job queue (`video_agent_render` kind in `src/lib/jobs.server.ts`).
- Planning (script + free storyboard frames) charges nothing; the only charge point is
  the explicit "Render video" button (reserve → render → finalize; Aura auto-released
  on terminal failure).
- The editor polls the project row while a render is queued/processing — renders
  survive closing the tab.
- Queue stall alerts: `/api/public/uptime-monitor` also runs a render-queue distress
  check (eligible job queued >20 min, or a processing lock >30 min old → operator
  email; dedup state row `id='queue'` in `uptime_monitor_state`). Ops view:
  `/admin/orchestration` → "Generation queue" panel.
- Live schema check without provider spend: `bun run scripts/va-live-roundtrip.ts`.

## Vast.ai CLI / SDK (workspace tooling)

The official `vastai` CLI + Python SDK live in `.pythonlibs` (install/upgrade/repair:
`bash scripts/setup-vast-tools.sh`). The key is the `VASTAI_API_KEY` secret; the tools
expect `VAST_API_KEY`, so the setup script installs a `usercustomize.py` hook (source:
`scripts/vast-usercustomize.py`) that maps the name in-process — bare `vastai …` and
`VastAI()` just work. Never `vastai set api-key` or `--explain` (both expose the key).
Read-only commands only (`search offers`, `show …`); renting/stopping/destroying goes
through the guarded `aurora vast …` flow. Details: `docs/VAST_TOOLS.md`.

## Development principles (Karpathy Guidelines)

Apply these four principles on every code task:

### 1. Think Before Coding
- State assumptions explicitly before writing a line. If uncertain, ask.
- Present multiple interpretations when ambiguity exists — never pick silently.
- Push back when a simpler approach exists.
- Stop and name what is confusing rather than guessing forward.

### 2. Simplicity First
- Write the minimum code that solves the problem. Nothing speculative.
- No features beyond what was asked. No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- If 200 lines could be 50, rewrite it.
- Ask: "Would a senior engineer call this overcomplicated?" If yes, simplify.

### 3. Surgical Changes
- Touch only what the task requires. Don't "improve" adjacent code.
- Don't refactor things that aren't broken. Match existing style.
- If unrelated dead code is noticed, mention it — don't delete it.
- Remove imports/variables/functions that YOUR changes made unused.
- Every changed line must trace directly to the user's request.

### 4. Goal-Driven Execution
- Transform tasks into verifiable goals before starting.
- For multi-step tasks, state a brief plan with explicit verify steps.
- Loop until the stated success criteria are met — don't stop at "looks right".
- Prefer writing a test that reproduces a bug before fixing it.
