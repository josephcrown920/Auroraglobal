"""
Coordinator agent for aurora-motion-studio app.
Primary: Champ
Secondary: AnimateDiff
Ultimate fallback: Reasoning agent (DeepSeek)
"""
from typing import Optional, Any, Tuple


class CoordinatorAgent:
    """Coordinator for motion generation pipelines with multi-stage routing."""

    def __init__(self, primary_client: Any = None, fallback_client: Any = None, reasoning_client: Any = None):
        self.primary = primary_client
        self.fallback = fallback_client
        self.reasoning = reasoning_client

    def generate_motion(self, reference_image_url: str, driving_video_url: str, num_frames: int = 16, **kwargs) -> Any:
        """Generate motion with optimization and multi-pipeline routing."""
        ref = reference_image_url
        drv = driving_video_url
        n = num_frames
        if self.reasoning and hasattr(self.reasoning, "optimize_motion_inputs"):
            try:
                ref, drv, n = self.reasoning.optimize_motion_inputs(reference_image_url, driving_video_url, num_frames)
            except Exception:
                ref, drv, n = reference_image_url, driving_video_url, num_frames

        # Try primary (Champ)
        if self.primary:
            try:
                return self.primary.generate_motion(ref, drv, num_frames=n, **kwargs)
            except Exception as first_err:
                # Try secondary (AnimateDiff)
                if self.fallback:
                    try:
                        return self.fallback.generate_motion(ref, drv, num_frames=n, **kwargs)
                    except Exception as second_err:
                        # Ultimate fallback to reasoning agent
                        if self.reasoning and hasattr(self.reasoning, "handle_motion_failure"):
                            return self.reasoning.handle_motion_failure(ref, drv, error=second_err)
                        raise
                else:
                    if self.reasoning and hasattr(self.reasoning, "handle_motion_failure"):
                        return self.reasoning.handle_motion_failure(ref, drv, error=first_err)
                    raise

        raise RuntimeError("No primary client configured for motion generation")

    def optimize_motion_inputs(self, ref: str, drv: str) -> Tuple[str, str]:
        if self.reasoning and hasattr(self.reasoning, "optimize_motion_inputs"):
            try:
                return self.reasoning.optimize_motion_inputs(ref, drv)
            except Exception:
                return ref, drv
        return ref, drv
