import { Modality } from "@google/genai";
import { getReplitGemini } from "./orchestrator.server";

function dataUrlPart(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) throw new Error("Scene Weaver received an invalid image.");
  return { inlineData: { mimeType: match[1], data: match[2] } };
}

export async function generateSceneImage(prompt: string, images: string[] = []) {
  const ai = getReplitGemini();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: [{ role: "user", parts: [{ text: prompt }, ...images.map(dataUrlPart)] }],
    config: { responseModalities: [Modality.TEXT, Modality.IMAGE] },
  });
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const image = parts.find((part) => part.inlineData?.data);
  if (!image?.inlineData?.data) throw new Error("Scene Weaver did not receive an image.");
  return `data:${image.inlineData.mimeType ?? "image/png"};base64,${image.inlineData.data}`;
}

export async function generateSceneText(
  system: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  images: string[] = [],
) {
  const ai = getReplitGemini();
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [
      { role: "user", parts: [{ text: system }, ...images.map(dataUrlPart)] },
      ...messages.map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      })),
    ],
  });
  return response.text?.trim() ?? "";
}