# GPU Worker & Pipeline Configuration Guide

## Overview

Your Aurora Global pipeline is configured to use a **GPU-first, Fal.ai fallback** architecture:

1. **GPU Processing (VAST.ai + Runpod)** → Free/cheap (you pay for compute)
2. **API Fallback (Fal.ai)** → Automatic if GPU unavailable

## Setup Instructions

### 1. VAST.ai Configuration

#### Getting Your API Key & Worker ID:

```bash
# Step 1: Go to https://www.vast.ai/
# Step 2: Sign up or login
# Step 3: Dashboard → Settings → API Keys
# Step 4: Create a new API key (copy it)
# Step 5: Dashboard → Instances → Your Running Instance
# Step 6: Note the Worker/Instance ID
```

#### Set Environment Variables:

```bash
# .env or .env.local
VAST_AI_API_KEY=your_key_here
VAST_AI_WORKER_ID=your_worker_id_here
```

#### Verify Connection:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.vast.ai/v0/workers/YOUR_WORKER_ID/health
```

---

### 2. Runpod Configuration

#### Getting Your API Key & Pod ID:

```bash
# Step 1: Go to https://www.runpod.io/
# Step 2: Sign up or login
# Step 3: Dashboard → Account Settings → API Keys
# Step 4: Create a new key (copy it)
# Step 5: Dashboard → Pods → Your Running Pod
# Step 6: Note the Pod ID (usually in the URL or pod details)
```

#### Set Environment Variables:

```bash
# .env or .env.local
RUNPOD_API_KEY=your_key_here
RUNPOD_WORKER_ID=your_pod_id_here
```

#### Verify Connection:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.runpod.io/v1/YOUR_POD_ID/health
```

---

### 3. Fal.ai Configuration (Fallback)

#### Getting Your API Key:

```bash
# Step 1: Go to https://fal.ai/
# Step 2: Sign up or login (free tier available)
# Step 3: Go to API Keys section
# Step 4: Create a new key (copy it)
```

#### Set Environment Variables:

```bash
# .env or .env.local
FAL_AI_API_KEY=your_key_here
```

#### Verify Connection:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.fal.ai/v1/health
```

---

## Pipeline Execution Flow

### When you click "Run Pipeline":

```
1. Check VAST.ai worker health
   ↓ (if healthy)
2. Submit lip-sync job to VAST.ai
   ↓ (if fails)
3. Check Runpod worker health
   ↓ (if healthy)
4. Submit lip-sync job to Runpod
   ↓ (if fails)
5. Fall back to Fal.ai wav2lip
   ↓ (if succeeds)
6. Process motion transfer (same GPU→Fal.ai flow)
   ↓
7. Final stage rendering + compositing
   ↓
8. Return final video URL
```

## Cost Breakdown

### VAST.ai (GPU Rental)
- **Pros**: Usually $0.30-$2.00/hour for suitable GPUs
- **Models Supported**: Wav2Lip, MimicMotion, Champ
- **Your Cost**: Pay hourly rental fee only while running

### Runpod (GPU Rental)
- **Pros**: Similar pricing, usually $0.50-$3.00/hour
- **Models Supported**: Same as VAST.ai
- **Your Cost**: Pay hourly rental fee only while running

### Fal.ai (Fallback Only)
- **Pros**: Reliable, no setup needed, per-API-call billing
- **Cost**: ~$0.05-$0.50 per video generation (fallback only)
- **Usage**: Only triggered if GPU workers fail

## Troubleshooting

### "No motion-capable GPU backend is connected"

```typescript
// Check in browser console:
const orchestrator = new PipelineOrchestrator({...});
console.log(orchestrator.getWorkerStatus());
// Should show: { "vast-ai": { healthy: true, ... }, "runpod": { healthy: true, ... } }
```

### GPU Worker Not Responding

1. Check that the GPU instance is still running on VAST.ai/Runpod
2. Verify API key is correct
3. Check network connectivity: `ping api.vast.ai` or `ping api.runpod.io`
4. View logs in VAST.ai/Runpod dashboard
5. Pipeline will automatically fall back to Fal.ai

### Fal.ai API Rate Limits

- Free tier: 100 requests/month
- Pro tier: Unlimited (pay-as-you-go)
- Upgrade: https://fal.ai/pricing

## Optimization Tips

### 1. Keep GPU Instances Warm

```bash
# Run a health check every 5 minutes to prevent auto-shutdown
# VAST.ai and Runpod have idle timeouts
```

### 2. Batch Processing

```typescript
// Process multiple videos efficiently
const results = await Promise.all([
  orchestrator.executePipeline(nodes1, connections),
  orchestrator.executePipeline(nodes2, connections),
  // GPU will queue jobs, reducing overhead
]);
```

### 3. Monitor Costs

```typescript
const history = orchestrator.getExecutionHistory();
// Check processedBy: 'gpu' vs 'fal-ai' to track costs
const gpuCost = Object.values(history)
  .filter(r => r.processedBy === 'gpu').length; // GPU jobs = hourly rental
const falAiCost = Object.values(history)
  .filter(r => r.processedBy === 'fal-ai').length; // Fal.ai jobs = per-call
```

## Advanced Configuration

### Custom GPU Endpoint

If you have your own GPU server:

```typescript
const orchestrator = new PipelineOrchestrator({
  falAiApiKey: process.env.FAL_AI_API_KEY,
  customGpuEndpoints: [
    {
      endpoint: 'https://my-gpu-server.com',
      apiKey: 'my-auth-token',
      workerId: 'custom-gpu-1',
      capabilities: ['motion', 'video', 'lipsync'],
    },
  ],
});
```

## Support

- **VAST.ai Support**: https://support.vast.ai/
- **Runpod Support**: https://docs.runpod.io/
- **Fal.ai Support**: https://fal.ai/support/

## Next Steps

1. ✅ Configure environment variables
2. ✅ Test GPU worker connections
3. ✅ Create a test node pipeline
4. ✅ Click "Run Pipeline" and monitor execution
5. ✅ Check worker status and costs in dashboard
