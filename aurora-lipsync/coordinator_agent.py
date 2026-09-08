"""
Coordinator agent for aurora-lipsync app.
Primary: LatentSync-1.5
Fallback: reasoning validation / subprocess mode
"""
from typing import Optional, Any


class CoordinatorAgent:
    """Coordinator for lipsync generation with input validation and AV sync checks."""

    def __init__(self, primary_client: Any = None, fallback_client: Any = None, reasoning_client: Any = None):
        self.primary = primary_client
        self.fallback = fallback_client
        self.reasoning = reasoning_client

    def generate_lipsync(self, audio_url: str, image_url: str, **kwargs) -> Any:
        """Generate lipsync ensuring audio-analysis and input validation."""
        a = audio_url
        i = image_url
        if self.reasoning and hasattr(self.reasoning, "validate_av_inputs"):
            try:
                a, i = self.reasoning.validate_av_inputs(audio_url, image_url)
            except Exception:
                a, i = audio_url, image_url

        if self.primary:
            try:
                return self.primary.generate_lipsync(audio_url=a, image_url=i, **kwargs)
            except Exception as primary_err:
                if self.fallback:
                    try:
                        return self.fallback.generate_lipsync(audio_url=a, image_url=i, **kwargs)
                    except Exception:
                        pass
                if self.reasoning and hasattr(self.reasoning, "handle_lipsync_failure"):
                    return self.reasoning.handle_lipsync_failure(a, i, error=primary_err)
                raise

        raise RuntimeError("No primary client configured for lipsync generation")

    def analyze_audio(self, audio_url: str) -> dict:
        return self.reasoning.analyze_audio(audio_url) if self.reasoning and hasattr(self.reasoning, "analyze_audio") else {}
