#!/usr/bin/env python3
"""
Test: Code Generation & Reasoning
Quick test of code generation and reasoning capabilities
"""

import os
import sys
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from video_agent import VideoAgent


def test_code_generation():
    """Test code generation and reasoning."""
    print("💻 Testing Code Generation & Reasoning...\n")

    try:
        agent = VideoAgent()
        print(f"✓ Agent initialized")
        print(f"  Session: {agent.get_session_info()['session_id']}\n")

        # Test: Quicksort implementation
        print("📝 Task 1: Write a Python quicksort function")
        result = agent.code(
            instruction="Write an efficient Python implementation of quicksort algorithm. "
            "Include docstring, type hints, and explain the time/space complexity.",
            language="python",
        )
        print(f"Result:\n{json.dumps(result, indent=2)}\n")

        # Test: API endpoint design
        print("📝 Task 2: Design a REST API for a social media platform")
        result = agent.code(
            instruction="Design a REST API for a social media platform with "
            "user authentication, posts, comments, and likes. "
            "Include endpoint paths, HTTP methods, request/response examples.",
            language="api-design",
        )
        print(f"Result:\n{json.dumps(result, indent=2)}")

    except ValueError as e:
        print(f"✗ Error: {e}")
        print("\nSet ARK_API_KEY environment variable to run this test.")


if __name__ == "__main__":
    test_code_generation()
