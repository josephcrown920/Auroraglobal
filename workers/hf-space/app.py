"""
Aurora worker — Hugging Face Space (Gradio) entrypoint.

Gradio's `predict` fn has a FIXED arity, so one Space serves ONE task. Choose with
the `AURORA_TASK` Space secret:

  * AURORA_TASK=lipsync  -> predict(audio, media, mode)            -> LatentSync
  * AURORA_TASK=motion   -> predict(prompt, image, audio, video)   -> MimicMotion

These signatures match exactly what Aurora's `gradioData()` sends. The result is
returned as a file Gradio serves; Aurora reads its URL from the SSE payload.

Deploy two Spaces (one per task) if you want both, and register each separately.
"""
import os

import gradio as gr

from aurora_worker import run_latentsync, run_mimicmotion

TASK = os.environ.get("AURORA_TASK", "lipsync").lower()


def _path(file_or_url):
    """Gradio hands us a local file path (or {path/url}); LatentSync/MimicMotion in
    aurora_worker expect URLs, so we pass whatever resolves to a fetchable source."""
    if isinstance(file_or_url, dict):
        return file_or_url.get("url") or file_or_url.get("path")
    return file_or_url


if TASK == "motion":
    def predict(prompt, image, audio, video):
        out = run_mimicmotion(_path(image), _path(video), {})
        return out

    demo = gr.Interface(
        fn=predict,
        inputs=[gr.Textbox(label="prompt"), gr.Image(type="filepath", label="ref image"),
                gr.Audio(type="filepath", label="audio (unused)"),
                gr.Video(label="pose video")],
        outputs=gr.Video(label="result"),
        title="Aurora MimicMotion worker",
    )
else:
    def predict(audio, media, mode):
        out = run_latentsync(_path(media), _path(audio), {})
        return out

    demo = gr.Interface(
        fn=predict,
        inputs=[gr.Audio(type="filepath", label="audio"),
                gr.Video(label="face video"),
                gr.Textbox(value="video", label="mode")],
        outputs=gr.Video(label="result"),
        title="Aurora LatentSync worker",
    )


if __name__ == "__main__":
    demo.queue().launch(server_name="0.0.0.0", server_port=int(os.environ.get("PORT", "7860")))
