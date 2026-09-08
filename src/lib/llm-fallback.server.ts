import type { z } from "zod";
import { routedGenerate } from "@/lib/ai-router";

export type FallbackResult<T> = { provider: string; output: T };

/** @deprecated Use routedGenerate from "@/lib/ai-router" so calls get category routing and health tracking. */
export async function generateWithFallback<T>(args: {
  system: string;
  prompt: string;
  // Input type is deliberately loose so schemas with .transform() infer T from
  // their OUTPUT type rather than their raw wire shape.
  schema: z.ZodType<T, z.ZodTypeDef, unknown>;
}): Promise<FallbackResult<T>> {
  const { provider, output } = await routedGenerate(args);
  return { provider, output };
}
