# Vast.ai GPU worker (lipsync · motion · video)

Rent a GPU on [Vast.ai](https://vast.ai) and turn it into an Aurora backend.
No tunnel needed — Vast.ai exposes your container's port directly.
The launcher installs model weights, starts the worker, and **auto-registers**
with Aurora so jobs start flowing immediately.

## GPU tier guide

| GPU | VRAM | fits | notes |
|-----|------|------|-------|
| RTX 3090 / 4090 | 24 GB | lipsync + **motion** + assemble | best value for motion |
| A100 40 GB / 80 GB | 40–80 GB | all above + **FLUX image** | set `IMAGE_MODEL=black-forest-labs/FLUX.1-schnell` |
| RTX 4070 / 3080 Ti | 12–16 GB | **lipsync** + assemble only | set `AURORA_TASKS=lipsync,assemble` |
| H100 | 80 GB | everything | overkill, pricier |

---

## 1 · Create the Vast.ai instance

1. Go to [vast.ai/console/create](https://cloud.vast.ai/create/) and search for
   your GPU tier.
2. Click **Customize** (or use a template with PyTorch pre-installed).
3. Under **Launch Mode**, choose **Jupyter** or **SSH**.
4. **Open Ports**: add port **8000** — Vast.ai will expose it and set
   `VAST_TCP_HOST` + `VAST_TCP_PORT_8000` automatically inside the container.
5. Under **Environment Variables**, add the ones in the table below.

## 2 · Environment variables

Set these in the **Environment** panel of the instance before you launch it:

| variable | required | value |
|----------|----------|-------|
| `AURORA_URL` | ✅ | your Aurora app URL, e.g. `https://your-app.replit.app` |
| `AURORA_REGISTER_SECRET` | ✅ | generate once: `openssl rand -hex 32` — set the **same value** as `AURORA_REGISTER_SECRET` in Aurora's Replit Secrets |
| `AURORA_TASKS` | optional | `lipsync,motion,assemble` (default) — use `lipsync,assemble` on 16 GB cards |
| `AURORA_WORKER_TOKEN` | optional | `openssl rand -hex 16` — if set, Aurora sends it as the `/generate` bearer |
| `AURORA_UPLOAD` | optional | `catbox` (default, no account) or `supabase` |
| `AURORA_WORKER_NAME` | optional | display name in Admin → Workers (default: `vast-worker`) |
| `IMAGE_MODEL` | optional | `black-forest-labs/FLUX.1-schnell` on A100+ for image generation |

> **AURORA_REGISTER_SECRET** must be identical on both sides.  
> Generate it once: `openssl rand -hex 32`, then set it in:
> - Vast.ai instance env vars (here)
> - Aurora's Replit Secrets (`AURORA_REGISTER_SECRET`)

## 3 · Run the launcher

**Option A — on-start script** (runs automatically when the instance boots):

Paste the contents of [`aurora_worker_vast.py`](./aurora_worker_vast.py) into
the **On-Start Script** field in the Vast.ai instance template, then launch.

**Option B — SSH / Jupyter**:

```bash
# Inside the running instance:
apt-get install -y ffmpeg 2>/dev/null || true
python3 - << 'EOF'
import os, urllib.request
aurora_url = os.environ["AURORA_URL"].rstrip("/")
urllib.request.urlretrieve(aurora_url + "/api/public/workers/files/vast_bootstrap.py", "/workspace/aurora_worker_vast.py")
EOF
python3 /workspace/aurora_worker_vast.py
```

Or directly paste the full `aurora_worker_vast.py` content into a terminal.

## 4 · Confirm it worked

1. The launcher prints:
   ```
   [register] OK (200) — http://<host>:<port>/generate registered with Aurora.
   Worker live | protocol=vast | caps=[lipsync,motion,assemble]
   ```
2. In Aurora open **Admin → Workers** — the worker shows **Active** with a
   fresh heartbeat and your capabilities.
3. Start a **Lip-sync** or **Motion Transfer** job — it routes to this instance.

## GPU memory guide (AURORA_TASKS)

| `AURORA_TASKS` | disk | VRAM |
|----------------|------|------|
| `lipsync,assemble` | ~10 GB | 16 GB |
| `lipsync,motion,assemble` | ~30 GB | 24 GB |
| `lipsync,motion,image,assemble` | ~38 GB | 40 GB |

`setup.sh` checks VRAM and disk **before** downloading weights and exits with a
clear error if the instance is too small — it never silently OOM mid-job.

## Troubleshooting

**401 on registration**

The `AURORA_REGISTER_SECRET` on the instance doesn't match the one in Aurora's env.
Compare fingerprints — the launcher prints one when it runs, and Aurora logs the
received vs expected fingerprint in **Admin → Workers → Recent registration attempts**:

```
[register] using AURORA_REGISTER_SECRET fingerprint ab12cd34
```

If the two 8-char hex prefixes don't match, regenerate: `openssl rand -hex 32` and
update **both** Vast.ai env + Aurora's Replit Secrets.

**Jobs stay `queued` even though worker shows Active**

Registration creates the row, but jobs only drain if two `pg_cron` jobs exist on
the Supabase project: `aurora-jobs-tick` (every ~minute) and
`aurora-workers-health` (every ~5 minutes). A fresh Supabase project doesn't
have them by default — see `docs/ARCHITECTURE.md` → "Wiring pg_cron".

**Port not detected (no `VAST_TCP_HOST`)**

Make sure port `8000` is listed under **Open Ports** in the instance template
before launching. If you forgot, destroy and re-launch — Vast.ai only injects
`VAST_TCP_HOST`/`VAST_TCP_PORT_*` for ports declared at launch time.
Alternatively set `NGROK_AUTHTOKEN` (+ `NGROK_STATIC_DOMAIN`) and the launcher
falls back to an ngrok tunnel automatically.

**Prefer the CLI (managed lifecycle)**

Instead of renting through the Vast.ai console by hand, admins can use
`aurora vast search` / `aurora vast up` from the Aurora CLI. Aurora then rents
the instance itself (max $0.35/hr), injects this launcher as the on-start
script, tracks it in Admin → Orchestration, and **auto-destroys it after
1 hour** so a forgotten instance can't keep billing. Already-rented instances
can be brought under the same management with `aurora vast adopt`. See
`cli/README.md` → "Vast.ai GPU lifecycle".

**Results upload**

Defaults to `catbox.moe` (no account, permanent public links).
To store in your own Supabase bucket instead, set:
```
AURORA_UPLOAD=supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```
