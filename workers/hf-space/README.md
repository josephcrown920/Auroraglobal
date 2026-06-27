# Hugging Face Space worker (one task per Space)

A Gradio Space whose `predict` signature matches what Aurora sends. Because Gradio
functions are arity-locked, **one Space = one task** — deploy two if you want both
LatentSync and MimicMotion.

## Deploy

1. Create a Space → **Gradio** SDK → GPU hardware (T4-small works for LatentSync;
   MimicMotion wants A10G/24 GB).
2. Add the repo files: `app.py` + `requirements.txt` (copy `aurora_worker.py` and
   `setup.sh` from the parent dir into the Space too).
3. Make the Space run `bash setup.sh /home/user/app` once to fetch model weights
   (e.g. in a `prestart` step or the first build), then set the secrets below.
4. Space **secrets / variables**:
   - `AURORA_TASK` = `lipsync` **or** `motion`
   - `LATENTSYNC_DIR` / `MIMICMOTION_DIR` (point at the cloned repos)
   - optional `AURORA_UPLOAD=supabase` + Supabase creds

## Register in Aurora

**Admin → Workers → Register GPU worker**

| field        | value                                                |
| ------------ | ---------------------------------------------------- |
| Protocol     | `hfspace`                                            |
| Endpoint     | `https://<user>-<space-name>.hf.space`               |
| Auth token   | HF token (only if the Space is private)              |
| Capabilities | `lipsync` **or** `motion` (must match `AURORA_TASK`) |

Aurora calls the Space's `predict` fn over `/gradio_api/call/predict`. Keep the input
order exactly as in `app.py` — it mirrors Aurora's `gradioData()`.
