---
name: Dependency security upgrades
description: Security-driven dependency floors can affect GPU workers and may leave unavoidable transitive advisories.
---

Security upgrades to ML dependencies should be treated as runtime changes, not only lockfile changes. Major or fast-moving floors for torch, transformers, diffusers, Pillow, and pydantic can alter model-worker provisioning even when the application typechecks.

**Why:** GPU workers combine tightly coupled native libraries and model-specific APIs; a vulnerability fix can expose an ABI or compatibility break that ordinary web tests cannot detect.

**How to apply:** keep the security floor in dependency files, then verify worker installation/provisioning and provider smoke paths separately. Document advisories with no safe compatible fix (such as Metro's image-size 1.x line or basicsr) rather than forcing a breaking major override.