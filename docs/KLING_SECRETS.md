# Managing Kling Secrets Securely

Kling AI uses a pair of credentials — an **access key** and a **secret key** — that are combined to sign short‑lived JWTs for each API call. They must never be committed to git, never appear in client bundles, and never be hard‑coded.

## 1. Where to get them

1. Sign in at <https://app.klingai.com/global/dev/document-api>
2. Open **API Management → AccessKey & SecretKey**
3. Copy:
   - `Access Key ID` → store as `KLING_ACCESS_KEY`
   - `Secret Key`    → store as `KLING_SECRET_KEY`

## 2. Where to store them (Lovable Cloud)

Secrets live in **Lovable Cloud → Project Settings → Secrets** (backed by Supabase Edge Function Secrets). They are injected as `process.env.*` in server code at runtime and are **never bundled into the browser**.

To add or rotate:

1. Open the project in Lovable
2. Cloud view → **Secrets** (or ask the agent: "update KLING secrets")
3. Add / update:
   - `KLING_ACCESS_KEY`
   - `KLING_SECRET_KEY`
4. Save. Server functions pick up the new value on the next invocation — no redeploy needed.

> Do **not** put these in `.env`, `.env.local`, or any committed file. The project `.env` only holds public `VITE_SUPABASE_*` values.

## 3. Rotation policy

- Rotate every 90 days, or immediately if a key is suspected to be leaked.
- Generate a new pair in the Kling dashboard **before** deleting the old one to avoid downtime.
- Update both secrets in Lovable Cloud in the same save, then revoke the old pair in Kling.

## 4. Where they are used in the code

Kling is currently invoked through the **fal.ai gateway** (signed by `FAL_KEY`), not by direct Kling JWTs. The dedicated `KLING_ACCESS_KEY` / `KLING_SECRET_KEY` pair is reserved for direct Kling calls (e.g. when we bypass fal for cost or feature parity).

| File | Purpose |
| --- | --- |
| `src/lib/fal.server.ts` | Reads `FAL_KEY` and submits jobs to `fal-ai/kling-video/v2.1/master/image-to-video` |
| `src/lib/orchestrator.server.ts` | Routes `kling-3.0` and `kling-3.0-omni` model keys to the Kling endpoint |
| `src/lib/studio.functions.ts` | Server function that the Studio page calls; handles `endFrameUrl` for Kling start→end motion control |
| `src/lib/models.ts` | Public model catalogue (labels, costs, capabilities) |
| `src/routes/studio.tsx` | UI surface that exposes the Kling end‑frame field |

When direct Kling access is added, the helper that signs the JWT must:

```ts
// server only — never import from a client component
const accessKey = process.env.KLING_ACCESS_KEY;
const secretKey = process.env.KLING_SECRET_KEY;
if (!accessKey || !secretKey) throw new Error("Kling credentials not configured");
```

…and live in a `*.server.ts` file (e.g. `src/lib/kling.server.ts`) so Lovable's import protection blocks it from the browser bundle.

## 5. Git hygiene

`.gitignore` blocks all of these patterns so Kling credentials cannot be committed accidentally:

```
.env
.env.*
!.env.example
*.env
*.env.local
secrets.json
secrets.*.json
kling.json
kling.*.json
**/kling-credentials*
```

The only env-shaped file allowed in git is [`.env.example`](../.env.example), which documents the variable names and expected formats with placeholder values only. If you ever need to share a real key, use Lovable Cloud → Secrets or a password manager — never paste it in chat, code, docs, or commit messages.

## 6. Checklist before shipping

- [ ] Secrets exist in Lovable Cloud → Secrets (`KLING_ACCESS_KEY`, `KLING_SECRET_KEY`)
- [ ] No occurrence of either key in `git grep` / repo history (`git log -p -S KLING_`)
- [ ] All Kling calls happen in `*.server.ts` or inside a `createServerFn` handler
- [ ] `.env.example` updated if a new Kling-related variable is introduced
- [ ] Rotation reminder set (calendar / password manager)

