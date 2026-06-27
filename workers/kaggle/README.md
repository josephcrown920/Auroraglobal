# Kaggle notebook worker (lipsync + motion)

Use Kaggle's free GPU (~30 hrs/week) as an Aurora backend. Serves both tasks via the
`custom` protocol behind an ngrok tunnel.

## Run

1. New Kaggle Notebook → **Settings**: Accelerator = GPU (T4 x2 / P100), Internet = ON.
2. Upload `workers/aurora_worker.py` and `workers/setup.sh` (Add Data → upload, or copy
   into `/kaggle/working`).
3. (Recommended) add a Kaggle secret `NGROK_AUTHTOKEN` so the tunnel survives longer.
4. Paste `aurora_worker_kaggle.py` into a cell and run it.
5. Copy the printed `…/generate` URL.

## Register in Aurora

**Admin → Workers → Register GPU worker**

| field        | value                          |
| ------------ | ------------------------------ |
| Protocol     | `custom`                        |
| Endpoint     | `https://<ngrok-id>.ngrok.app/generate` |
| Capabilities | `lipsync,motion`               |

> The tunnel URL changes every time the notebook restarts — re-run the cell and update
> the worker's endpoint to reconnect. For always-on use, prefer RunPod or a GPU VM.
