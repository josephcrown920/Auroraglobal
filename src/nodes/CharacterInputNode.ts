import { Node } from 'reactflow';
import { characterInputNodeSchema } from './schemas/nodeValidation';
import { z } from 'zod';

export interface CharacterInputNodeData {
  characterId: string;
  characterName: string;
  characterModel: 'wav2lip' | 'lipsync-gan' | 'mimic-motion';
  audioTrackId: string;
  referenceImage: string;
  pose: 'standing' | 'sitting' | 'dancing';
}

export class CharacterInputNode implements Node {
  id: string;
  data: CharacterInputNodeData;
  position: { x: number; y: number };
  type = 'character-input';

  constructor(id: string, data: Partial<CharacterInputNodeData>, position?: { x: number; y: number }) {
    this.id = id;
    this.position = position || { x: 0, y: 0 };
    this.data = {
      characterId: data.characterId || '',
      characterName: data.characterName || '',
      characterModel: data.characterModel || 'wav2lip',
      audioTrackId: data.audioTrackId || '',
      referenceImage: data.referenceImage || '',
      pose: data.pose || 'standing',
    };
  }

  validate(): { valid: boolean; errors: string[] } {
    try {
      characterInputNodeSchema.parse(this.data);
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
      characterStream: {
        type: 'video',
        description: 'Character reference video stream',
      },
      faceMesh: {
        type: 'mesh',
        description: '3D face mesh for lip-sync alignment',
      },
    };
  }
}
