# Aurora Video Agent — Source Export

This folder is a source export of Aurora's current Video Agent capabilities.
It is intended for review, handoff, backup, or integration into another Aurora
environment. It is **not a standalone application**: the exported files use
Aurora's TanStack Start routes, Supabase authentication, AI router, pricing,
orchestration, UI components, aliases, and global styles.

## Included capabilities

### Prompt composer

Route: `/video-agent`

- Prompt-based video project creation
- Cinematic, minimal, vibrant, and documentary visual directions
- Target lengths from roughly 30 seconds to 2 minutes
- Deep narrator, warm narrator, news anchor, and conversational voice choices
- Recent project links
- Project settings panel

Source: `src/routes/video-agent.lazy.tsx`

### AI script and storyboard pipeline

Route: `/video-agent-process?id=<project-id>`

- Structured AI script generation
- Automatic scene breakdown
- Scene titles, narration, durations, and camera descriptions
- Cinematic keyframe generation for every scene
- Progress display and step status
- Agent activity log
- Scene thumbnail strip
- Partial-result and failed-frame states
- Automatic handoff to the editor

Sources:

- `src/routes/video-agent-process.lazy.tsx`
- `src/routes/api/video-agent/generate-script.ts`
- `src/routes/api/video-agent/generate-frame.ts`

### Storyboard editor

Route: `/video-agent-edit?id=<project-id>`

- Scene thumbnail strip
- Scene selection and previous/next navigation
- Scene title editing
- Voiceover script editing
- Camera/visual description editing
- Add and remove scenes
- Frame regeneration
- Preview/edit tabs
- Project title editing
- Export state action

Source: `src/routes/video-agent-edit.lazy.tsx`

### Prompt enhancement for avatar videos

The server-side Video Agent functions include an authenticated prompt
enhancement pass for spoken avatar videos:

- Converts rough ideas into natural spoken scripts
- Supports direct-to-camera delivery
- Supports cinematic narration
- Supports target spoken duration
- Supports HeyGen style blocks
- Sanitizes timestamps, stage directions, metadata labels, and production
  instructions that would otherwise be spoken aloud
- Applies a per-user rate limit

Source: `src/lib/video-agent.functions.ts`

### Cinematic director analysis

The skill pack can generate a structured cinematic plan containing:

- Brief, logline, genre, mood, era, and identity anchor
- Palette and named visual references
- Motion language
- Lens and film/look direction
- Lighting setup
- Camera movement
- Pacing and sound register
- Four to eight production shots
- Shot type, action, duration, camera, lighting, prompts, and negative prompts
- Starting-frame and shot-chaining hints
- Render-plan metadata

Source: `src/lib/video-agent-skills.ts`

### HeyGen full-video generation

The server capability supports authenticated, Aura-priced HeyGen Video Agent
generation:

- Prompt in, full avatar video out
- Portrait or landscape orientation
- Atomic reservation through Aurora's generation core
- Pinned `heygen/video-agent` model routing
- Provider generation ID and result URL
- Specific handling for HeyGen's separate API-credit exhaustion

Source: `src/lib/video-agent.functions.ts`

The actual provider adapter lives in Aurora's shared orchestrator and is not
duplicated in this export:

- `src/lib/orchestrator.server.ts`
- `src/lib/generate-core.server.ts`
- `src/lib/pricing.ts`

### Seedance 2.0 prompt support

The skill pack documents Seedance reference prompting:

- Up to nine images
- Up to three videos
- Up to three audio files
- First-frame and last-frame roles
- Character, wardrobe, scene, motion, camera, rhythm, and sound roles
- Time-segmented prompts
- Camera vocabulary and input limits

This export includes the prompt guidance. It does not claim that the standard
storyboard flow currently uploads those assets or renders through Seedance.

### Project persistence

The current storyboard flow persists projects in browser `localStorage`.
Projects contain:

- Prompt and title
- Style, voice, and target duration
- Scene list
- Frame URLs and frame status
- Voiceover status
- Project status and status message
- Creation/update timestamps
- Thumbnail and export URL fields

Source: `src/lib/video-agent-store.ts`

## Exported files

```text
src/
├── lib/
│   ├── video-agent.functions.ts
│   ├── video-agent-prompt.test.ts
│   ├── video-agent-prompt.ts
│   ├── video-agent-skills.ts
│   └── video-agent-store.ts
├── routes/
│   ├── agent.tsx
│   ├── api/video-agent/
│   │   ├── generate-frame.ts
│   │   └── generate-script.ts
│   ├── video-agent.tsx
│   ├── video-agent.lazy.tsx
│   ├── video-agent-process.tsx
│   ├── video-agent-process.lazy.tsx
│   ├── video-agent-edit.tsx
│   └── video-agent-edit.lazy.tsx
└── styles.css
```

The root `package.json` is included as `package.json.reference.json` so the
bundle records the dependency versions used by Aurora without pretending that
the export is a separate package.

## Required Aurora dependencies

The exported UI expects:

- React and React DOM
- TanStack Start and TanStack Router
- `lucide-react`
- `zod`
- Aurora's `Button`, `Input`, and `Textarea` components
- Aurora's `@/` TypeScript path alias
- Aurora's global `glass`, `aurora-*`, and Video Agent CSS classes

The server-side capabilities additionally expect:

- Aurora Supabase auth middleware
- Aurora AI router
- Aurora generation core
- Aurora pricing and orchestrator
- Provider configuration for the selected model

## Integration notes

1. Copy the exported `src` files into an Aurora TanStack Start project.
2. Preserve the route filenames and search parameters:
   - `/video-agent`
   - `/video-agent-process?id=...`
   - `/video-agent-edit?id=...`
3. Ensure the API routes are registered by the host router.
4. Import the required global stylesheet.
5. Keep the shared Aurora server modules available for
   `video-agent.functions.ts`.
6. Configure the provider and Supabase environment through the host project's
   normal secrets flow.
7. Run the host project's typecheck and tests before enabling customer access.

## Current production status

This export reflects the current implementation, including its limitations:

- The standard storyboard pipeline generates scripts and keyframe images.
- Standard-pipeline voiceover is currently simulated.
- Standard-pipeline compilation is currently simulated.
- Standard Export does not yet produce a final MP4.
- Standard projects are stored in browser `localStorage`.
- The exported storyboard API handlers currently use the existing Aurora route
  behavior and should be authenticated and Aura-metered before public launch.
- Pollinations storyboard URLs are external and are not automatically copied
  into durable Aurora storage by this flow.
- Closing the browser during the client-run pipeline can interrupt the flow.
- The separate authenticated HeyGen path is the current real full-video path.

In short, the standard flow is a video planning and storyboard editor; the
HeyGen path is the current prompt-to-avatar-video capability. Treat the
standard flow as pre-launch until durable jobs, authentication, credit
reservation, real voice/rendering, and final-video persistence are wired in.

## Validation

From the Aurora project root:

```bash
npm run typecheck
npm test
```

The included unit test covers spoken-script sanitization and word-budget
calculation:

```bash
bun test src/lib/video-agent-prompt.test.ts
```
