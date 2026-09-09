/**
 * COORDINATOR AGENT (v3)
 * Multi-agent orchestration for Aurora media generation
 * 
 * Architecture:
 * - Primary: Dola-Seed-2.1-turbo with code tools
 * - Fallback: DeepSeek-V4-Pro-GA for complex reasoning
 * - Capabilities: Image & video generation via seedance & seedream
 */

import { CoordinatorConfig, MediaRequest, MediaResponse, AgentState } from './types';
import { ReasoningFallback } from './reasoning-fallback';

export class CoordinatorAgent {
  private config: CoordinatorConfig;
  private reasoningFallback: ReasoningFallback;
  private state: AgentState;

  constructor(config: CoordinatorConfig) {
    this.config = config;
    this.reasoningFallback = new ReasoningFallback({
      apiKey: config.deepseekApiKey,
      model: 'deepseek-v4-pro-ga',
      timeout: config.reasoningTimeout || 30000,
    });
    
    this.state = {
      isProcessing: false,
      currentTask: null,
      requestQueue: [],
      mediaGenerations: [],
    };
  }

  /**
   * Process media generation request
   * Routes to appropriate generator (image/video)
   */
  async processRequest(request: MediaRequest): Promise<MediaResponse> {
    if (this.state.isProcessing) {
      this.state.requestQueue.push(request);
      return { queued: true, queuePosition: this.state.requestQueue.length };
    }

    this.state.isProcessing = true;
    this.state.currentTask = request;

    try {
      const mediaType = this.detectMediaType(request.prompt);
      
      let result: MediaResponse;
      
      if (mediaType === 'video') {
        result = await this.generateVideo(request);
      } else {
        result = await this.generateImage(request);
      }

      // Track generation
      this.state.mediaGenerations.push({
        id: result.id || Math.random().toString(36).substr(2, 9),
        type: mediaType,
        prompt: request.prompt,
        timestamp: new Date(),
        status: 'completed',
      });

      return result;
    } catch (error) {
      console.error('[Coordinator] Primary generation failed, invoking reasoning fallback...');
      
      // Fallback to reasoning agent for complex cases
      return await this.reasoningFallback.process(this.state.currentTask!);
    } finally {
      this.state.isProcessing = false;
      
      // Process next queued request
      if (this.state.requestQueue.length > 0) {
        const nextRequest = this.state.requestQueue.shift()!;
        return this.processRequest(nextRequest);
      }
    }
  }

  /**
   * Generate image using seedance
   */
  private async generateImage(request: MediaRequest): Promise<MediaResponse> {
    console.log('[Coordinator] Routing to image generator (seedance)...');
    
    const response = await fetch(`${this.config.baseUrl}/generate-image`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: request.prompt,
        model: 'seedance',
        quality: request.quality || 'high',
        resolution: request.resolution || '4K',
      }),
    });

    if (!response.ok) {
      throw new Error(`Image generation failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Generate video using seedream
   */
  private async generateVideo(request: MediaRequest): Promise<MediaResponse> {
    console.log('[Coordinator] Routing to video generator (seedream)...');
    
    const response = await fetch(`${this.config.baseUrl}/generate-video`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: request.prompt,
        model: 'seedream',
        duration: request.duration || 5,
        resolution: request.resolution || '16:9',
        fps: request.fps || 30,
      }),
    });

    if (!response.ok) {
      throw new Error(`Video generation failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Detect if prompt is for image or video generation
   */
  private detectMediaType(prompt: string): 'image' | 'video' {
    const videoKeywords = [
      'video', 'moving', 'sequence', 'animation', 'second', 'duration', 
      'motion', 'clip', 'frame', 'fps', 'crashing', 'flowing', 'waving'
    ];
    
    const lowerPrompt = prompt.toLowerCase();
    const isVideo = videoKeywords.some(keyword => lowerPrompt.includes(keyword));
    
    return isVideo ? 'video' : 'image';
  }

  /**
   * Get current agent state
   */
  getState(): AgentState {
    return { ...this.state };
  }

  /**
   * Reset agent state
   */
  reset(): void {
    this.state = {
      isProcessing: false,
      currentTask: null,
      requestQueue: [],
      mediaGenerations: [],
    };
  }
}

export { CoordinatorConfig, MediaRequest, MediaResponse };
