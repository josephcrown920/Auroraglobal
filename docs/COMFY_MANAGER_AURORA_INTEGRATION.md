# Comfy-Manager → Aurora Global Integration

Aurora Global is the canonical application. Comfy-Manager capabilities are integrated behind Aurora's existing TanStack Start routing, auth, orchestration, Supabase, and worker boundaries.

## Capability target
- ComfyUI workflow execution and worker routing
- ModelArk / Seedream / Seedance
- BytePlus Video Agent planning and presets
- Cinematic and viral workflow registry
- Image-to-video, character video, lip-sync, and Perform Anywhere
- GPU Hub and saved worker roster
- Free Colab/Kaggle workers
- Durable jobs, progress, batches, outputs, and files

## Rules
Do not introduce a second application shell, router, auth system, package manager, or production API server. Do not copy provider credentials into source control. Existing Aurora billing, auth, CORS, database, and deployment boundaries remain authoritative.

## Delivery
Capabilities are added incrementally, tested with Aurora's production gate, and only then promoted to `Main`. Real ModelArk and worker smoke tests are required before claiming production readiness.
