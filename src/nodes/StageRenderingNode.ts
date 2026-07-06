import { Node } from 'reactflow';
import { stageRenderingNodeSchema } from './schemas/nodeValidation';
import { z } from 'zod';

export interface StageRenderingNodeData {
  cycloramaStudioId: string;
  lipSyncVideoId: string;
  motionTransferId: string;
  stylePrompt?: string;
  renderQuality: 'preview' | 'standard' | 'high' | '4k';
  outputFormat: 'mp4' | 'webm' | 'mov';
  bitrate: number;
}

export class StageRenderingNode implements Node {
  id: string;
  data: StageRenderingNodeData;
  position: { x: number; y: number };
  type = 'stage-rendering';

  private qualitySettings = {
    preview: { bitrate: 2000, crf: 28 },
    standard: { bitrate: 5000, crf: 23 },
    high: { bitrate: 8000, crf: 20 },
    '4k': { bitrate: 15000, crf: 18 },
  };

  constructor(id: string, data: Partial<StageRenderingNodeData>, position?: { x: number; y: number }) {
    this.id = id;
    this.position = position || { x: 0, y: 0 };
    this.data = {
      cycloramaStudioId: data.cycloramaStudioId || '',
      lipSyncVideoId: data.lipSyncVideoId || '',
      motionTransferId: data.motionTransferId || '',
      stylePrompt: data.stylePrompt,
      renderQuality: data.renderQuality || 'standard',
      outputFormat: data.outputFormat || 'mp4',
      bitrate: data.bitrate || 8000,
    };
  }

  validate(): { valid: boolean; errors: string[] } {
    try {
      stageRenderingNodeSchema.parse(this.data);
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

  getQualitySettings() {
    return this.qualitySettings[this.data.renderQuality];
  }

  buildCompositionPayload() {
    const qualitySettings = this.getQualitySettings();
    return {
      inputs: {
        background_id: '${cycloramaStudioId}',
        character_video_id: '${lipSyncVideoId}',
        motion_video_id: '${motionTransferId}',
        style_prompt: this.data.stylePrompt || 'professional music video',
        output_format: this.data.outputFormat,
        bitrate: qualitySettings.bitrate,
        crf: qualitySettings.crf,
        preset: 'fast' // for faster rendering with maintained quality
      },
    };
  }

  getOutputs() {
    return {
      finalVideo: {
        type: 'video',
        description: 'Final rendered stage video with all elements composited',
        format: this.data.outputFormat,
        quality: this.data.renderQuality,
      },
      renderMetadata: {
        type: 'metadata',
        description: 'Rendering statistics and quality metrics',
      },
    };
  }

  estimateRenderTime(videoDurationSeconds: number): number {
    // Rough estimate based on quality setting
    const multipliers = {
      preview: 1,
      standard: 2,
      high: 3,
      '4k': 5,
    };
    return videoDurationSeconds * multipliers[this.data.renderQuality];
  }
}
