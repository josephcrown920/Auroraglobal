import { Node } from 'reactflow';
import { motionTransferNodeSchema } from './schemas/nodeValidation';
import { z } from 'zod';

export interface MotionTransferNodeData {
  videoInputId: string;
  motionReferenceVideoId: string;
  motionModel: 'mimic-motion' | 'champ' | 'dwpose-based';
  motionIntensity: number;
  gpuCapability: 'motion' | 'video' | 'standard';
  preserveIdentity: boolean;
  outputResolution: '720p' | '1080p' | '4k';
}

export class MotionTransferNode implements Node {
  id: string;
  data: MotionTransferNodeData;
  position: { x: number; y: number };
  type = 'motion-transfer';

  private resolutionMap = {
    '720p': { width: 1280, height: 720 },
    '1080p': { width: 1920, height: 1080 },
    '4k': { width: 3840, height: 2160 },
  };

  constructor(id: string, data: Partial<MotionTransferNodeData>, position?: { x: number; y: number }) {
    this.id = id;
    this.position = position || { x: 0, y: 0 };
    this.data = {
      videoInputId: data.videoInputId || '',
      motionReferenceVideoId: data.motionReferenceVideoId || '',
      motionModel: data.motionModel || 'mimic-motion',
      motionIntensity: data.motionIntensity ?? 0.8,
      gpuCapability: data.gpuCapability || 'motion',
      preserveIdentity: data.preserveIdentity ?? true,
      outputResolution: data.outputResolution || '1080p',
    };
  }

  validate(): { valid: boolean; errors: string[] } {
    try {
      motionTransferNodeSchema.parse(this.data);
      if (this.data.gpuCapability !== 'motion') {
        return {
          valid: false,
          errors: ['Motion transfer requires motion-capable GPU backend. Current backend: ' + this.data.gpuCapability],
        };
      }
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

  getResolution() {
    return this.resolutionMap[this.data.outputResolution];
  }

  buildMotionTransferPayload() {
    const resolution = this.getResolution();
    return {
      model: `fal-ai/${this.data.motionModel}`,
      inputs: {
        source_video: '${videoInputId}',
        motion_video: '${motionReferenceVideoId}',
        motion_strength: this.data.motionIntensity,
        preserve_identity: this.data.preserveIdentity,
        output_format: 'mp4',
        resolution: this.data.outputResolution,
        width: resolution.width,
        height: resolution.height,
      },
    };
  }

  requiresMotionGPU(): boolean {
    return this.data.motionModel !== 'dwpose-based'; // dwpose-based can run on standard GPU
  }

  getOutputs() {
    return {
      motionTransferredVideo: {
        type: 'video',
        description: 'Video with motion transfer applied',
        resolution: this.data.outputResolution,
      },
      motionData: {
        type: 'metadata',
        description: 'Motion vectors and pose data',
      },
    };
  }
}
