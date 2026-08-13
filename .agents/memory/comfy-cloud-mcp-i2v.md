---
name: Comfy Cloud MCP image-to-video
description: How to do i2v on Comfy Cloud MCP — partner models are t2v-only; use an open-source Wan graph instead.
---
- MCP endpoint: `https://cloud.comfy.org/mcp` (streamable HTTP, JSON-RPC POST, `Accept: application/json, text/event-stream`), auth = `Authorization: Bearer <COMFY_API_KEY secret>`; verified live 2026-08-13 (serverInfo "comfyui-cloud"). No curated Replit integration exists — connect via workspace MCP Servers pane or raw curl.
- All Comfy Cloud partner video models exposed via MCP (`kling/kling-v3-t2v`, `byteplus/seedance-2.0-t2v`, `veo/veo-3-t2v`) accept NO media roles — image-to-video via `partner_generate` is impossible.
- **How to apply:** chain `use_previous_output(prompt_id)` → LoadImage filename, then `submit_workflow` with a Wan 2.1 i2v graph (UNETLoader wan2.1_i2v_480p_14B_fp16 + CLIPLoader umt5_xxl_fp8_e4m3fn_scaled type "wan" + VAELoader wan_2.1_vae + CLIPVisionLoader clip_vision_h + WanImageToVideo + KSampler uni_pc/simple, cfg 6, 20 steps; 81 frames @16fps = 5s).
- `estimate_credits` on such a graph = 0 partner credits (billed as plan GPU time only) — dramatically cheaper than partner nodes.
- Node heredocs: use `import fs from 'fs'` (ESM), not require — top-level await forces ESM.
- Working still graph saved at `workflow_api.json`; a completed run's output persists ~6h via signed GCS URL — download immediately.
