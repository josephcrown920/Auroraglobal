#!/usr/bin/env python3
"""
Coordinator Agent for aurora-video
Routes video generation through primary pipeline with fallback to reasoning agent
"""

import os
import requests
from typing import Dict, Any, Optional

class CoordinatorAgent:
    """Coordinates video generation with fallback reasoning"""
    
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
    
    def generate_video(
        self,
        prompt: str,
        duration: int = 5,
        width: int = 832,
        height: int = 480,
        fps: int = 16,
        camera_movement: str = "static",
    ) -> Dict[str, Any]:
        """Generate video with coordinator agent routing"""
        message = (
            f"Generate a video using Wan2.1:\n"
            f"- Prompt: {prompt}\n"
            f"- Duration: {duration} seconds\n"
            f"- Resolution: {width}x{height}\n"
            f"- FPS: {fps}\n"
            f"- Camera Movement: {camera_movement}\n\n"
            f"Route through seedream. If primary fails, use reasoning fallback."
        )
        return self.send_message(message)
    
    def enhance_prompt(self, original_prompt: str) -> Dict[str, Any]:
        """Use reasoning agent to enhance/improve prompt"""
        message = (
            f"Please enhance this video generation prompt with more detail and specificity:\n"
            f"Original: {original_prompt}\n\n"
            f"Return only the enhanced prompt, no explanation."
        )
        return self.send_message(message)

if __name__ == "__main__":
    agent = CoordinatorAgent()
    result = agent.generate_video(
        prompt="Sunset over mountains",
        duration=5,
        camera_movement="zoom_in"
    )
    print(f"Result: {result}")
