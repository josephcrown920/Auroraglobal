import { supabase } from '@/lib/supabase';

export async function generateSceneImage(prompt: string, referenceImageUrl?: string): Promise<{ url: string }> {
  // Mock implementation since file was missing
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ url: 'https://images.unsplash.com/photo-1682687220742-aba13b6e50ba?w=800&q=80' });
    }, 2000);
  });
}

export interface AssistantScene {
  title: string;
  description: string;
}

export interface AssistantContext {
  artistName: string;
  brief: string;
  mood: string;
  scenes: AssistantScene[];
}

type AssistantMessage = { role: 'user' | 'ai' | 'error'; content: string };

export async function sendAssistantMessage(
  history: AssistantMessage[],
  context: AssistantContext,
): Promise<string> {
  const sceneList = context.scenes.length
    ? context.scenes.map((scene, index) => `${index + 1}. ${scene.title || 'Untitled scene'} — ${scene.description || 'No description yet'}`).join('\n').slice(0, 900)
    : 'No scenes have been defined yet.';
  const systemPrompt = [
    'You are Aurora’s creative director assistant. Give concise, specific production advice grounded in the current rollout brief.',
    'Reference the artist, mood, brief, and scene details when relevant. Suggest concrete shot types, camera movement, lighting, pacing, or transitions—not generic encouragement.',
    `Artist name: ${(context.artistName || 'Not provided').slice(0, 120)}`,
    `Brief: ${(context.brief || 'Not provided').slice(0, 500)}`,
    `Mood: ${(context.mood || 'Not selected').slice(0, 120)}`,
    `Scenes:\n${sceneList}`,
  ].join('\n\n');
  const messages = history
    .filter((message) => message.role === 'user' || message.role === 'ai')
    .slice(-6)
    .map((message) => `${message.role === 'ai' ? 'ASSISTANT' : 'USER'}: ${message.content}`)
    .join('\n\n');
  const prompt = `SYSTEM:\n${systemPrompt}\n\nCONVERSATION:\n${messages}`.slice(0, 2000);
  const { data } = await supabase?.auth.getSession() ?? { data: { session: null } };
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error('Sign in before using the assistant');

  const response = await fetch('/api/public/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ kind: 'text', prompt }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(detail || `Assistant request failed (${response.status})`);
  }
  const result = await response.json() as { text?: string; output?: string; result_text?: string };
  const reply = result.text ?? result.output ?? result.result_text;
  if (!reply?.trim()) throw new Error('Assistant returned an empty response');
  return reply.trim();
}
