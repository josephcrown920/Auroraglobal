# Aurora Media Generation Agent

**Ultimate aurora source of truth** — Video, image, and code generation agent powered by BytePlus ModelArk API.

## Features

✨ **Video Generation** — Create videos with custom duration, resolution, and aspect ratio  
🖼️ **Image Generation** — Generate high-quality images in various sizes  
💻 **Code Generation** — Write code and get reasoning explanations  
🔄 **Fallback Reasoning** — DeepSeek-V4-Pro-GA for complex tasks  
📡 **REST API** — Flask server with dedicated endpoints  
🐍 **Python Client** — Easy-to-use VideoAgent class  

## Installation

### Prerequisites

- Python 3.8+
- BytePlus API key (from ModelArk)
- Internet connection

### Setup

1. **Clone or navigate to the project directory**
   ```bash
   cd agents/
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Set your API key**
   ```bash
   export ARK_API_KEY="your-api-key-here"
   ```

   Or create a `.env` file:
   ```bash
   cp config.example.env .env
   # Edit .env and add your API key
   ```

## Quick Start

### Using the Python Client

```python
from video_agent import VideoAgent

# Initialize
agent = VideoAgent(api_key="your-key")

# Generate video
result = agent.generate_video(
    prompt="Sunset over mountains",
    duration=5,
    ratio="16:9",
    resolution="720p"
)
print(result)

# Generate image
result = agent.generate_image(
    prompt="Cyberpunk city",
    size="4K"
)
print(result)

# Generate code
result = agent.code(
    instruction="Write a Python quicksort function",
    language="python"
)
print(result)
```

### Starting the API Server

```bash
python app.py
```

Server starts on `http://localhost:8080`

### API Endpoints

#### `POST /api/generate`
General message endpoint.

**Request:**
```json
{
  "prompt": "Your message here",
  "timeout": 120
}
```

**Response:**
```json
{
  "content": "Agent response",
  "status": "completed"
}
```

---

#### `POST /api/video`
Generate videos.

**Request:**
```json
{
  "prompt": "Sunset over mountains",
  "duration": 5,
  "ratio": "16:9",
  "resolution": "720p"
}
```

**Response:**
```json
{
  "id": "vid-abc123",
  "url": "https://...",
  "status": "completed",
  "duration": 5
}
```

---

#### `POST /api/image`
Generate images.

**Request:**
```json
{
  "prompt": "Cyberpunk city",
  "size": "4K"
}
```

**Response:**
```json
{
  "id": "img-abc123",
  "url": "https://...",
  "status": "completed",
  "size": "4K"
}
```

---

#### `POST /api/code`
Generate code and reasoning.

**Request:**
```json
{
  "prompt": "Write a Python quicksort function",
  "language": "python"
}
```

**Response:**
```json
{
  "code": "def quicksort(...)",
  "explanation": "...",
  "language": "python",
  "status": "completed"
}
```

---

#### `GET /`
Health check.

**Response:**
```json
{
  "status": "ok",
  "service": "Aurora Media Generation API",
  "version": "1.0.0"
}
```

## Running Tests

```bash
# Test video generation
python examples/test_video.py

# Test image generation
python examples/test_image.py

# Test code generation
python examples/test_code.py
```

## Architecture

```
┌─────────────────────────────────────┐
│  COORDINATOR AGENT (Dola-Seed-2.1)  │
│  - Image routing (seedance)         │
│  - Video routing (seedream)         │
│  - Code generation                  │
└───────────────┬─────────────────────┘
                │ on failure
                ▼
┌─────────────────────────────────────┐
│  REASONING FALLBACK (DeepSeek-Pro)  │
│  - Complex reasoning tasks          │
│  - Error recovery                   │
│  - Enhanced explanations            │
└─────────────────────────────────────┘
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|----------|
| `ARK_API_KEY` | BytePlus API key (required) | - |
| `BASE_URL` | API base URL | `https://ark.ap-southeast.bytepluses.com/api/v3` |
| `SESSION_ID` | Session ID | `sesn-20260908153422-5m5h7` |
| `PORT` | Server port | `8080` |
| `DEBUG` | Debug mode | `False` |
| `REQUEST_TIMEOUT` | Request timeout (seconds) | `120` |
| `REASONING_TIMEOUT` | Reasoning timeout (ms) | `30000` |

## Troubleshooting

### "ARK_API_KEY not provided"
Make sure your API key is set:
```bash
export ARK_API_KEY="your-key"
```

### Connection timeout
Increase the timeout parameter:
```python
agent.send(message, timeout=300)  # 5 minutes
```

### Generation failed
The reasoning fallback will automatically retry with DeepSeek. Check the response for error details.

## Examples

### Generate a cinematic sunset video
```python
result = agent.generate_video(
    prompt="Cinematic sunset over the ocean with warm golden light and silhouetted palm trees",
    duration=10,
    ratio="16:9",
    resolution="1080p"
)
```

### Generate a high-resolution sci-fi image
```python
result = agent.generate_image(
    prompt="Detailed sci-fi space station interior with neon lights and holographic displays",
    size="4K"
)
```

### Generate well-documented code
```python
result = agent.code(
    instruction="Implement a binary search tree with insert, delete, and search methods. Include type hints and docstrings.",
    language="python"
)
```

## License

See LICENSE file in repository root.

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review example scripts
3. Check API response error messages
4. Verify ARK_API_KEY is correct

---

**Made with ❤️ for Aurora**
