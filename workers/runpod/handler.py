"""
Aurora worker — RunPod Serverless entrypoint.

Thin shim over the shared core (`aurora_worker.process_job`). RunPod passes the job
under `event["input"]` (Aurora wraps the flat body for you) and nests the return value
under `output`, which Aurora's extractor unwraps. Serves lipsync + motion.

Build with the Dockerfile in this dir, then register the endpoint in Aurora as a
`runpod` worker with capabilities `lipsync,motion`.
"""
import runpod

from aurora_worker import process_job


def handler(event):
    return process_job(event.get("input") or {})


runpod.serverless.start({"handler": handler})
