---
name: aurora-effects
description: "Aurora video effects and compositing skill: effect chains, keyframes, transitions, blur, glow, grain, chromatic aberration, speed ramps, freeze frames, camera moves, overlays and color looks."
---

# Aurora Effects

Treat effects as data, not hard-coded UI behavior.

## Effect contract

Each effect has:
- stable id
- label
- category
- parameter schema
- default values
- UI hints
- Remotion implementation key
- optional browser-preview implementation
- serialization version

## Core effect families

### Motion
- speed ramp
- freeze frame
- time remap
- motion blur
- camera push
- camera pull
- orbit/parallax
- shake

### Optics
- bloom
- diffusion
- vignette
- film grain
- chromatic aberration
- lens flare
- depth blur
- sharpen

### Stylization
- VHS
- scanlines
- halation
- film gate
- noir
- neon glow
- RGB split
- posterize

### Transitions
- hard cut
- dip to black
- dip to white
- whip
- zoom
- glitch
- flash
- match dissolve

### Compositing
- blend modes
- masks
- keying
- overlays
- text-safe zones
- letterbox

Prefer native Aurora/Remotion implementations. If an effect requires a shader, keep it isolated behind the registry contract.
