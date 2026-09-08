#!/usr/bin/env python3
"""
Aurora Media Generation API Server
Flask application providing REST endpoints for video, image, and code generation

Endpoints:
  POST /api/generate       - General message endpoint
  POST /api/video          - Video generation
  POST /api/image          - Image generation
  POST /api/code           - Code generation & reasoning
  GET  /                   - Health check
"""

import os
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
from video_agent import VideoAgent

app = Flask(__name__)
CORS(app)

# Initialize agent
api_key = os.environ.get("ARK_API_KEY")
if not api_key:
    print("WARNING: ARK_API_KEY not set. Set it in environment variables.")

agent = None

def init_agent():
    global agent
    if not agent and api_key:
        agent = VideoAgent(api_key=api_key)


@app.before_request
def before_request():
    """Initialize agent before each request."""
    init_agent()


@app.route("/", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({
        "status": "ok",
        "service": "Aurora Media Generation API",
        "version": "1.0.0",
        "endpoints": [
            "POST /api/generate",
            "POST /api/video",
            "POST /api/image",
            "POST /api/code",
        ],
    })


@app.route("/api/generate", methods=["POST"])
def generate():
    """General message generation endpoint.

    Request body:
        {"prompt": "your message here"}
    """
    if not agent:
        return jsonify({"error": "Agent not initialized. Set ARK_API_KEY."}), 500

    data = request.get_json()
    if not data or "prompt" not in data:
        return jsonify({"error": "Missing 'prompt' in request body"}), 400

    prompt = data["prompt"]
    timeout = data.get("timeout", 120)

    try:
        result = agent.send(prompt, timeout=timeout)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/video", methods=["POST"])
def generate_video():
    """Video generation endpoint.

    Request body:
        {
            "prompt": "video description",
            "duration": 5,
            "ratio": "16:9",
            "resolution": "720p"
        }
    """
    if not agent:
        return jsonify({"error": "Agent not initialized. Set ARK_API_KEY."}), 500

    data = request.get_json()
    if not data or "prompt" not in data:
        return jsonify({"error": "Missing 'prompt' in request body"}), 400

    prompt = data["prompt"]
    duration = data.get("duration", 5)
    ratio = data.get("ratio", "16:9")
    resolution = data.get("resolution", "720p")

    try:
        result = agent.generate_video(
            prompt=prompt,
            duration=duration,
            ratio=ratio,
            resolution=resolution,
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/image", methods=["POST"])
def generate_image():
    """Image generation endpoint.

    Request body:
        {
            "prompt": "image description",
            "size": "2K"
        }
    """
    if not agent:
        return jsonify({"error": "Agent not initialized. Set ARK_API_KEY."}), 500

    data = request.get_json()
    if not data or "prompt" not in data:
        return jsonify({"error": "Missing 'prompt' in request body"}), 400

    prompt = data["prompt"]
    size = data.get("size", "2K")

    try:
        result = agent.generate_image(prompt=prompt, size=size)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/code", methods=["POST"])
def generate_code():
    """Code generation and reasoning endpoint.

    Request body:
        {
            "prompt": "code instruction or problem",
            "language": "python"
        }
    """
    if not agent:
        return jsonify({"error": "Agent not initialized. Set ARK_API_KEY."}), 500

    data = request.get_json()
    if not data or "prompt" not in data:
        return jsonify({"error": "Missing 'prompt' in request body"}), 400

    prompt = data["prompt"]
    language = data.get("language", "python")

    try:
        result = agent.code(instruction=prompt, language=language)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors."""
    return jsonify({"error": "Endpoint not found"}), 404


@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors."""
    return jsonify({"error": "Internal server error"}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    debug = os.environ.get("DEBUG", "False").lower() == "true"
    print(f"🚀 Aurora Media Generation API running on port {port}")
    print(f"   Debug mode: {debug}")
    app.run(host="0.0.0.0", port=port, debug=debug)
