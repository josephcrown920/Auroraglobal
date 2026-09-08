/**
 * Media Generator
 * Handles image and video generation routing
 */

import { VideoRequest, VideoResponse, ImageRequest, ImageResponse } from './types';

export class MediaGenerator {
  private seedanceUrl: string;
  private seedreamUrl: string;
  private apiKey: string;

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.seedanceUrl = `${baseUrl || 'https://api.seedance.ai'}/generate`;
    this.seedreamUrl = `${baseUrl || 'https://api.seedream.ai'}/generate`;
  }

  /**
   * Generate image using Seedance
   */
  async generateImage(request: ImageRequest): Promise<ImageResponse> {
    console.log('[MediaGenerator] Generating image:', request.prompt);

    try {
      const response = await fetch(this.seedanceUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: request.prompt,
          resolution: request.resolution || '4K',
          quality: request.quality || 'high',
        }),
      });

      if (!response.ok) {
        throw new Error(`Seedance API error: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        status: 'completed',
        id: data.id,
        url: data.url,
        resolution: request.resolution || '4K',
        width: parseInt(data.width) || 3840,
        height: parseInt(data.height) || 2160,
      };
    } catch (error) {
      throw new Error(`Image generation failed: ${error}`);
    }
  }

  /**
   * Generate video using Seedream
   */
  async generateVideo(request: VideoRequest): Promise<VideoResponse> {
    console.log('[MediaGenerator] Generating video:', request.prompt);

    try {
      const response = await fetch(this.seedreamUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: request.prompt,
          duration: request.duration || 5,
          resolution: request.resolution || '16:9',
          fps: request.fps || 30,
          quality: request.quality || 'high',
        }),
      });

      if (!response.ok) {
        throw new Error(`Seedream API error: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        status: 'completed',
        id: data.id,
        url: data.url,
        duration: request.duration || 5,
        fps: request.fps || 30,
        ratio: request.ratio || '16:9',
      };
    } catch (error) {
      throw new Error(`Video generation failed: ${error}`);
    }
  }
}
