# Kaggle notebook worker (free GPU: lipsync, optional motion)

Use Kaggle's free GPU (~30 hrs/week, T4 16 GB / P100 16 GB) as an Aurora backend.
The worker serves the `custom` `/generate` contract behind a **stable ngrok tunnel**
and **registers itself** in Admin → Workers on every boot — no dashboard edits.

> **Free-tier fit:** the launcher installs **lipsync (LatentSync)** only by default,
> which fits a 16 GB GPU. `motion` (MimicMotion + SVD) needs ~24 GB VRAM and ~25 GB
> disk, so on Kaggle `setup.sh` refuses to install it (loud error) instead of
> OOMing mid-job.

## 1 · One-time accounts + secrets

Create a free [ngrok](https://ngrok.com) account and claim a free static domain,
then add these in the Kaggle notebook under **Add-ons → Secrets**:

| secret | required | where to get it |
| ------ | -------- | --------------- |
| `NGROK_AUTHTOKEN` | yes | ngrok dashboard → *Your Authtoken* (`dashboard.ngrok.com/get-started/your-authtoken`) |
| `NGROK_STATIC_DOMAIN` | yes | ngrok dashboard → *Domains* → claim a free static domain, e.g. `foo-bar.ngrok-free.app` (`dashboard.ngrok.com/domains`) |
| `AURORA_URL` | yes | your Aurora app base URL, e.g. `https://your-app.replit.app` |
| `AURORA_REGISTER_KEY` | yes | your Supabase **anon / publishable** key (Supabase → Project Settings → API → `anon public`). This is the `apikey` the register endpoint expects — **never** the service-role key. |
| `AURORA_WORKER_TOKEN` | optional | any random string (e.g. `openssl rand -hex 16`); if set, Aurora must send it as the `/generate` bearer. |
| `AURORA_TASKS` | optional | `lipsync` (default) or `lipsync,motion` (only on a ≥24 GB GPU). |
| `AURORA_WORKER_REPO_RAW` | optional | for a renamed repo, a non-default branch, or a public mirror: set it to your raw base, e.g. `https://raw.githubusercontent.com/OWNER/REPO/BRANCH/workers`. **A private repo won't fetch over raw URLs** — upload `aurora_worker.py` + `setup.sh` to the notebook instead. |

> Kaggle Secrets are **not** environment variables — the launcher reads them via
> `UserSecretsClient` and mirrors them into the environment for you.

## 2 · Run

**Option A — one cell (paste):**
1. New Kaggle Notebook → **Settings**: Accelerator = **GPU** (T4 ×2 or P100), Internet = **ON**.
2. Add the secrets above.
3. Paste the contents of [`aurora_worker_kaggle.py`](./aurora_worker_kaggle.py) into a cell and run it.

**Option B — import the notebook:**
1. **File → Import Notebook** and upload [`aurora_worker_kaggle.ipynb`](./aurora_worker_kaggle.ipynb).
2. Set Accelerator = GPU + Internet = ON, add the secrets, then **Run All**.

The launcher fetches the shared worker core (`aurora_worker.py`) and `setup.sh`
from your **public** repo automatically, installs the chosen task(s), opens the
tunnel, and registers. (Private repo? See `AURORA_WORKER_REPO_RAW` in the table —
upload the two files to the notebook instead.)

## 3 · Confirm it worked (round-trip)

1. The cell prints `[register] OK — https://<your-domain>/generate registered with Aurora.`
   and `Worker live (protocol=custom, caps=lipsync): … /generate`.
2. In Aurora, open **Admin → Workers**: the worker shows **Active** with capability
   `lipsync` and a fresh heartbeat.
3. Dispatch a **Lip-sync** job (pick *LatentSync (self-hosted)*) from Aurora; it
   routes to this worker and returns a result URL. The Kaggle cell logs the
   incoming `POST /generate`.

Keep the Kaggle tab open — the session stops when the tab closes or the weekly GPU
quota runs out. On restart, just re-run the cell: the same static domain re-registers
the same row (Aurora de-dupes on the normalized URL), so the endpoint never goes stale.

## Notes

- **Results upload** defaults to `catbox.moe` (no account). To store results in your
  own bucket instead, add `AURORA_UPLOAD=supabase` plus `SUPABASE_URL` and
  `SUPABASE_SERVICE_ROLE_KEY` secrets.
- **No static domain?** If you skip `NGROK_STATIC_DOMAIN`, the worker still runs but
  the tunnel URL changes every restart — you'd then have to update Admin → Workers
  by hand each time. Claim the free domain to avoid that.
- **Worker registers but never gets dispatched a job?** Registration only creates
  the `gpu_workers` row — the app still needs a recurring `pg_cron` job hitting
  `POST /api/public/jobs/tick` (drains the queue) and `POST /api/public/workers/health`
  (keeps `active`/`paused` status accurate), because Replit autoscale has no durable
  in-process timer. If `Admin → Workers` shows your worker but jobs never move past
  `queued`, check with the app owner that these two cron jobs exist on the Supabase
  project (see `docs/ARCHITECTURE.md` → "Wiring pg_cron") — a fresh Supabase project
  does **not** have `pg_cron`/`pg_net` enabled or the jobs scheduled by default.
