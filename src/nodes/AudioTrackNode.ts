import { Node } from 'reactflow';
import { audioTrackNodeSchema } from './schemas/nodeValidation';
import { z } from 'zod';

export interface AudioTrackNodeData {
  audioTrackId: string;
  audioUrl: string;
  duration: number;
  sampleRate: number;
  bpm?: number;
  genre?: string;
}

export class AudioTrackNode implements Node {
  id: string;
  data: AudioTrackNodeData;
  position: { x: number; y: number };
  type = 'audio-track';

  constructor(id: string, data: Partial<AudioTrackNodeData>, position?: { x: number; y: number }) {
    this.id = id;
    this.position = position || { x: 0, y: 0 };
    this.data = {
      audioTrackId: data.audioTrackId || '',
      audioUrl: data.audioUrl || '',
      duration: data.duration || 0,
      sampleRate: data.sampleRate || 44100,
      bpm: data.bpm,
      genre: data.genre,
    };
  }

  validate(): { valid: boolean; errors: string[] } {
    try {
      audioTrackNodeSchema.parse(this.data);
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

  getOutputs() {
    return {
      audioStream: {
        type: 'audio',
        description: 'Raw audio stream',
        sampleRate: this.data.sampleRate,
        duration: this.data.duration,
      },
      audioAnalysis: {
        type: 'metadata',
        description: 'Audio analysis data for sync timing',
      },
    };
  }

  extractAudioFeatures() {
    return {
      duration: this.data.duration,
      sampleRate: this.data.sampleRate,
      bpm: this.data.bpm,
      genre: this.data.genre,
    };
  }
}
