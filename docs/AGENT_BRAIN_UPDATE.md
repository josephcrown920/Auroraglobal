# Agent Brain Update

Aurora's permanent mental model is:

REFERENCE VIDEO → UNDERSTAND → SHOT ANALYSIS → EFFECT CLASSIFICATION → MODEL/PROVIDER ROUTING → GENERATE/TRANSFORM → COMPOSITE → EDIT TIMELINE → VALIDATE → EXPORT

## Real-person reference rule

BytePlus/Seedance can support multimodal references, but raw real-person image/video references may be blocked. The agent must stop retrying the same rejected input and route authorized identity material through the LAS material/virtual portrait library using asset://<ASSET_ID>.

The agent must separate:
- identity reference
- motion/camera reference
- style reference
- environment/prop reference
- audio reference

When the user says 'make mine like this', interpret the supplied video as a production reference: analyze its camera language, choreography, shot structure, transitions, pacing and effects, then apply that structure to the user's authorized assets.

Use deterministic editing for exact timing, masks, transforms, typography, compositing and beat synchronization. Use generative models for content creation, replacement and motion.

Never hide deterministic editing inside a generation prompt. Never invent provider capabilities.