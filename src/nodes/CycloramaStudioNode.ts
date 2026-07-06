import { Node } from 'reactflow';
import { cycloramaStudioNodeSchema } from './schemas/nodeValidation';
import { z } from 'zod';

export interface CycloramaStudioNodeData {
  backgroundColor: string;
  customColor?: string;
  lightingPreset: string;
  lightIntensity: number;
  backgroundStyle: string;
  environmentPrompt: string;
}

export class CycloramaStudioNode implements Node {
  id: string;
  data: CycloramaStudioNodeData;
  position: { x: number; y: number };
  type = 'cyclorama-studio';

  private colorPalette = {
    'sunset-orange': '#FF6B35',
    'hot-pink': '#FF1493',
    'neon-blue': '#00D9FF',
    'deep-purple': '#6A0DAD',
    'emerald-green': '#50C878',
  };

  constructor(id: string, data: Partial<CycloramaStudioNodeData>, position?: { x: number; y: number }) {
    this.id = id;
    this.position = position || { x: 0, y: 0 };
    this.data = {
      backgroundColor: data.backgroundColor || 'sunset-orange',
      customColor: data.customColor,
      lightingPreset: data.lightingPreset || 'cinematic',
      lightIntensity: data.lightIntensity ?? 0.8,
      backgroundStyle: data.backgroundStyle || 'solid',
      environmentPrompt: data.environmentPrompt || '',
    };
  }

  validate(): { valid: boolean; errors: string[] } {
    try {
      cycloramaStudioNodeSchema.parse(this.data);
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

  getBackgroundColor(): string {
    if (this.data.backgroundColor === 'custom' && this.data.customColor) {
      return this.data.customColor;
    }
    return this.colorPalette[this.data.backgroundColor as keyof typeof this.colorPalette] || '#000000';
  }

  generateEnvironmentPrompt(): string {
    const basePrompt = this.data.environmentPrompt;
    const lightingDesc = `${this.data.lightingPreset} lighting with ${Math.round(this.data.lightIntensity * 100)}% intensity`;
    const styleDesc = `${this.data.backgroundStyle} background style`;
    
    return `${basePrompt}, ${lightingDesc}, ${styleDesc}`;
  }

  getOutputs() {
    return {
      backgroundPlate: {
        type: 'image',
        description: 'Studio background plate',
        color: this.getBackgroundColor(),
      },
      lightingSetup: {
        type: 'metadata',
        description: 'Lighting configuration',
        preset: this.data.lightingPreset,
        intensity: this.data.lightIntensity,
      },
      environmentPrompt: {
        type: 'text',
        description: 'Generated environment prompt for diffusion models',
        value: this.generateEnvironmentPrompt(),
      },
    };
  }
}
