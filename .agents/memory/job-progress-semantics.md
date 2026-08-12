---
name: Job progress semantics
description: Invariants for real server-side job progress — percent scales, write fences, per-attempt reset, and how real percents must both floor AND cap the client's synthetic bar.
---

# Job progress semantics

Two percent scales coexist BY DESIGN:
- In-process provider callbacks report the model's own 0–100 render loop and are banded into **5–90** of the job bar; the head ("starting" ~2) and tail ("uploading" ~92) are coarse seams written by the queue runner around the render.
- Self-hosted GPU workers POST **job-absolute** percents to the public progress callback route (they know the whole lifecycle).

**Fencing:** progress writes are always fenced on `status='processing'`; in-process writers additionally fence on `locked_by`. The worker HTTP callback cannot pass the lease (GPU workers never learn it) — accepted residual because progress fields are cosmetic and never gate finalization or credits. Stage strings sent to clients are machine codes or worker free text — never provider names (provider identity must not leak to users).

**Per-attempt reset:** every claim stamps a low "starting" percent — that is what wipes a prior attempt's high-water mark on requeue. Client side, enqueue wrappers emit a null-percent reset ping and per-run job ids are cleared on mutate, or the previous run's percent floors the new bar.

**Reporter:** throttled (~2s), stage CHANGES bypass the throttle, monotonic pct; a suppressed pct is NOT recorded (so it retries after the window); stage-change writes carry the high-water pct. Fire-and-forget — never awaited on the hot path, never throws.

**Client rule — real percent must floor AND cap:** a real percent that only RAISES the displayed bar is not enough; the synthetic timer will still coast to its ~95% cap and lie about stalled jobs. Once a real percent is known, the synthetic ticker may only drift a few points past the last report (small headroom keeps the bar alive between throttled writes), holding — never regressing — when a late first report lands below the displayed value.

**Why:** these gaps fail silently. A runner that builds the reporter but never hands the observer to the orchestrate call compiles clean and still writes its seams — the loss only shows as bars frozen mid-render. A floor-only client keeps a synthetic timer that lies about stalled jobs.

**How to apply:** EVERY runner's EVERY orchestrate invocation gets an observer — single-stage runners band into the standard window; multi-stage runners split it into ascending per-stage bands (the reporter's monotonic guard makes boundaries safe) with stage-start label reports. Keep the claim-time reset, and any new progress consumer must implement the floor-AND-cap rule, not floor-only. Guard pass-through with a DI-level test per job kind.
