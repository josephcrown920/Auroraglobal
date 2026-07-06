import { GPUFallbackManager, ProcessingResult } from '../services/GPUFallbackManager';
import { GPUWorkerPool } from '../services/GPUWorkerPool';
import { FalAiService } from '../services/FalAiService';
import {
  CharacterInputNode,
  AudioTrackNode,
  CycloramaStudioNode,
  LipSyncVideoGenNode,
  MotionTransferNode,
  StageRenderingNode,
} from '../nodes';

export interface PipelineOrchestrationConfig {
  falAiApiKey: string;
  vastAiConfig?: {
    apiKey: string;
    workerId?: string;
    capabilities?: string[];
  };
  runpodConfig?: {
    apiKey: string;
    workerId?: string;
    capabilities?: string[];
  };
  customGpuEndpoints?: Array<{
    endpoint: string;
    apiKey: string;
    workerId: string;
    capabilities: string[];
  }>;
}

export class PipelineOrchestrator {
  private workerPool: GPUWorkerPool;
  private gpuFallbackManager: GPUFallbackManager;
  private falAiService: FalAiService;
  private executionHistory: Map<string, ProcessingResult> = new Map();

  constructor(config: PipelineOrchestrationConfig) {
    this.workerPool = new GPUWorkerPool(config.falAiApiKey);
    this.gpuFallbackManager = this.workerPool.getManager();
    this.falAiService = new FalAiService({ apiKey: config.falAiApiKey });

    // Register GPU workers
    if (config.vastAiConfig?.apiKey && config.vastAiConfig?.workerId) {
      this.workerPool.addVASTAiWorker({
        vastApiKey: config.vastAiConfig.apiKey,
        workerId: config.vastAiConfig.workerId,
        capabilities: config.vastAiConfig.capabilities || ['motion', 'video', 'lipsync'],
      });
    }

    if (config.runpodConfig?.apiKey && config.runpodConfig?.workerId) {
      this.workerPool.addRunpodWorker({
        runpodApiKey: config.runpodConfig.apiKey,
        workerId: config.runpodConfig.workerId,
        capabilities: config.runpodConfig.capabilities || ['motion', 'video', 'lipsync'],
      });
    }

    if (config.customGpuEndpoints) {
      config.customGpuEndpoints.forEach((endpoint) => {
        this.workerPool.addCustomGPUEndpoint(endpoint);
      });
    }
  }

  async executePipeline(nodes: Map<string, any>, connections: any[]): Promise<void> {
    try {
      console.log('Starting pipeline execution...');
      console.log('Available GPU workers:', this.gpuFallbackManager.getWorkerStatus());

      // Validate pipeline structure
      const characterInputNode = nodes.get(
        Array.from(nodes.keys()).find((id) => nodes.get(id)?.type === 'character-input') || ''
      );
      const audioTrackNode = nodes.get(
        Array.from(nodes.keys()).find((id) => nodes.get(id)?.type === 'audio-track') || ''
      );
      const studioNode = nodes.get(
        Array.from(nodes.keys()).find((id) => nodes.get(id)?.type === 'cyclorama-studio') || ''
      );

      if (!characterInputNode || !audioTrackNode) {
        throw new Error('Missing required Character Input or Audio Track node');
      }

      // Step 1: Process Lip-Sync
      console.log('Step 1: Processing lip-sync...');
      const lipSyncResult = await this.gpuFallbackManager.processLipSync(
        characterInputNode.data.referenceImage,
        audioTrackNode.data.audioUrl,
        {
          faceQuality: 'high',
          motionIntensity: 0.7,
          outputFramerate: 30,
        }
      );
      console.log('Lip-sync result:', lipSyncResult);
      this.executionHistory.set('lipsync', lipSyncResult);

      if (!lipSyncResult.success) {
        throw new Error(`Lip-sync processing failed: ${lipSyncResult.error}`);
      }

      // Step 2: Process Motion Transfer (if needed)
      const motionTransferNode = nodes.get(
        Array.from(nodes.keys()).find((id) => nodes.get(id)?.type === 'motion-transfer') || ''
      );

      let motionTransferResult: ProcessingResult | null = null;
      if (motionTransferNode) {
        console.log('Step 2: Processing motion transfer...');
        motionTransferResult = await this.gpuFallbackManager.processMotionTransfer(
          lipSyncResult.videoUrl!,
          audioTrackNode.data.audioUrl,
          {
            motionIntensity: motionTransferNode.data.motionIntensity,
            preserveIdentity: motionTransferNode.data.preserveIdentity,
            outputResolution: motionTransferNode.data.outputResolution,
          }
        );
        console.log('Motion transfer result:', motionTransferResult);
        this.executionHistory.set('motion-transfer', motionTransferResult);

        if (!motionTransferResult.success) {
          console.warn(`Motion transfer failed: ${motionTransferResult.error}`);
          // Continue with lip-sync result if motion transfer fails
          motionTransferResult = null;
        }
      }

      // Step 3: Final Stage Rendering
      const renderNode = nodes.get(
        Array.from(nodes.keys()).find((id) => nodes.get(id)?.type === 'stage-rendering') || ''
      );

      if (renderNode && studioNode) {
        console.log('Step 3: Rendering final stage...');
        const finalVideoUrl = motionTransferResult?.videoUrl || lipSyncResult.videoUrl;
        const studioPrompt = studioNode.data?.environmentPrompt || 'professional music video studio';

        // This would be handled by another service or Fal.ai endpoint
        console.log('Final render inputs:', {
          video: finalVideoUrl,
          studio: studioPrompt,
        });
      }

      console.log('✓ Pipeline execution completed successfully');
      console.log('Execution history:', Array.from(this.executionHistory.entries()));
    } catch (error) {
      console.error('Pipeline execution failed:', error);
      throw error;
    }
  }

  getExecutionHistory(): Record<string, ProcessingResult> {
    const history: Record<string, ProcessingResult> = {};
    this.executionHistory.forEach((result, key) => {
      history[key] = result;
    });
    return history;
  }

  getWorkerStatus() {
    return this.gpuFallbackManager.getWorkerStatus();
  }

  clearExecutionHistory(): void {
    this.executionHistory.clear();
  }
}
