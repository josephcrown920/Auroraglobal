# Colab notebook worker (free GPU: lipsync, optional motion on Pro+)

Use a Colab GPU as an Aurora backend. The worker serves the `custom` `/generate`
contract behind a **stable ngrok tunnel** and **registers itself** in Admin → Workers
on every boot — no dashboard edits. This mirrors `workers/kaggle/` exactly; only the
secrets API (`google.colab.userdata` instead of `kaggle_secrets`) and root dir
(`/content` instead of `/kaggle/working`) differ.

> **Free-tier fit:** the launcher installs **lipsync (LatentSync)** only by default,
> which fits any Colab GPU including the free T4. `motion` (MimicMotion + SVD) needs
> ~24 GB VRAM and ~25 GB disk — that's a **Colab Pro+ A100**, not the free tier — so
> on a smaller card `setup.sh` refuses to install it (loud error) instead of OOMing.

## 1 · One-time accounts + secrets

Create a free [ngrok](https://ngrok.com) account and claim a free static domain,
then add these in Colab's **Secrets** panel (key icon, left sidebar) — toggle
**notebook access ON** for each one, or Colab won't let this notebook read it:

| secret | required | where to get it |
| ------ | -------- | --------------- |
| `NGROK_AUTHTOKEN` | yes | ngrok dashboard → *Your Authtoken* (`dashboard.ngrok.com/get-started/your-authtoken`) |
| `NGROK_STATIC_DOMAIN` | yes | ngrok dashboard → *Domains* → claim a free static domain, e.g. `foo-bar.ngrok-free.app` (`dashboard.ngrok.com/domains`) |
| `AURORA_URL` | yes | your Aurora app base URL, e.g. `https://your-app.replit.app` |
| `AURORA_REGISTER_SECRET` | yes | a private secret **you generate** (e.g. `openssl rand -hex 32`) and set as `AURORA_REGISTER_SECRET` in Aurora's env too. This is the `apikey` the register endpoint expects — **never** the Supabase anon/publishable or service-role key, since those are not private. |
| `AURORA_WORKER_TOKEN` | optional | any random string (e.g. `openssl rand -hex 16`); if set, Aurora must send it as the `/generate` bearer. |
| `AURORA_TASKS` | optional | `lipsync` (default, any free GPU) or `lipsync,motion` (only on a ≥24 GB GPU — Colab Pro+ A100). |

> Colab Secrets are **not** environment variables — the launcher reads them via
> `google.colab.userdata` and mirrors them into the environment for you.

## 2 · Run

**Option A — one cell (paste):**
1. New Colab notebook → **Runtime → Change runtime type** → Hardware accelerator = **GPU**.
2. Add the secrets above (toggle notebook access ON for each).
3. Paste the contents of [`aurora_worker_colab.py`](./aurora_worker_colab.py) into a cell and run it.

**Option B — import the notebook:**
1. **File → Upload notebook** and upload [`aurora_worker_colab.ipynb`](./aurora_worker_colab.ipynb).
2. Set Hardware accelerator = GPU, add the secrets, then **Runtime → Run all**.

The launcher fetches the shared worker core (`aurora_worker.py`) and `setup.sh`
directly from your Aurora app (no GitHub access or public repo needed), installs
the chosen task(s), opens the tunnel, and registers.

## 3 · Confirm it worked (round-trip)

1. The cell prints `[register] OK — https://<your-domain>/generate registered with Aurora.`
   and `Worker live (protocol=custom, caps=lipsync): … /generate`.
2. In Aurora, open **Admin → Workers**: the worker shows **Active** with capability
   `lipsync` and a fresh heartbeat.
3. Dispatch a **Lip-sync** job (pick *LatentSync (self-hosted)*) from Aurora; it
   routes to this worker and returns a result URL. The Colab cell logs the
   incoming `POST /generate`.

Keep the Colab tab open — the session stops when the tab closes or Colab reclaims the
runtime (free-tier sessions are capped and lower priority than Pro/Pro+). On restart,
just re-run the cell: the same static domain re-registers the same row (Aurora
de-dupes on the normalized URL), so the endpoint never goes stale.

## Notes

- **Results upload** defaults to `catbox.moe` (no account). To store results in your
  own bucket instead, add `AURORA_UPLOAD=supabase` plus `SUPABASE_URL` and
  `SUPABASE_SERVICE_ROLE_KEY` secrets.
- **No static domain?** If you skip `NGROK_STATIC_DOMAIN`, the worker still runs but
  the tunnel URL changes every restart — you'd then have to update Admin → Workers
  by hand each time. Claim the free domain to avoid that.
- **Prefer running stock ComfyUI instead?** This same free GPU can join the
  **ComfyUI swarm** (`image`/`video`/`lipsync`/`motion` via the `comfyui` protocol)
  using [`workers/comfyui/aurora_comfyui_launcher.py`](../comfyui/aurora_comfyui_launcher.py)
  instead of this file — see [`workers/comfyui/README.md`](../comfyui/README.md).
  Use whichever one you'd rather operate; they aren't meant to run at the same time
  on the same GPU.
- **Worker registers but never gets dispatched a job?** Registration only creates
  the `gpu_workers` row — the app still needs a recurring `pg_cron` job hitting
  `POST /api/public/jobs/tick` (drains the queue) and `POST /api/public/workers/health`
  (keeps `active`/`paused` status accurate), because Replit autoscale has no durable
  in-process timer. If `Admin → Workers` shows your worker but jobs never move past
  `queued`, check with the app owner that these two cron jobs exist on the Supabase
  project (see `docs/ARCHITECTURE.md` → "Wiring pg_cron") — a fresh Supabase project
  does **not** have `pg_cron`/`pg_net` enabled or the jobs scheduled by default.
- **Getting `[register] failed 401: {"error":"Unauthorized"}`?** This means the
  `AURORA_REGISTER_SECRET` your notebook sent doesn't byte-for-byte match the one set
  in Aurora's environment — almost always because the two were typed/pasted separately
  instead of generating one value and copying it into both places. Nobody (including
  the app owner) can *read back* the value already configured on either side, so
  compare **fingerprints** instead of the raw secret:
  1. The cell prints `[register] using AURORA_REGISTER_SECRET fingerprint <8 hex chars>`
     right before it tries to register.
  2. Open **Admin → Workers → Recent registration attempts** in Aurora: a failed
     attempt now logs `received fp:<xxxxxxxx> expected fp:<yyyyyyyy>`.
  3. If your cell's fingerprint matches "received fp" but not "expected fp", the
     value set in Aurora's `AURORA_REGISTER_SECRET` is the stale/wrong one — the app
     owner needs to update it (Replit → Secrets pane) to the same value you're using.
  4. If it's simplest, just generate ONE fresh value (`openssl rand -hex 32`), set it
     as `AURORA_REGISTER_SECRET` in **both** Colab's Secrets panel and Aurora's Replit
     Secrets pane, then re-run the cell.
