#!/usr/bin/env python3
"""
Aurora Video Agent
Python client for media generation via BytePlus ModelArk API

Usage:
    agent = VideoAgent(api_key="your-key")
    result = agent.generate_video("sunset over mountains", duration=5)
    result = agent.generate_image("cyberpunk city")
    result = agent.code("Write a Python quicksort function")
"""

import os
import requests
import json
from typing import Dict, Optional, Any


class VideoAgent:
    """Aurora Video & Media Generation Agent"""

    BASE_URL = "https://ark.ap-southeast.bytepluses.com/api/v3"
    DEFAULT_SESSION_ID = "sesn-20260908153422-5m5h7"

    def __init__(
        self,
        api_key: Optional[str] = None,
        session_id: Optional[str] = None,
        base_url: Optional[str] = None,
    ):
        """Initialize VideoAgent.

        Args:
            api_key: BytePlus API key (defaults to ARK_API_KEY env var)
            session_id: Session ID for API calls (defaults to coordinator session)
            base_url: Custom API base URL
        """
        self.api_key = api_key or os.environ.get("ARK_API_KEY")
        if not self.api_key:
            raise ValueError(
                "ARK_API_KEY not provided. "
                "Set it as an environment variable or pass api_key parameter."
            )

        self.session_id = session_id or self.DEFAULT_SESSION_ID
        self.base_url = base_url or self.BASE_URL

        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def send(
        self, message: str, timeout: int = 120
    ) -> Dict[str, Any]:
        """Send message to agent and get response.

        Args:
            message: Message to send to the agent
            timeout: Request timeout in seconds

        Returns:
            Response JSON from the API
        """
        url = f"{self.base_url}/sessions/{self.session_id}/messages"
        payload = {"role": "user", "content": message}

        try:
            response = requests.post(
                url,
                headers=self.headers,
                json=payload,
                timeout=timeout,
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            return {"error": str(e), "status": "failed"}

    def generate_video(
        self,
        prompt: str,
        duration: int = 5,
        ratio: str = "16:9",
        resolution: str = "720p",
    ) -> Dict[str, Any]:
        """Generate video from prompt.

        Args:
            prompt: Video description
            duration: Duration in seconds (default: 5)
            ratio: Aspect ratio (default: 16:9)
            resolution: Video resolution (default: 720p)

        Returns:
            Response with video generation result
        """
        message = (
            f"Generate a video with these specifications:\n"
            f"- Prompt: {prompt}\n"
            f"- Duration: {duration} seconds\n"
            f"- Aspect Ratio: {ratio}\n"
            f"- Resolution: {resolution}\n\n"
            f"Use the seedream model to create this video."
        )
        return self.send(message)

    def generate_image(
        self,
        prompt: str,
        size: str = "2K",
    ) -> Dict[str, Any]:
        """Generate image from prompt.

        Args:
            prompt: Image description
            size: Image size/resolution (default: 2K)

        Returns:
            Response with image generation result
        """
        message = (
            f"Generate an image with these specifications:\n"
            f"- Prompt: {prompt}\n"
            f"- Size: {size}\n\n"
            f"Use the seedance model to create this image."
        )
        return self.send(message)

    def code(
        self,
        instruction: str,
        language: str = "python",
    ) -> Dict[str, Any]:
        """Generate code or get reasoning explanation.

        Args:
            instruction: Code instruction or problem to solve
            language: Programming language (default: python)

        Returns:
            Response with code generation result
        """
        message = (
            f"Please help with the following {language} programming task:\n\n"
            f"{instruction}\n\n"
            f"Provide clear, well-documented code with explanations."
        )
        return self.send(message)

    def set_session_id(self, session_id: str) -> None:
        """Update the session ID for subsequent requests.

        Args:
            session_id: New session ID
        """
        self.session_id = session_id

    def get_session_info(self) -> Dict[str, str]:
        """Get current session information.

        Returns:
            Dictionary with session details
        """
        return {
            "session_id": self.session_id,
            "base_url": self.base_url,
            "api_key": "***" if self.api_key else "None",
        }


if __name__ == "__main__":
    # Quick test
    try:
        agent = VideoAgent()
        print("✓ VideoAgent initialized successfully")
        print(f"  Session: {agent.get_session_info()['session_id']}")

        # Example: Test with simple message
        # result = agent.send("Say hello")
        # print(f"Response: {json.dumps(result, indent=2)}")
    except ValueError as e:
        print(f"✗ Error: {e}")
