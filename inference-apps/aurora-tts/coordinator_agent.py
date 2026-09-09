#!/usr/bin/env python3
"""
Coordinator Agent for aurora-tts
Routes TTS requests through primary pipeline with fallback to reasoning agent
"""

import os
import requests
from typing import Dict, Any, Optional

class CoordinatorAgent:
    """Coordinates TTS generation with fallback reasoning"""
    
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
    
    def generate_tts(
        self,
        text: str,
        voice: str = "af_sky",
        speed: float = 1.0,
        lang: str = "en-us",
    ) -> Dict[str, Any]:
        """Generate TTS with coordinator agent routing"""
        message = (
            f"Generate speech using Kokoro-82M:\n"
            f"- Text: {text}\n"
            f"- Voice: {voice}\n"
            f"- Speed: {speed}x\n"
            f"- Language: {lang}\n\n"
            f"Use the default TTS pipeline. If primary fails, use reasoning fallback."
        )
        return self.send_message(message)
    
    def analyze_text(
        self,
        text: str,
        language: str = "auto",
    ) -> Dict[str, Any]:
        """Use reasoning agent to analyze text for optimal TTS parameters"""
        message = (
            f"Analyze this text for text-to-speech optimization (language={language}):\n"
            f"Text: {text}\n\n"
            f"Recommend:\n"
            f"1. Best voice for the tone/emotion\n"
            f"2. Optimal speaking speed\n"
            f"3. Suggested language variant\n"
            f"Return as JSON."
        )
        return self.send_message(message)

if __name__ == "__main__":
    agent = CoordinatorAgent()
    result = agent.generate_tts(
        text="Hello world, this is a test of the text-to-speech system.",
        voice="af_sky",
        speed=1.0
    )
    print(f"Result: {result}")
