import axios from 'axios';

export interface GPUWorkerConfig {
  endpoint: string;
  apiKey: string;
  capabilities: string[]; // ['motion', 'video', 'lipsync']
  maxConcurrentJobs: number;
  isHealthy?: boolean;
}

export interface ProcessingResult {
  success: boolean;
  videoUrl?: string;
  error?: string;
  processedBy: 'gpu' | 'fal-ai';
  processingTime: number;
}

export class GPUFallbackManager {
  private gpuWorkers: Map<string, GPUWorkerConfig> = new Map();
  private activeJobs: Map<string, Promise<ProcessingResult>> = new Map();
  private falAiApiKey: string;
  private fallbackThreshold = 5; // retry count before falling back

  constructor(falAiApiKey: string) {
    this.falAiApiKey = falAiApiKey;
  }

  registerGPUWorker(workerId: string, config: GPUWorkerConfig): void {
    this.gpuWorkers.set(workerId, { ...config, isHealthy: true });
  }

  async checkGPUHealth(workerId: string): Promise<boolean> {
    const worker = this.gpuWorkers.get(workerId);
    if (!worker) return false;

    try {
      const response = await axios.get(`${worker.endpoint}/health`, {
        headers: { Authorization: `Bearer ${worker.apiKey}` },
        timeout: 5000,
      });
      const isHealthy = response.status === 200;
      worker.isHealthy = isHealthy;
      return isHealthy;
    } catch (error) {
      worker.isHealthy = false;
      return false;
    }
  }

  async processLipSync(
    characterVideoUrl: string,
    audioUrl: string,
    options: {
      faceQuality: 'low' | 'medium' | 'high';
      motionIntensity: number;
      outputFramerate: number;
    }
  ): Promise<ProcessingResult> {
    const startTime = Date.now();

    // Try GPU workers first
    for (const [workerId, worker] of this.gpuWorkers) {
      if (!worker.capabilities.includes('lipsync')) continue;

      const isHealthy = await this.checkGPUHealth(workerId);
      if (!isHealthy) continue;

      try {
        const result = await this.submitGPUJob(workerId, 'lipsync', {
          character_video_url: characterVideoUrl,
          audio_url: audioUrl,
          face_quality: options.faceQuality,
          motion_intensity: options.motionIntensity,
          output_framerate: options.outputFramerate,
        });

        if (result.success) {
          return {
            success: true,
            videoUrl: result.videoUrl,
            processedBy: 'gpu',
            processingTime: Date.now() - startTime,
          };
        }
      } catch (error) {
        console.warn(`GPU worker ${workerId} failed:`, error);
        worker.isHealthy = false;
        continue; // Try next worker
      }
    }

    // Fall back to Fal.ai
    console.log('GPU processing failed or unavailable. Falling back to Fal.ai...');
    return this.procesWithFalAi('lipsync', {
      character_video_url: characterVideoUrl,
      audio_url: audioUrl,
      face_quality: options.faceQuality,
      motion_intensity: options.motionIntensity,
      output_framerate: options.outputFramerate,
    });
  }

  async processMotionTransfer(
    sourceVideoUrl: string,
    motionVideoUrl: string,
    options: {
      motionIntensity: number;
      preserveIdentity: boolean;
      outputResolution: '720p' | '1080p' | '4k';
    }
  ): Promise<ProcessingResult> {
    const startTime = Date.now();

    // Try GPU workers with motion capability
    for (const [workerId, worker] of this.gpuWorkers) {
      if (!worker.capabilities.includes('motion')) continue;

      const isHealthy = await this.checkGPUHealth(workerId);
      if (!isHealthy) continue;

      try {
        const result = await this.submitGPUJob(workerId, 'motion-transfer', {
          source_video_url: sourceVideoUrl,
          motion_video_url: motionVideoUrl,
          motion_intensity: options.motionIntensity,
          preserve_identity: options.preserveIdentity,
          output_resolution: options.outputResolution,
        });

        if (result.success) {
          return {
            success: true,
            videoUrl: result.videoUrl,
            processedBy: 'gpu',
            processingTime: Date.now() - startTime,
          };
        }
      } catch (error) {
        console.warn(`GPU worker ${workerId} failed motion transfer:`, error);
        worker.isHealthy = false;
        continue;
      }
    }

    // Fall back to Fal.ai
    console.log('Motion transfer on GPU failed. Falling back to Fal.ai...');
    return this.procesWithFalAi('motion-transfer', {
      source_video_url: sourceVideoUrl,
      motion_video_url: motionVideoUrl,
      motion_intensity: options.motionIntensity,
      preserve_identity: options.preserveIdentity,
      output_resolution: options.outputResolution,
    });
  }

  private async submitGPUJob(
    workerId: string,
    jobType: string,
    payload: Record<string, any>
  ): Promise<{ success: boolean; videoUrl?: string }> {
    const worker = this.gpuWorkers.get(workerId);
    if (!worker) throw new Error(`Worker ${workerId} not found`);

    const response = await axios.post(
      `${worker.endpoint}/process/${jobType}`,
      payload,
      {
        headers: { Authorization: `Bearer ${worker.apiKey}` },
        timeout: 600000, // 10 minute timeout for GPU processing
      }
    );

    return response.data;
  }

  private async procesWithFalAi(
    jobType: string,
    payload: Record<string, any>
  ): Promise<ProcessingResult> {
    const startTime = Date.now();

    try {
      const modelMap = {
        lipsync: 'fal-ai/wav2lip',
        'motion-transfer': 'fal-ai/mimic-motion',
      };

      const response = await axios.post(
        `https://api.falai.com/v1/predict`,
        {
          model_name: modelMap[jobType as keyof typeof modelMap],
          input: payload,
        },
        {
          headers: {
            Authorization: `Bearer ${this.falAiApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 300000, // 5 minute timeout
        }
      );

      if (response.data.status === 'succeeded') {
        return {
          success: true,
          videoUrl: response.data.output.video_url,
          processedBy: 'fal-ai',
          processingTime: Date.now() - startTime,
        };
      } else {
        return {
          success: false,
          error: `Fal.ai processing failed: ${response.data.error || 'Unknown error'}`,
          processedBy: 'fal-ai',
          processingTime: Date.now() - startTime,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Fal.ai processing error: ${error instanceof Error ? error.message : 'Unknown'}`,
        processedBy: 'fal-ai',
        processingTime: Date.now() - startTime,
      };
    }
  }

  getWorkerStatus(): Record<string, { healthy: boolean; capabilities: string[] }> {
    const status: Record<string, { healthy: boolean; capabilities: string[] }> = {};
    for (const [workerId, worker] of this.gpuWorkers) {
      status[workerId] = {
        healthy: worker.isHealthy ?? false,
        capabilities: worker.capabilities,
      };
    }
    return status;
  }
}
