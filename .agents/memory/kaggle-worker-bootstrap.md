---
name: Kaggle GPU worker bootstrap quirks
description: Non-obvious constraints when running the Aurora self-hosted worker on Kaggle's free tier.
---

# Kaggle worker bootstrap quirks

- **Kaggle Secrets are NOT environment variables.** They must be read via
  `from kaggle_secrets import UserSecretsClient` and mirrored into `os.environ`.
  A worker that only reads `os.environ` (like the shared `aurora_worker.py`) sees
  nothing on Kaggle unless the launcher bridges each key first.
  **Why:** the previous Kaggle runner read `os.environ` directly, so its whole
  register/tunnel config was silently empty.

- **GitHub raw branch names are case-sensitive** and this repo carries several
  near-identical branches (`Main`, `main`, `master`, …) — its actual default is
  `Main`. A self-bootstrap fetch from `raw.githubusercontent.com` must try
  candidate branches (or take an override) rather than hardcode one. Private
  repos can't fetch over raw URLs at all — fall back to manually uploaded files.
- **The kaggle launcher's OWNER/REPO fallback can silently rot**: it was
  hardcoded to the original Lovable-generated project slug
  (`aurora-charm-forge-...`), not the actual GitHub repo the project was pushed
  to — every raw fetch 404'd on the right branch but the wrong repo entirely.
  Verify the hardcoded owner/repo against `git remote -v` (or the GitHub API)
  whenever this bootstrap misbehaves; don't just chase branch names.

- **Free Kaggle GPUs are 16 GB (T4/P100) with ~20 GB working disk.** Only
  `lipsync` (LatentSync) fits; `motion` (MimicMotion + SVD) needs ~24 GB VRAM and
  ~25 GB disk. Gate motion behind an explicit opt-in and fail loudly at setup
  instead of OOMing mid-job.

- **A constrained worker must register only the capabilities it actually
  installed** (`AURORA_CAPABILITIES` mirrors the installed `AURORA_TASKS`), and
  must pass a local `/health` check before tunneling/registering — otherwise
  dispatch routes unservable jobs to a dead/over-promised worker row.
  **How to apply:** keep installed-tasks and registered-capabilities derived from
  one normalized list; never advertise more than is installed.
