# Comfy-Manager → Aurora Global Integration

Aurora Global is the canonical application. Comfy-Manager capabilities are integrated behind Aurora's existing TanStack Start routing, auth, orchestration, Supabase, and worker boundaries.

## Integrated capability layer
- Unified ComfyUI/ModelArk/Seedance capability registry
- BytePlus Video Agent facade with standard, cinematic, and viral modes
- Canonical workflows: standard-video, cinematic-video, viral-video, image-to-video, character-video, lip-sync-video
- Existing Aurora ComfyUI Studio, GPU worker, Colab, and Kaggle infrastructure remains the execution layer

## Rules
No second application shell, router, auth system, package manager, or production API server. No provider credentials in source control. Existing Aurora billing, auth, CORS, database, and deployment boundaries remain authoritative.

## Validation
Focused registry/planning tests are included. Full lint/typecheck/build and real provider/worker smoke tests remain required before production readiness is claimed.
