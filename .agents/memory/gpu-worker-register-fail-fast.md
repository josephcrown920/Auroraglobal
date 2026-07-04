---
name: GPU worker launcher secret validation timing
description: Why Kaggle/Colab/ComfyUI free-GPU launchers check required register secrets before setup, not inside register()
---

Kaggle/Colab/ComfyUI free-GPU worker launchers (`workers/kaggle/aurora_worker_kaggle.py`,
`workers/comfyui/aurora_comfyui_launcher.py`) must validate the secrets needed for
auto-registration (NGROK_AUTHTOKEN, NGROK_STATIC_DOMAIN, AURORA_URL,
AURORA_REGISTER_KEY) immediately after loading secrets, before running setup
(pip installs + model downloads, which can take 10+ minutes).

**Why:** the actual registration call happens deep inside `register_with_aurora()` /
`register()`, which only prints a one-line skip message. If secrets are missing, the
owner has no signal until they scroll back through a long install log (or just sees
"no worker online" with nothing to explain why) — a multi-minute investment wasted per
misconfigured attempt.

**How to apply:** any new free-GPU launcher script that self-registers should call an
early `warn_if_register_secrets_missing()`-style check right after secrets load, and
print a loud, itemized list of exactly which secret is missing and where to get it —
never rely on a failure surfacing only at the end of a long setup.
