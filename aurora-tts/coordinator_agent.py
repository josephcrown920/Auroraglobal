"""
Coordinator agent for aurora-tts app.
Primary: Kokoro-82M
Fallback: reasoning analysis / parameters optimization
"""
from typing import Optional, Any


class CoordinatorAgent:
    """Coordinator for aurora-tts inference pipeline.

    Primary: Kokoro-82M
    Fallback: reasoning analysis
    """

    def __init__(self, primary_client: Any = None, fallback_client: Any = None, reasoning_client: Any = None):
        self.primary = primary_client
        self.fallback = fallback_client
        self.reasoning = reasoning_client

    def generate_tts(self, text: str, voice: str = "af_sky", speed: float = 1.0, **kwargs) -> Any:
        """Generate TTS with language detection and parameter optimization."""
        t = text
        v = voice
        s = speed
        if self.reasoning and hasattr(self.reasoning, "optimize_tts_params"):
            try:
                t, v, s = self.reasoning.optimize_tts_params(text, voice, speed)
            except Exception:
                t, v, s = text, voice, speed

        if self.primary:
            try:
                return self.primary.generate_tts(t, voice=v, speed=s, **kwargs)
            except Exception as primary_err:
                if self.fallback:
                    try:
                        return self.fallback.generate_tts(t, voice=v, speed=s, **kwargs)
                    except Exception:
                        pass
                if self.reasoning and hasattr(self.reasoning, "handle_tts_failure"):
                    return self.reasoning.handle_tts_failure(t, error=primary_err)
                raise

        raise RuntimeError("No primary client configured for TTS generation")

    def analyze_text(self, text: str) -> dict:
        return self.reasoning.analyze_text(text) if self.reasoning and hasattr(self.reasoning, "analyze_text") else {}
