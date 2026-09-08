#!/usr/bin/env python3
"""
Coordinator Agent for aurora-lipsync
Routes lipsync requests through primary pipeline with fallback to reasoning agent
"""

import os
import requests
from typing import Dict, Any, Optional

class CoordinatorAgent:
    """Coordinates lipsync generation with fallback reasoning"""
    
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
    
    def generate_lipsync(
        self,
        audio_url: str,
        video_url: Optional[str] = None,
        image_url: Optional[str] = None,
        inference_steps: int = 25,
        guidance_scale: float = 1.5,
    ) -> Dict[str, Any]:
        """Generate lipsync with coordinator agent routing"""
        source = f"video={video_url}" if video_url else f"image={image_url}"
        message = (
            f"Generate lipsync using LatentSync-1.5:\n"
            f"- Audio: {audio_url}\n"
            f"- Source ({source})\n"
            f"- Inference Steps: {inference_steps}\n"
            f"- Guidance Scale: {guidance_scale}\n\n"
            f"If image provided, promote to 5-second looping video first.\n"
            f"If lipsync fails, use reasoning fallback for alternative approaches."
        )
        return self.send_message(message)
    
    def analyze_audio(
        self,
        audio_url: str,
    ) -> Dict[str, Any]:
        """Use reasoning agent to analyze audio for optimal lipsync parameters"""
        message = (
            f"Analyze this audio for lipsync optimization:\n"
            f"Audio: {audio_url}\n\n"
            f"Provide:\n"
            f"1. Detected language and speech rate\n"
            f"2. Recommended inference_steps (10-50)\n"
            f"3. Recommended guidance_scale (0.5-2.0)\n"
            f"4. Estimated optimal video frame count\n"
            f"5. Any preprocessing recommendations\n"
            f"Return as JSON."
        )
        return self.send_message(message)
    
    def validate_inputs(
        self,
        audio_url: str,
        video_url: Optional[str] = None,
        image_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Use reasoning agent to validate inputs before generation"""
        source = f"video={video_url}" if video_url else f"image={image_url}"
        message = (
            f"Validate these lipsync inputs:\n"
            f"- Audio: {audio_url}\n"
            f"- Source ({source})\n\n"
            f"Check for:\n"
            f"1. Audio format and quality\n"
            f"2. Video/image resolution and quality\n"
            f"3. Audio-to-visual duration match\n"
            f"4. Face/mouth visibility in source\n"
            f"5. Any issues that would affect lipsync\n"
            f"Return validation result as JSON."
        )
        return self.send_message(message)

if __name__ == "__main__":
    agent = CoordinatorAgent()
    result = agent.generate_lipsync(
        audio_url="https://example.com/speech.wav",
        image_url="https://example.com/portrait.jpg"
    )
    print(f"Result: {result}")
