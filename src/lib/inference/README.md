# GPU Inference Layer

Self-contained, pluggable lip-sync inference adapter. Drop this folder
(`src/lib/inference/`) plus `src/lib/inference.functions.ts` into any
TanStack Start project to reuse the GPU layer.

## Providers

| Provider      | Env vars                                                | Best for                          |
| ------------- | ------------------------------------------------------- | --------------------------------- |
| `runpod`      | `RUNPOD_API_KEY`, `RUNPOD_ENDPOINT_ID`                  | Production, low cold-start        |
| `huggingface` | `HF_SPACE_URL`, `HF_TOKEN` (private), `HF_FN_NAME`      | Free demos                        |
| `custom`      | `CUSTOM_INFERENCE_URL`, `CUSTOM_INFERENCE_TOKEN`        | Colab+ngrok, ComfyUI, own server  |
| `inferencesh` | `INFERENCE_SH_API_KEY` (+ `INFERENCE_SH_APP_<TASK>`)    | Managed cloud apps (inference.sh) |

Switch providers by setting the relevant secrets. No code changes needed.

---

## 1. RunPod Serverless

1. Build a Docker image for Latent-lipSync with a `handler.py`:
   ```python
   import runpod, requests, tempfile, subprocess, os
   def handler(event):
       i = event["input"]
       audio = requests.get(i["audio_url"]).content
       media = requests.get(i["media_url"]).content
       # ... run your inference, write out.mp4 ...
       # upload out.mp4 somewhere public and return its URL:
       return {"video_url": "https://..."}
   runpod.serverless.start({"handler": handler})
   ```
2. Push to Docker Hub, create a Serverless endpoint on runpod.io.
3. Copy the **Endpoint ID** and an **API key** (Settings → API Keys).
4. Add `RUNPOD_API_KEY` and `RUNPOD_ENDPOINT_ID` as secrets in this project.

The adapter calls `/runsync` (30s sync). For longer jobs, switch to `/run`
+ poll `/status/{id}` — easy edit in `providers/runpod.ts`.

---

## 2. Hugging Face Space (Gradio)

1. Duplicate or create a Space running Latent-lipSync with Gradio.
   Your `app.py` should look like:
   ```python
   import gradio as gr
   def predict(audio, media, mode):
       # audio, media are filepaths
       return run_lipsync(audio, media, mode)  # returns path to .mp4
   gr.Interface(predict, [gr.Audio(type="filepath"), gr.File(), gr.Textbox()],
                gr.Video(), api_name="predict").launch()
   ```
2. Once the Space is running, grab its URL: `https://<user>-<space>.hf.space`
3. Add `HF_SPACE_URL` as a secret. For a **private** Space also add `HF_TOKEN`.
4. If your function is named something other than `predict`, set `HF_FN_NAME`.

---

## 3. Custom URL — Colab + ngrok / ComfyUI / own server

Any HTTP server that accepts this request:
```json
POST /
{ "audio_url": "...", "media_url": "...", "mode": "image" | "video" }
```
and responds with:
```json
{ "video_url": "https://..." }
```

### Colab + ngrok recipe

```python
!pip install pyngrok fastapi uvicorn nest_asyncio requests
from fastapi import FastAPI
from pydantic import BaseModel
from pyngrok import ngrok
import nest_asyncio, uvicorn, requests, tempfile

ngrok.set_auth_token("YOUR_NGROK_TOKEN")
app = FastAPI()

class Req(BaseModel):
    audio_url: str
    media_url: str
    mode: str

@app.post("/")
def run(r: Req):
    # download r.audio_url + r.media_url
    # run Latent-lipSync inference
    # upload result somewhere (HF, S3, transfer.sh) and return its URL
    return {"video_url": "https://..."}

public = ngrok.connect(8000)
print("URL:", public.public_url)   # <- this goes in CUSTOM_INFERENCE_URL
nest_asyncio.apply()
uvicorn.run(app, port=8000)
```

Add `CUSTOM_INFERENCE_URL` (the ngrok URL) as a secret. Add
`CUSTOM_INFERENCE_TOKEN` only if you added bearer auth to the FastAPI route.

### ComfyUI recipe

Wrap your ComfyUI workflow in a tiny FastAPI proxy that calls
`http://127.0.0.1:8188/prompt` and returns the final video URL. The same
contract above applies.

---

## Exporting this layer to another project

Copy these files:
```
src/lib/inference/                  ← this folder, unchanged
src/lib/inference.functions.ts      ← TanStack server-function wrapper
```
Then set whichever provider secrets you want and call `runLipSync` from your UI.
