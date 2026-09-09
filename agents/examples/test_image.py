#!/usr/bin/env python3
"""
Test: Image Generation
Quick test of image generation capabilities
"""

import os
import sys
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from video_agent import VideoAgent


def test_image_generation():
    """Test image generation."""
    print("🖼️  Testing Image Generation...\n")

    try:
        agent = VideoAgent()
        print(f"✓ Agent initialized")
        print(f"  Session: {agent.get_session_info()['session_id']}\n")

        # Test: Cyberpunk city
        print("📝 Generating: Cyberpunk city (4K)")
        result = agent.generate_image(
            prompt="Neon-lit cyberpunk city at night with flying vehicles and holographic signs",
            size="4K",
        )
        print(f"Result:\n{json.dumps(result, indent=2)}\n")

        # Test: Fantasy landscape
        print("📝 Generating: Fantasy landscape (2K)")
        result = agent.generate_image(
            prompt="Mystical fantasy landscape with floating islands and waterfalls",
            size="2K",
        )
        print(f"Result:\n{json.dumps(result, indent=2)}")

    except ValueError as e:
        print(f"✗ Error: {e}")
        print("\nSet ARK_API_KEY environment variable to run this test.")


if __name__ == "__main__":
    test_image_generation()
