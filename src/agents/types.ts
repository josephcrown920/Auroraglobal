/**
 * Aurora Agent Types
 * Shared type definitions for coordinator and reasoning agents
 */

// Coordinator Agent Types
export interface CoordinatorConfig {
  apiKey: string;
  baseUrl?: string;
  deepseekApiKey: string;
  reasoningTimeout?: number;
}

export interface MediaRequest {
  prompt: string;
  quality?: 'low' | 'medium' | 'high';
  resolution?: string;
  duration?: number;
  fps?: number;
}

export interface MediaResponse {
  id?: string;
  queued?: boolean;
  queuePosition?: number;
  url?: string;
  data?: Buffer;
  status: string;
  error?: string;
}

export interface MediaGeneration {
  id: string;
  type: 'image' | 'video';
  prompt: string;
  timestamp: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface AgentState {
  isProcessing: boolean;
  currentTask: MediaRequest | null;
  requestQueue: MediaRequest[];
  mediaGenerations: MediaGeneration[];
}

// Reasoning Fallback Types
export interface ReasoningConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  sessionId?: string;
  timeout?: number;
}

export interface ReasoningRequest {
  prompt: string;
  type?: 'video-generation' | 'image-generation' | 'code-generation' | 'reasoning';
  resolution?: string;
  duration?: number;
  fps?: number;
}

export interface ReasoningResponse {
  success: boolean;
  reasoning?: string;
  result: string;
  model: string;
  timestamp: Date;
  error?: string;
}

// API Request/Response Types
export interface GenerateRequest {
  prompt: string;
  type?: 'image' | 'video' | 'code';
  options?: {
    duration?: number;
    resolution?: string;
    quality?: string;
    fps?: number;
  };
}

export interface GenerateResponse {
  success: boolean;
  id: string;
  type: string;
  prompt: string;
  result: string;
  timestamp: string;
  error?: string;
}

// Video Generation Types
export interface VideoRequest extends MediaRequest {
  duration: number;
  fps?: number;
  ratio?: string;
}

export interface VideoResponse extends MediaResponse {
  duration: number;
  fps: number;
  ratio: string;
}

// Image Generation Types
export interface ImageRequest extends MediaRequest {
  resolution: string;
}

export interface ImageResponse extends MediaResponse {
  resolution: string;
  width: number;
  height: number;
}

// Code Generation Types
export interface CodeRequest {
  prompt: string;
  language?: string;
}

export interface CodeResponse {
  success: boolean;
  code: string;
  explanation: string;
  language: string;
  timestamp: Date;
}
