import { PipelineOrchestrator } from '../services/PipelineOrchestrator';

/**
 * Initialize the pipeline orchestrator with your GPU workers and Fal.ai fallback
 */
export function initializePipelineOrchestrator(): PipelineOrchestrator {
  const orchestrator = new PipelineOrchestrator({
    // Fal.ai fallback (required)
    falAiApiKey: process.env.REACT_APP_FAL_AI_API_KEY || '',
    
    // VAST.ai GPU worker (optional)
    vastAiConfig: process.env.REACT_APP_VAST_AI_API_KEY ? {
      apiKey: process.env.REACT_APP_VAST_AI_API_KEY,
      workerId: process.env.REACT_APP_VAST_AI_WORKER_ID || '',
      capabilities: ['motion', 'video', 'lipsync'],
    } : undefined,
    
    // Runpod GPU worker (optional)
    runpodConfig: process.env.REACT_APP_RUNPOD_API_KEY ? {
      apiKey: process.env.REACT_APP_RUNPOD_API_KEY,
      workerId: process.env.REACT_APP_RUNPOD_WORKER_ID || '',
      capabilities: ['motion', 'video', 'lipsync'],
    } : undefined,
  });

  console.log('Pipeline orchestrator initialized');
  console.log('Available workers:', orchestrator.getWorkerStatus());
  
  return orchestrator;
}

/**
 * Example usage in a React component:
 * 
 * ```typescript
 * import { initializePipelineOrchestrator } from '@/lib/orchestratorSetup';
 * 
 * export function MyComponent() {
 *   const orchestrator = React.useMemo(() => initializePipelineOrchestrator(), []);
 *   
 *   const handleRunPipeline = async () => {
 *     try {
 *       await orchestrator.executePipeline(nodes, connections);
 *       const results = orchestrator.getExecutionHistory();
 *       console.log('Pipeline complete:', results);
 *     } catch (error) {
 *       console.error('Pipeline failed:', error);
 *     }
 *   };
 * }
 * ```
 */
