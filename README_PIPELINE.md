# Aurora Global - Node Pipeline Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Canvas Node Pipeline                     │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  Character   │    │  Audio Track │    │  Cyclorama   │  │
│  │   Input      │───→│    Node      │───→│   Studio     │  │
│  │              │    │              │    │              │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                                        │           │
│         └────────────────┬─────────────────────┘            │
│                          │                                    │
│                    ┌─────▼──────────┐                        │
│                    │ Lip-Sync Video │                        │
│                    │    Gen Node     │                        │
│                    └─────┬──────────┘                        │
│                          │                                    │
│                    ┌─────▼──────────────────────┐            │
│                    │  Motion Transfer Node      │            │
│                    │    (Optional)              │            │
│                    └─────┬──────────────────────┘            │
│                          │                                    │
│                    ┌─────▼──────────────────────┐            │
│                    │  Stage Rendering Node      │            │
│                    │   (Final Compositing)      │            │
│                    └──────────────────────────┘             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
           │
           │ Validation & Execution
           ▼
┌─────────────────────────────────────────────────────────────┐
│          GPU-First Fallback Architecture                    │
│                                                              │
│  ┌──────────────┐         ┌──────────────┐                 │
│  │  VAST.ai     │         │   Runpod     │                 │
│  │  GPU Worker  │────┬────│  GPU Worker  │                 │
│  └──────────────┘    │    └──────────────┘                 │
│                      │                                       │
│          ┌───────────▼───────────┐                          │
│          │ GPUFallbackManager    │                          │
│          │ - Health checks       │                          │
│          │ - Job submission      │                          │
│          │ - Error handling      │                          │
│          └───────────┬───────────┘                          │
│                      │                                       │
│          ┌───────────▼───────────┐                          │
│          │ Fal.ai Fallback       │                          │
│          │ - Wav2Lip             │                          │
│          │ - MimicMotion         │                          │
│          │ - Kling Video         │                          │
│          └───────────────────────┘                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Key Components

### Node Classes

1. **CharacterInputNode** - Character reference video + metadata
2. **AudioTrackNode** - Audio file with analysis data
3. **CycloramaStudioNode** - Background, lighting, and environment prompts
4. **LipSyncVideoGenNode** - Wav2Lip/Kling 2.6 generation with Fal.ai integration
5. **MotionTransferNode** - MimicMotion/Champ for body animation
6. **StageRenderingNode** - Final composition and video output

### Services

1. **GPUFallbackManager** - Routes jobs to GPU workers or Fal.ai
2. **GPUWorkerPool** - Manages VAST.ai and Runpod registrations
3. **FalAiService** - Direct Fal.ai API integration
4. **PipelineOrchestrator** - Orchestrates full pipeline execution

### UI Components

1. **CanvasValidation** - Real-time validation of node configuration
2. **RunPipelineButton** - Execute pipeline with GPU status display

## Validation Rules

### Prompt Validation (Fixes the 3-char error)

✅ **Valid**: Prompt ≥ 3 characters
✅ **Valid**: Empty prompt if visual input provided
❌ **Invalid**: Prompt 1-2 characters

### Node Connection Validation

- All connected nodes must exist
- Required nodes must be present:
  - CharacterInputNode (required for lip-sync)
  - AudioTrackNode (required for lip-sync)
  - CycloramaStudioNode (required for final render)

### GPU Capability Validation

- Motion transfer requires motion-capable GPU
- Falls back to Fal.ai if not available
- Health checks before job submission

## Execution Flow

```typescript
const orchestrator = new PipelineOrchestrator({
  falAiApiKey: 'fal_...',
  vastAiConfig: { apiKey: '...', workerId: '...' },
  runpodConfig: { apiKey: '...', workerId: '...' },
});

// Execute pipeline
await orchestrator.executePipeline(nodes, connections);

// Check results
const results = orchestrator.getExecutionHistory();
// {
//   'lipsync': { success: true, videoUrl: '...', processedBy: 'gpu' },
//   'motion-transfer': { success: true, videoUrl: '...', processedBy: 'gpu' },
// }
```

## Cost Optimization

### GPU Processing (Primary)
- **VAST.ai**: $0.30-2.00/hour (you pay hourly)
- **Runpod**: $0.50-3.00/hour (you pay hourly)
- **Cost**: Only while processing jobs

### Fal.ai (Fallback Only)
- **Cost**: ~$0.05-0.50 per video (only if GPU fails)
- **Advantage**: No setup, automatic fallback

## Error Handling

1. GPU health check fails → Try next GPU worker
2. All GPU workers fail → Fall back to Fal.ai
3. Fal.ai fails → Return error to user
4. Invalid pipeline → Show validation errors before execution

## Future Enhancements

- [ ] Batch processing optimization
- [ ] Cost tracking dashboard
- [ ] GPU utilization metrics
- [ ] Video quality/speed presets
- [ ] Webhook notifications
- [ ] Scheduled pipeline execution

## Troubleshooting

### "Pipeline has validation errors"
1. Check all prompts are ≥ 3 characters
2. Ensure all required nodes are connected
3. Verify character and audio inputs are provided

### "No motion-capable GPU backend is connected"
1. Check VAST.ai/Runpod instance is running
2. Verify API credentials in .env
3. Check worker health: `orchestrator.getWorkerStatus()`
4. Pipeline will fall back to Fal.ai automatically

### "Generation failed" (Fal.ai fallback)
1. Check Fal.ai API key is valid
2. Check rate limits: https://fal.ai/pricing
3. Verify input URLs are accessible
4. Check Fal.ai status: https://status.fal.ai/

## References

- [Validation Schema](../src/nodes/schemas/nodeValidation.ts)
- [GPU Setup Guide](./GPU_SETUP.md)
- [Fal.ai Docs](https://www.fal.ai/docs)
- [VAST.ai Docs](https://docs.vast.ai/)
- [Runpod Docs](https://docs.runpod.io/)
