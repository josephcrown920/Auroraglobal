import { GPUFallbackManager, GPUWorkerConfig } from './GPUFallbackManager';

export class GPUWorkerPool {
  private manager: GPUFallbackManager;
  private workers: Map<string, GPUWorkerConfig> = new Map();

  constructor(falAiApiKey: string) {
    this.manager = new GPUFallbackManager(falAiApiKey);
  }

  addVASTAiWorker(config: {
    vastApiKey: string;
    workerId: string;
    capabilities?: string[];
  }): void {
    const workerConfig: GPUWorkerConfig = {
      endpoint: `https://api.vast.ai/v0/workers/${config.workerId}`,
      apiKey: config.vastApiKey,
      capabilities: config.capabilities || ['motion', 'video', 'lipsync'],
      maxConcurrentJobs: 1,
    };
    this.workers.set(config.workerId, workerConfig);
    this.manager.registerGPUWorker(config.workerId, workerConfig);
  }

  addRunpodWorker(config: {
    runpodApiKey: string;
    workerId: string;
    capabilities?: string[];
  }): void {
    const workerConfig: GPUWorkerConfig = {
      endpoint: `https://api.runpod.io/v1/${config.workerId}`,
      apiKey: config.runpodApiKey,
      capabilities: config.capabilities || ['motion', 'video', 'lipsync'],
      maxConcurrentJobs: 1,
    };
    this.workers.set(config.workerId, workerConfig);
    this.manager.registerGPUWorker(config.workerId, workerConfig);
  }

  addCustomGPUEndpoint(config: {
    endpoint: string;
    apiKey: string;
    workerId: string;
    capabilities: string[];
  }): void {
    const workerConfig: GPUWorkerConfig = {
      endpoint: config.endpoint,
      apiKey: config.apiKey,
      capabilities: config.capabilities,
      maxConcurrentJobs: 1,
    };
    this.workers.set(config.workerId, workerConfig);
    this.manager.registerGPUWorker(config.workerId, workerConfig);
  }

  getManager(): GPUFallbackManager {
    return this.manager;
  }

  getWorkerCount(): number {
    return this.workers.size;
  }
}
