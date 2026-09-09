"""
Stub clients for aurora-tts to allow local smoke tests without external services.
"""

class KokoroClient:
    def generate_tts(self, text, voice="af_sky", speed=1.0, **kwargs):
        return {"client": "kokoro", "text": text, "voice": voice, "speed": speed}

class KokoroFallbackClient:
    def generate_tts(self, text, voice="af_sky", speed=1.0, **kwargs):
        return {"client": "kokoro_fallback", "text": text, "voice": voice, "speed": speed}
