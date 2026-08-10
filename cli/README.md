# Aurora Studio CLI

Generate cinematic music-video shots from your terminal.

## Install

```bash
npm install -g aurora-studio
```

Or run once without installing:

```bash
npx aurora-studio generate --prompt "subject on a rooftop, golden hour, anamorphic"
```

## Quick start

```bash
aurora login                                        # paste API key from dashboard
aurora estimate --kind video --seconds 5            # check live Aura cost (no generation)
aurora generate --prompt "neon street scene" --out shot.png
aurora generate --prompt "neon street scene" --dry-run
aurora whoami
aurora help
```

## Commands

| Command | Description |
|---|---|
| `aurora login` | Save your API key to `~/.aurora/config.json` |
| `aurora generate --prompt "..." [--out file.png]` | Render a shot |
| `aurora generate --prompt "..." --dry-run` | Show the live Aura price for the image request without rendering |
| `aurora estimate --kind <kind> [...]` | Ask Aurora’s server for a live price without rendering or reserving Aura |
| `aurora whoami` | Show the active account |
| `aurora version` | Print CLI version |
| `aurora help` | Show help |

## Environment

- `AURORA_API_BASE` — override the API base (default: `https://aurora-sparkle-charm.lovable.app`)

## Preview a price before you render

Use `estimate` to ask the server for the current Aura cost. It calls
`GET /api/estimate`, which is side-effect-free: it does not create a generation,
reserve Aura, or contact a generation provider.

```bash
# Use the same pricing inputs you will send when generating.
aurora estimate --kind video --resolution 720p --seconds 5 --model seedance-2.0
aurora estimate --kind lipsync --resolution 720p --seconds 8 --video-url https://example.com/input.mp4

# The image command also has a convenient dry-run alias.
aurora generate --prompt "neon street scene" --dry-run
```

`estimate` accepts `--kind`, `--resolution`, `--seconds` (or `--duration`),
`--model`, `--audio-url`, `--video-url`, `--motion`, `--features`, and
`--confirm-preview-id`. Pass the same values to your paid generation request so
the estimate reflects its billable features. Video and lip-sync requests without a
confirmation ID are priced as the required 480p/≤5s preview, exactly as the paid
endpoint will run them. After that preview succeeds, pass its generation ID as
`--confirm-preview-id` to price full quality. If you are signed in, the CLI sends
your API key for tier-aware checks; an unauthenticated estimate still returns a
price but cannot include plan-specific limits.

## Public generation API

Preview cost with `GET /api/estimate` before posting to
`POST /api/public/generate`. The estimate endpoint accepts these query parameters:
`kind` (required), `resolution`, `duration`, `model`, `audioUrl`, `videoUrl`,
`cameraMovement`, comma-separated `features`, and `confirmPreviewId`. For video
and lip-sync, omit `confirmPreviewId` to estimate the required preview pass; use a
successful preview generation ID to estimate the matching full-quality request.

```bash
BASE="${AURORA_API_BASE:-https://aurora-sparkle-charm.lovable.app}"

# Safe to call repeatedly: no paid job is created.
curl -sG "$BASE/api/estimate" \
  -H "Authorization: Bearer $AURORA_API_KEY" \
  --data-urlencode "kind=video" \
  --data-urlencode "resolution=720p" \
  --data-urlencode "duration=5" \
  --data-urlencode "model=seedance-2.0"

# Send the same pricing inputs when you begin the paid request.
curl -sX POST "$BASE/api/public/generate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AURORA_API_KEY" \
  -d '{"kind":"video","prompt":"neon street scene","resolution":"720p","duration":5,"model":"seedance-2.0"}'
```

## Vast.ai GPU lifecycle (owner only)

Admins can rent, monitor, and destroy Aurora-managed Vast.ai GPU workers
straight from the CLI. Guardrails are enforced server-side and cannot be
bypassed by the CLI:

- **Price ceiling:** never rents above **$0.35/hour**.
- **Runtime cap:** every managed instance is **auto-destroyed after 1 hour**
  by the Aurora cron, even if you forget about it.
- **Explicit confirmation:** renting requires a confirm token from
  `aurora vast search` *and* an interactive "yes" — no single-command billing.
- **Scope:** `stop`/`destroy` only work on instances Aurora created or that
  you explicitly adopted. Manually rented boxes are never touched.
- No SSH keys or Vast passwords are ever stored; provisioning uses the
  standard worker bootstrap + self-registration (first time = pending
  approval in Admin → Workers).

```bash
# 1. Find offers under the ceiling (each line includes a ready-to-run command)
aurora vast search --min-vram 16

# 2. Rent one (prompts for confirmation; billing starts on YOUR Vast account)
aurora vast up --offer 12345 --price 0.2000 --token <token-from-search>

# 3. Watch bootstrap → registration → approval
aurora vast status

# Adopt an instance you already rented manually so Aurora manages its lifetime
aurora vast adopt --instance 9001234

# Stop (still accrues storage cost) or destroy (ends billing)
aurora vast stop --instance 9001234
aurora vast destroy --instance 9001234
```

Requires: admin account, `VASTAI_API_KEY` set in Aurora's server secrets.
**Important:** Vast requires Two-Factor Authentication for instance operations —
enable 2FA on the Vast account, then regenerate the API key (a key created
before 2FA can search offers but cannot rent/stop/destroy).
Managed instances also appear in **Admin → Orchestration → Managed Vast.ai
instances** with their destroy deadlines.

## Get an API key

Open [your dashboard](https://aurora-sparkle-charm.lovable.app/dashboard) and copy your key, or just run `aurora login` and approve in the browser.

## License

MIT
