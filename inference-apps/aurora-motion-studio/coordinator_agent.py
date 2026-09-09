#!/usr/bin/env python3
"""
Coordinator Agent for aurora-motion-studio
Routes motion, lipsync, and video tasks through primary pipeline with fallback to reasoning agent
"""

import os
import requests
from typing import Dict, Any, Optional

class CoordinatorAgent:
    """Coordinates motion studio tasks with fallback reasoning"""
    
    BASE_URL = "https://ark.ap-southeast.bytepluses.com/api/v3"
    
    def __init__(self, api_key: Optional[str] = None, session_id: Optional[str] = None):
        self.api_key = api_key or os.environ.get("ARK_API_KEY")
        self.session_id = session_id or os.environ.get("SESSION_ID", "sesn-20260908153422-5m5h7")
        
        if not self.api_key:
            raise ValueError("ARK_API_KEY environment variable required")
        
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
    
    def send_message(self, prompt: str, timeout: int = 120) -> Dict[str, Any]:
        """Send message to coordinator/reasoning agent"""
        try:
            response = requests.post(
                f"{self.BASE_URL}/sessions/{self.session_id}/messages",
                headers=self.headers,
                json={"role": "user", "content": prompt},
                timeout=timeout,
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"[Coordinator] Error: {e}")
            return {"error": str(e), "status": "failed"}
    
    def generate_motion(
        self,
        reference_image_url: str,
        driving_video_url: str,
        prompt: str = "",
        num_frames: int = 16,
        fps: int = 8,
    ) -> Dict[str, Any]:
        """Generate motion transfer with coordinator agent routing"""
        message = (
            f"Generate motion transfer using Champ with fallback to AnimateDiff:\n"
            f"- Reference Image: {reference_image_url}\n"
            f"- Driving Video: {driving_video_url}\n"
            f"- Prompt: {prompt}\n"
            f"- Frames: {num_frames}\n"
            f"- FPS: {fps}\n\n"
            f"Primary: Champ (identity-preserving)\n"
            f"Fallback: AnimateDiff + DWPose ControlNet\n"
            f"Ultimate fallback: Reasoning agent for guidance"
        )
        return self.send_message(message)
    
    def generate_lipsync(
        self,
        audio_url: str,
        video_url: Optional[str] = None,
        image_url: Optional[str] = None,
        inference_steps: int = 25,
    ) -> Dict[str, Any]:
        """Generate lipsync with coordinator agent routing"""
        message = (
            f"Generate lipsync using LatentSync-1.5:\n"
            f"- Audio: {audio_url}\n"
            f"- Video: {video_url}\n"
            f"- Image: {image_url}\n"
            f"- Inference Steps: {inference_steps}\n\n"
            f"If video not provided, promote image to video.\n"
            f"If lipsync fails, use reasoning fallback."
        )
        return self.send_message(message)
    
    def optimize_motion_inputs(
        self,
        reference_image_url: str,
        driving_video_url: str,
    ) -> Dict[str, Any]:
        """Use reasoning agent to analyze and optimize motion inputs"""
        message = (
            f"Analyze these motion transfer inputs and recommend optimizations:\n"
            f"- Reference: {reference_image_url}\n"
            f"- Driving: {driving_video_url}\n\n"
            f"Recommend:\n"
            f"1. Best num_frames and FPS for quality\n"
            f"2. Optimal guidance scale\n"
            f"3. Whether Champ or AnimateDiff is better suited\n"
            f"4. Any preprocessing needed\n"
            f"Return as JSON."
        )
        return self.send_message(message)

if __name__ == "__main__":
    agent = CoordinatorAgent()
    result = agent.generate_motion(
        reference_image_url="https://example.com/portrait.jpg",
        driving_video_url="https://example.com/driving.mp4",
        prompt="Professional dancer performing",
        num_frames=16,
        fps=8
    )
    print(f"Result: {result}")
