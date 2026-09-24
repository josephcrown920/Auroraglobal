# NBA Josh Viral Video Automation Guide

## Architecture Overview
The system generates 15-30s viral short-form music video clips combining:
1. **Foreground (NBA Josh):** Generated with green-screen background using BytePlus ModelArk (Seedance 2.5 / Dola Seed 2.1).
   - Walk-in clip (profile reference)
   - Lip-sync performance clip (face reference + hook audio)
   - Confident exit clip
2. **Background (Looping Officers):** Generated with full Lagos street environment.
   - Idle whisper/reconnaissance clip
   - Aggressive sprint loop clip
3. **FFmpeg Compositing Engine:**
   - Automatic chromakey green-screen removal
   - Color grading, depth-of-field blur, vignette, and film grain
   - Multi-track audio mix (ambient intro -> whoosh transition -> full master hook audio)

## Quick Start

