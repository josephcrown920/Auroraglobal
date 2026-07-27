export async function generateSceneImage(prompt: string, referenceImageUrl?: string): Promise<{ url: string }> {
  // Mock implementation since file was missing
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ url: 'https://images.unsplash.com/photo-1682687220742-aba13b6e50ba?w=800&q=80' });
    }, 2000);
  });
}

export async function sendAssistantMessage(history: any[], context: string): Promise<string> {
  // Mock implementation
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve("That sounds like a great direction! Let's consider a moody low-angle shot for the first scene.");
    }, 1500);
  });
}
