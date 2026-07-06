import { GPUFallbackManager } from './GPUFallbackManager';
import axios from 'axios';

export interface FalAiEndpointConfig {
  apiKey: string;
  baseUrl?: string;
}

export class FalAiService {
  private apiKey: string;
  private baseUrl: string;
  private requestId: string;

  constructor(config: FalAiEndpointConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.fal.ai/v1';
    this.requestId = '';
  }

  async wav2lip(payload: {
    audio_url: string;
    video_url: string;
    face_detection_threshold?: number;
    motion_intensity?: number;
    output_format?: string;
    fps?: number;
  }) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/fal-ai/wav2lip`,
        {
          input: {
            audio_url: payload.audio_url,
            video_url: payload.video_url,
            face_detection_threshold: payload.face_detection_threshold || 0.9,
            motion_intensity: payload.motion_intensity || 0.7,
            output_format: payload.output_format || 'mp4',
            fps: payload.fps || 30,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );
      this.requestId = response.data.request_id;
      return response.data;
    } catch (error) {
      throw new Error(`Fal.ai wav2lip failed: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  async mimicMotion(payload: {
    source_video_url: string;
    motion_video_url: string;
    motion_intensity?: number;
    preserve_identity?: boolean;
    output_resolution?: string;
  }) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/fal-ai/mimic-motion`,
        {
          input: {
            source_video_url: payload.source_video_url,
            motion_video_url: payload.motion_video_url,
            motion_intensity: payload.motion_intensity || 0.8,
            preserve_identity: payload.preserve_identity !== false,
            output_resolution: payload.output_resolution || '1080p',
          },
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );
      this.requestId = response.data.request_id;
      return response.data;
    } catch (error) {
      throw new Error(
        `Fal.ai mimic-motion failed: ${error instanceof Error ? error.message : 'Unknown'}`
      );
    }
  }

  async klingVideo(payload: {
    prompt: string;
    image_url?: string;
    duration?: number;
    resolution?: string;
  }) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/fal-ai/kling-video/v1/standard`,
        {
          input: {
            prompt: payload.prompt,
            image_url: payload.image_url,
            duration: payload.duration || 5,
            resolution: payload.resolution || '1080p',
          },
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );
      this.requestId = response.data.request_id;
      return response.data;
    } catch (error) {
      throw new Error(`Fal.ai kling-video failed: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  async getRequestStatus(requestId?: string) {
    const id = requestId || this.requestId;
    if (!id) throw new Error('No request ID available');

    try {
      const response = await axios.get(`${this.baseUrl}/requests/${id}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });
      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to fetch request status: ${error instanceof Error ? error.message : 'Unknown'}`
      );
    }
  }

  setRequestId(requestId: string): void {
    this.requestId = requestId;
  }
}
