// POST /api/directors-board/brain
// Structured-output reasoning for the Directors Board:
//   task: "shot-prompts"   → fills prompt/camera/continuity for each shot in the board
//   task: "flow-fill"      → expands flow nodes with text and rows
//   task: "moodboard-expand" → expands moodboard setups
//
// Adapted from the directors-board zip: uses Aurora's orchestrate() instead of
// the Lovable AI Gateway so no LOVABLE_API_KEY is needed.
import { createFileRoute } from "@tanstack/react-router";

type Task = "shot-prompts" | "flow-fill" | "moodboard-expand";

const SYSTEM = [
  "You are the creative brain of a music-video storyboard tool.",
  "The subject is a fixed, identity-locked avatar; never change the person, only scene, wardrobe, camera and lighting.",
  "Write dense, production-ready image/video prompts in the cinematic neon-noir language of the deck",
  "(neon red, royal blue, hot pink, gold on near-black; anamorphic 35mm; photoreal; 16:9).",
  "Keep every prompt under 900 characters. Never include text, logos or watermarks in the described frame.",
  "Always respond with valid JSON only, following the exact schema provided in the user message.",
].join(" ");

export const Route = createFileRoute("/api/directors-board/brain")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as {
          task?: Task;
          input?: unknown;
          model?: string;
        };
        const task = body.task;
        if (!task || !["shot-prompts", "flow-fill", "moodboard-expand"].includes(task)) {
          return Response.json({ error: "Unknown task" }, { status: 400 });
        }

        const schemaHints: Record<Task, string> = {
          "shot-prompts": `Return JSON: {"shots":[{"id":"string","title":"string","camera":"string","prompt":"string","negative":"string","continuity":"string"}]}`,
          "flow-fill": `Return JSON: {"nodes":[{"id":"string","text":"string","rows":["string"]|null}]}`,
          "moodboard-expand": `Return JSON: {"setups":[{"id":"string","label":"string","scene":"string","camera":"string","wardrobe":"string","continuity":"string","prompt":"string"}]}`,
        };

        const userMsg = `Task: ${task}\n\n${schemaHints[task]}\n\nInput:\n${JSON.stringify(body.input, null, 2)}`;

        try {
          const { orchestrate } = await import("@/lib/orchestrator.server");
          const result = await orchestrate({
            kind: "text",
            model: "lovable/gemini-2.5-flash",
            // Prepend the system instruction into the prompt (GenerateRequest has no systemPrompt field)
            prompt: `SYSTEM: ${SYSTEM}\n\n---\n\n${userMsg}`,
            userId: "directors-board-brain",
          });

          const text = (result.text ?? "").trim();
          // Strip markdown code fences if present
          const clean = text.replace(/^```json?\s*/i, "").replace(/\s*```$/i, "").trim();

          try {
            return Response.json(JSON.parse(clean));
          } catch {
            // Last-resort: try to extract JSON object/array
            const m = clean.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
            if (m) {
              try { return Response.json(JSON.parse(m[1])); } catch { /* fall through */ }
            }
            return new Response("Brain returned malformed JSON", { status: 502 });
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return Response.json({ error: msg }, { status: 502 });
        }
      },
    },
  },
});
