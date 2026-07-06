import { Node } from 'reactflow';
import { lipSyncVideoGenNodeSchema } from './schemas/nodeValidation';
import { z } from 'zod';

export interface LipSyncVideoGenNodeData {
  characterInputId: string;
  audioTrackId: string;
  lipSyncModel: 'wav2lip' | 'kling-2.6' | 'mimic-motion';
  faceQuality: 'low' | 'medium' | 'high';
  outputFramerate: number;
  motionIntensity: number;
  preserveFacialExpression: boolean;
}

export class LipSyncVideoGenNode implements Node {
  id: string;
  data: LipSyncVideoGenNodeData;
  position: { x: number; y: number };
  type = 'lipsync-video-gen';

  constructor(id: string, data: Partial<LipSyncVideoGenNodeData>, position?: { x: number; y: number }) {
    this.id = id;
    this.position = position || { x: 0, y: 0 };
    this.data = {
      characterInputId: data.characterInputId || '',
      audioTrackId: data.audioTrackId || '',
      lipSyncModel: data.lipSyncModel || 'wav2lip',
      faceQuality: data.faceQuality || 'high',
      outputFramerate: data.outputFramerate || 30,
      motionIntensity: data.motionIntensity ?? 0.7,
      preserveFacialExpression: data.preserveFacialExpression ?? true,
    };
  }

  validate(): { valid: boolean; errors: string[] } {
    try {
      lipSyncVideoGenNodeSchema.parse(this.data);
      return { valid: true, errors: [] };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
        };
      }
      return { valid: false, errors: ['Unknown validation error'] };
    }
  }

  buildFalAiPayload() {
    return {
      model: this.data.lipSyncModel === 'kling-2.6' ? 'fal-ai/kling-video/v1/standard' : 'fal-ai/wav2lip',
      inputs: {
        audio_url: '${audioTrackId}', // Will be resolved at runtime
        video_url: '${characterInputId}', // Will be resolved at runtime
        face_detection_threshold: this.data.faceQuality === 'high' ? 0.9 : this.data.faceQuality === 'medium' ? 0.7 : 0.5,
        motion_intensity: this.data.motionIntensity,
        preserve_audio_timing: true,
        output_format: 'mp4',
        fps: this.data.outputFramerate,
      },
    };
  }

  getOutputs() {
    return {
      syncedVideo: {
        type: 'video',
        description: 'Lip-synced character video',
        framerate: this.data.outputFramerate,
        quality: this.data.faceQuality,
      },
      syncMetadata: {
        type: 'metadata',
        description: 'Sync alignment data for downstream processing',
      },
    };
  }
}
