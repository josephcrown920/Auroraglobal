// Shared generation caller for the Canvas workspace + Assistant.
// Mirrors ModelStudio.tsx's proven flow against the SAME dedicated endpoint —
// the signed-in creator's own Supabase session JWT is verified server-side and
// the render is billed to their own account (see src/routes/api/adult-admin/generate.ts).
import { supabase } from "@/lib/supabase";

export type GenerateKind = "image" | "video" | "lipsync" | "upscale";

export interface GenerateRequest {
  kind: GenerateKind;
  prompt: string;
  /** Reference image URLs (public/signed) — converted to data URLs client-side. */
  imageUrls?: string[];
  editStrict?: boolean;
  historyModelId?: string;
  historyLookId?: string;
  duration?: number;
}

export interface GenerateOutcome {
  ok: true;
  url: string;
  generationId?: string;
}

export class GenerateError extends Error {}

async function urlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Runs an Adult School generation and returns the resulting media URL. */
export async function runGenerate(req: GenerateRequest): Promise<GenerateOutcome> {
  const { data: sessionData } = await supabase.auth.getSession();
  const sessionToken = sessionData.session?.access_token;
  if (!sessionToken) throw new GenerateError("Session expired — sign in again");

  const base64Images = req.imageUrls?.length
    ? await Promise.all(req.imageUrls.map(urlToDataUrl))
    : undefined;

  const res = await fetch(`/api/adult-admin/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({
      kind: req.kind,
      prompt: req.prompt,
      base64Images,
      editStrict: req.editStrict,
      historyModelId: req.historyModelId,
      historyLookId: req.historyLookId,
    }),
  });

  const data: unknown = await res.json();
  if (!res.ok) {
    throw new GenerateError((data as { error?: string })?.error ?? "Generation failed");
  }
  const url = (data as { url?: string })?.url;
  if (!url) throw new GenerateError("Render finished but no media was returned");
  return { ok: true, url, generationId: (data as { generationId?: string })?.generationId };
}

/** Returns the caller's current session bearer, or null if signed out. */
export async function getSessionBearer(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
