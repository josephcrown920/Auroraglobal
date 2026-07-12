"""
Aurora TTS — inference.sh app
Text-to-speech using Kokoro-82M (hexgrad/Kokoro-82M).
Fast, high-quality, multilingual — runs well on CPU or GPU.

Input fields
------------
text            str   Required. Text to synthesise (max ~5 000 characters).
voice           str   Optional. Voice name (default "af_sky").
                       See VOICES below for the full list.
speed           float Optional. Speaking speed multiplier (default 1.0, range 0.5–2.0).
lang            str   Optional. Language code override (default auto-detected from voice).
                       One of: en-us, en-gb, fr-fr, ja, ko, cmn, es, de, it, pt-br, hi, ar.
split_pattern   str   Optional. Regex pattern for sentence splitting (default None = auto).

Output
------
{"audio": <File>}   — inference.sh File (WAV, 24 kHz mono); the platform
                       exposes it as {"audio": {"uri": "https://..."}} in the task
                       output, matching Aurora's extractOutputUrl("uri") key.

Voices
------
American English (en-us):  af_sky (default), af_sarah, am_adam, af_nicole
British English (en-gb):   bf_emma, bf_isabella, bm_george, bm_lewis
French (fr-fr):            ff_siwis
Japanese (ja):             jf_alpha, jf_gongitsune, jm_kumo
Korean (ko):               kf_alpha, km_hanseul
Chinese Mandarin (cmn):    zf_xiaobei, zm_yunxi
Spanish (es):              ef_dora
German (de):               df_hedda
Italian (it):              if_sara
Portuguese BR (pt-br):     pm_tiago
Hindi (hi):                hf_alpha, hm_omega
Arabic (ar):               af_heart (experimental)
"""

from __future__ import annotations

import os
import tempfile
import uuid
from typing import Any

# ── Voice → lang code mapping ──────────────────────────────────────────────────

_VOICE_LANG: dict[str, str] = {
    # American English
    "af_sky": "en-us", "af_sarah": "en-us", "am_adam": "en-us", "af_nicole": "en-us",
    "af_bella": "en-us", "af_alloy": "en-us",
    # British English
    "bf_emma": "en-gb", "bf_isabella": "en-gb", "bm_george": "en-gb", "bm_lewis": "en-gb",
    # French
    "ff_siwis": "fr-fr",
    # Japanese
    "jf_alpha": "ja", "jf_gongitsune": "ja", "jm_kumo": "ja",
    # Korean
    "kf_alpha": "ko", "km_hanseul": "ko",
    # Chinese Mandarin
    "zf_xiaobei": "cmn", "zm_yunxi": "cmn",
    # Spanish
    "ef_dora": "es",
    # German
    "df_hedda": "de",
    # Italian
    "if_sara": "it",
    # Portuguese BR
    "pm_tiago": "pt-br",
    # Hindi
    "hf_alpha": "hi", "hm_omega": "hi",
    # Arabic
    "af_heart": "ar",
}

DEFAULT_VOICE = "af_sky"
DEFAULT_LANG = "en-us"
SAMPLE_RATE = 24_000

# ── Lazy pipeline ──────────────────────────────────────────────────────────────

_pipelines: dict[str, Any] = {}


def _load_pipeline(lang: str):
    if lang not in _pipelines:
        from kokoro import KPipeline  # type: ignore[import]
        print(f"[aurora-tts] Loading Kokoro pipeline for lang={lang}")
        _pipelines[lang] = KPipeline(lang_code=lang)
        print(f"[aurora-tts] Pipeline ready for lang={lang}")
    return _pipelines[lang]


# ── Main entry point ───────────────────────────────────────────────────────────


def run(inputs: dict[str, Any]) -> dict[str, Any]:
    """Called by inference.sh for every /run request."""
    from infsh import File  # provided by the inference.sh runtime

    import numpy as np
    import soundfile as sf

    text: str = (inputs.get("text") or "").strip()
    if not text:
        raise ValueError("text is required")
    if len(text) > 5_000:
        text = text[:5_000]
        print("[aurora-tts] Warning: text truncated to 5 000 characters")

    voice: str = inputs.get("voice") or DEFAULT_VOICE
    speed: float = float(inputs.get("speed") or 1.0)
    speed = max(0.5, min(2.0, speed))

    # Resolve language: explicit override → voice-based → default
    lang: str = (
        inputs.get("lang")
        or _VOICE_LANG.get(voice, DEFAULT_LANG)
    )
    split_pattern: str | None = inputs.get("split_pattern")

    print(f"[aurora-tts] voice={voice} lang={lang} speed={speed} chars={len(text)}")

    pipeline = _load_pipeline(lang)

    # Collect all audio chunks from the generator.
    chunks: list[Any] = []
    gen_kwargs: dict[str, Any] = {
        "voice": voice,
        "speed": speed,
    }
    if split_pattern is not None:
        gen_kwargs["split_pattern"] = split_pattern

    for _, _, audio in pipeline(text, **gen_kwargs):
        if audio is not None and len(audio) > 0:
            chunks.append(audio)

    if not chunks:
        raise RuntimeError("Kokoro produced no audio — check voice/lang combination")

    combined: Any = np.concatenate(chunks, axis=0) if len(chunks) > 1 else chunks[0]

    out_path = f"/tmp/{uuid.uuid4()}.wav"
    sf.write(out_path, combined, SAMPLE_RATE)

    duration_s = len(combined) / SAMPLE_RATE
    print(f"[aurora-tts] wrote {out_path} ({duration_s:.1f}s at {SAMPLE_RATE} Hz)")

    return {"audio": File(path=out_path, content_type="audio/wav")}
