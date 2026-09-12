# Unified media integration

This branch integrates the Comfy-Manager capability layer into Aurora Global without introducing a duplicate application shell, auth system, router, or production API server.

The branch contains a unified capability registry, canonical video workflow IDs, and a BytePlus Video Agent facade using Aurora's existing ModelArk adapter. Existing ComfyUI Studio, GPU workers, Colab/Kaggle launchers, jobs, and routing remain Aurora-owned infrastructure.
