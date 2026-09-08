"""
Coordinator agent for aurora-video app.
Routes to primary: seedream (Wan2.1 T2V/I2V)
Fallback: seedream fallback / DeepSeek reasoning
"""
from typing import Optional, Any


class CoordinatorAgent:
    """Coordinator for aurora-video inference pipeline.

    Primary: seedream (Wan2.1)
    Fallback: seedream fallback
    Ultimate fallback: reasoning client (DeepSeek)
    """

    def __init__(self, primary_client: Any = None, fallback_client: Any = None, reasoning_client: Any = None):
        self.primary = primary_client
        self.fallback = fallback_client
        self.reasoning = reasoning_client

    def generate_video(self, prompt: str, duration: int = 5, camera_movement: Optional[str] = None, **kwargs) -> Any:
        """Generate video with routing + reasoning-enhanced prompt.

        Args:
            prompt: human prompt
            duration: seconds
            camera_movement: optional camera instruction like 'zoom_in'
        """
        # 1) Prompt enhancement via reasoning (optional)
        enhanced = prompt
        if self.reasoning and hasattr(self.reasoning, "enhance_prompt"):
            try:
                enhanced = self.reasoning.enhance_prompt(prompt)
            except Exception:
                # fall through to using raw prompt
                enhanced = prompt

        # 2) Try primary pipeline
        if self.primary:
            try:
                return self.primary.generate_video(enhanced, duration=duration, camera_movement=camera_movement, **kwargs)
            except Exception as primary_err:
                # 3) Try fallback pipeline
                if self.fallback:
                    try:
                        return self.fallback.generate_video(enhanced, duration=duration, camera_movement=camera_movement, **kwargs)
                    except Exception:
                        pass
                # 4) Ultimate recovery via reasoning
                if self.reasoning and hasattr(self.reasoning, "handle_video_failure"):
                    return self.reasoning.handle_video_failure(enhanced, error=primary_err)
                raise

        raise RuntimeError("No primary client configured for video generation")

    # Helpers
    def analyze_text(self, text: str) -> dict:
        return self.reasoning.analyze_text(text) if self.reasoning and hasattr(self.reasoning, "analyze_text") else {}
