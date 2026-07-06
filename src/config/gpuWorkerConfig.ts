/**
 * GPU Worker Configuration
 * 
 * This file configures your GPU workers from VAST.ai and Runpod.
 * The pipeline will try GPU first, then fall back to Fal.ai if needed.
 * 
 * Setup Instructions:
 * 1. Get your API keys from VAST.ai and Runpod dashboards
 * 2. Fill in the credentials below
 * 3. Get a Fal.ai API key from https://fal.ai
 * 4. Set environment variables or update this file
 */

export interface GPUWorkerConfig {
  vastAi?: {
    apiKey: string;
    workerId: string;
    capabilities?: string[]; // ['motion', 'video', 'lipsync']
  };
  runpod?: {
    apiKey: string;
    workerId: string;
    capabilities?: string[]; // ['motion', 'video', 'lipsync']
  };
  fal?: {
    apiKey: string;
  };
  customEndpoints?: Array<{
    endpoint: string;
    apiKey: string;
    workerId: string;
    capabilities: string[];
  }>;
}

// Load from environment variables or use placeholders
const config: GPUWorkerConfig = {
  vastAi: {
    apiKey: process.env.VAST_AI_API_KEY || '',
    workerId: process.env.VAST_AI_WORKER_ID || '',
    capabilities: ['motion', 'video', 'lipsync'],
  },
  runpod: {
    apiKey: process.env.RUNPOD_API_KEY || '',
    workerId: process.env.RUNPOD_WORKER_ID || '',
    capabilities: ['motion', 'video', 'lipsync'],
  },
  fal: {
    apiKey: process.env.FAL_AI_API_KEY || '',
  },
  customEndpoints: process.env.CUSTOM_GPU_ENDPOINTS
    ? JSON.parse(process.env.CUSTOM_GPU_ENDPOINTS)
    : [],
};

/**
 * VAST.ai Setup:
 * 1. Go to https://www.vast.ai/
 * 2. Create an account or log in
 * 3. Go to Settings → API Keys
 * 4. Create a new API key
 * 5. Get your Worker ID from the dashboard
 * 6. Set environment variables:
 *    VAST_AI_API_KEY=your_api_key
 *    VAST_AI_WORKER_ID=your_worker_id
 */

/**
 * Runpod Setup:
 * 1. Go to https://www.runpod.io/
 * 2. Create an account or log in
 * 3. Go to API Keys in your account settings
 * 4. Create a new API key
 * 5. Get your Worker ID (Pod ID) from your pod dashboard
 * 6. Set environment variables:
 *    RUNPOD_API_KEY=your_api_key
 *    RUNPOD_WORKER_ID=your_pod_id
 */

/**
 * Fal.ai Setup (Fallback):
 * 1. Go to https://fal.ai/
 * 2. Create an account
 * 3. Go to API Keys
 * 4. Create a new key
 * 5. Set environment variable:
 *    FAL_AI_API_KEY=your_api_key
 */

export default config;
