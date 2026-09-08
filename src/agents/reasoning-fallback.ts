/**
 * REASONING FALLBACK AGENT
 * DeepSeek-V4-Pro-GA with complex reasoning capabilities
 * 
 * Handles:
 * - Complex media generation requests
 * - Multi-step reasoning tasks
 * - Error recovery from primary agent
 * - Code generation and explanation
 */

import { ReasoningConfig, ReasoningRequest, ReasoningResponse } from './types';

export class ReasoningFallback {
  private config: ReasoningConfig;
  private sessionId: string;
  private apiKey: string;
  private baseUrl: string;

  constructor(config: ReasoningConfig) {
    this.config = config;
    this.apiKey = config.apiKey || process.env.ARK_API_KEY || '';
    this.baseUrl = config.baseUrl || 'https://ark.ap-southeast.bytepluses.com/api/v3';
    this.sessionId = config.sessionId || this.generateSessionId();
  }

  /**
   * Process complex reasoning request
   * Uses DeepSeek-V4-Pro-GA for multi-step analysis
   */
  async process(request: ReasoningRequest): Promise<ReasoningResponse> {
    console.log('[ReasoningFallback] Processing with DeepSeek-V4-Pro-GA...');
    
    const prompt = this.buildPrompt(request);
    
    try {
      const response = await this.sendMessage(prompt);
      
      return {
        success: true,
        reasoning: response.reasoning || '',
        result: response.content || '',
        model: 'deepseek-v4-pro-ga',
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('[ReasoningFallback] Error:', error);
      throw new Error(`Reasoning fallback failed: ${error}`);
    }
  }

  /**
   * Send message to reasoning agent via ARK API
   */
  private async sendMessage(text: string): Promise<any> {
    const response = await fetch(
      `${this.baseUrl}/sessions/${this.sessionId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: 'user',
          content: text,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Build prompt based on request type
   */
  private buildPrompt(request: ReasoningRequest): string {
    const requestType = request.type || 'general';

    switch (requestType) {
      case 'video-generation':
        return this.buildVideoPrompt(request);
      
      case 'image-generation':
        return this.buildImagePrompt(request);
      
      case 'code-generation':
        return this.buildCodePrompt(request);
      
      case 'reasoning':
      default:
        return this.buildReasoningPrompt(request);
    }
  }

  /**
   * Build video generation prompt
   */
  private buildVideoPrompt(request: ReasoningRequest): string {
    return `You are a professional video generation expert. 
    
Generate detailed instructions for creating: "${request.prompt}"

Consider:
- Visual composition and cinematography
- Duration and pacing
- Color grading and mood
- Scene transitions
- Audio elements (if applicable)
- Technical specifications: ${request.resolution || '16:9'}, ${request.duration || 5} seconds, ${request.fps || 30} fps

Provide:
1. Scene-by-scene breakdown
2. Visual style and mood description
3. Technical parameters for optimal generation
4. Fallback suggestions if primary generation fails`;
  }

  /**
   * Build image generation prompt
   */
  private buildImagePrompt(request: ReasoningRequest): string {
    return `You are a professional image generation expert.

Generate detailed instructions for creating: "${request.prompt}"

Consider:
- Composition and framing
- Lighting and shadows
- Color palette and mood
- Artistic style
- Level of detail
- Technical specifications: ${request.resolution || '4K'}

Provide:
1. Detailed visual description
2. Art style and reference influences
3. Technical parameters for optimal generation
4. Specific details to emphasize`;
  }

  /**
   * Build code generation prompt
   */
  private buildCodePrompt(request: ReasoningRequest): string {
    return `You are an expert software engineer.

${request.prompt}

Provide:
1. Step-by-step solution approach
2. Clean, well-documented code
3. Complexity analysis
4. Example usage
5. Edge cases and error handling
6. Performance considerations`;
  }

  /**
   * Build general reasoning prompt
   */
  private buildReasoningPrompt(request: ReasoningRequest): string {
    return `You are an expert reasoning assistant with deep analytical capabilities.

Please provide comprehensive reasoning and analysis for:
${request.prompt}

Think through this step-by-step, considering:
- Key factors and dependencies
- Potential challenges and solutions
- Multiple perspectives
- Implementation details
- Quality metrics and validation`;
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    const timestamp = new Date().toISOString().replace(/[:-]/g, '');
    const random = Math.random().toString(36).substr(2, 5);
    return `sesn-${timestamp.slice(0, 14)}-${random}`;
  }

  /**
   * Set custom session ID
   */
  setSessionId(id: string): void {
    this.sessionId = id;
  }

  /**
   * Get current session info
   */
  getSessionInfo() {
    return {
      sessionId: this.sessionId,
      model: 'deepseek-v4-pro-ga',
      baseUrl: this.baseUrl,
    };
  }
}

export { ReasoningConfig, ReasoningRequest, ReasoningResponse };
