#!/usr/bin/env python3
"""
Test: Video Generation
Quick test of video generation capabilities
"""

import os
import sys
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from video_agent import VideoAgent


def test_video_generation():
    """Test video generation."""
    print("🎬 Testing Video Generation...\n")

    try:
        agent = VideoAgent()
        print(f"✓ Agent initialized")
        print(f"  Session: {agent.get_session_info()['session_id']}\n")

        # Test: Sunset video
        print("📝 Generating: Sunset over mountains (5s, 16:9, 720p)")
        result = agent.generate_video(
            prompt="A beautiful sunset over snow-capped mountains with golden light",
            duration=5,
            ratio="16:9",
            resolution="720p",
        )
        print(f"Result:\n{json.dumps(result, indent=2)}\n")

        # Test: Ocean waves video
        print("📝 Generating: Waves crashing on beach (3s, 9:16, 1080p)")
        result = agent.generate_video(
            prompt="Ocean waves crashing on a sandy beach at sunset",
            duration=3,
            ratio="9:16",
            resolution="1080p",
        )
        print(f"Result:\n{json.dumps(result, indent=2)}")

    except ValueError as e:
        print(f"✗ Error: {e}")
        print("\nSet ARK_API_KEY environment variable to run this test.")


if __name__ == "__main__":
    test_video_generation()
