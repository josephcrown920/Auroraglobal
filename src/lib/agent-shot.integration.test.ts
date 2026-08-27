import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { renderAgentShotCore } from "./agent.functions";
import { reserveOrchestrateRecord, type RenderDeps, type RenderInput } from "./generate-core.server";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const HAS_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

type AdminClient = SupabaseClient<Database>;

const PLAN = {
  title: "Integration billing plan",
  logline: "Two controlled shots exercise the Agent render path.",
  direction: "Clean test direction.",
  palette: ["#111111", "#777777", "#ffffff"],
  shots: [
    {
      id: "S1",
      title: "First shot",
      shotType: "Wide",
      camera: "35mm, locked off",
      action: "The first shot renders.",
      prompt: "agent integration shot one",
    },
    {
      id: "S2",
      title: "Second shot",
      shotType: "Close",
      camera: "85mm, slow push",
      action: "The second shot renders.",
      prompt: "agent integration shot two",
    },
    {
      id: "S3",
      title: "Third shot",
      shotType: "Medium",
      camera: "50mm, gentle pan",
      action: "The third shot renders.",
      prompt: "agent integration shot three",
    },
  ],
  suggestions: ["Render the first shot", "Review the cut"],
};

describe("Agent shot credit lifecycle (Supabase integration)", () => {
  let admin: AdminClient;
  let userId: string | undefined;
  const sessionIds: string[] = [];

  beforeAll(async () => {
    if (!HAS_SUPABASE) return;

    admin = createClient<Database>(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });

    const email = `agent-credit-integration-${crypto.randomUUID()}@aurora-internal.test`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: `${crypto.randomUUID()}-integration`,
      email_confirm: true,
    });
    if (error || !data.user) throw new Error(`create integration user: ${error?.message ?? "no user returned"}`);
    userId = data.user.id;

    const { error: profileError } = await admin
      .from("profiles")
      .update({ credits: 100, credits_reserved: 0 })
      .eq("user_id", userId);
    if (profileError) throw new Error(`seed integration credits: ${profileError.message}`);
  });

  afterAll(async () => {
    if (!HAS_SUPABASE || !userId) return;

    for (const sessionId of sessionIds) {
      await admin.from("generations").delete().eq("session_id", sessionId);
      await admin.from("agent_sessions").delete().eq("id", sessionId);
    }
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw new Error(`delete integration user: ${error.message}`);
  });

  async function createSession(): Promise<string> {
    if (!userId) throw new Error("integration user was not created");
    const { data, error } = await admin
      .from("agent_sessions")
      .insert({
        user_id: userId,
        title: PLAN.title,
        brief: "A billing integration test brief.",
        plan: PLAN,
        iterations: [],
        messages: [],
        status: "ready",
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`create integration session: ${error?.message ?? "no session returned"}`);
    sessionIds.push(data.id);
    return data.id;
  }

  function makeRenderDeps(failingShotId?: string): RenderDeps {
    return {
      rpc: async (name, args) => {
        const result = await admin.rpc(name as never, args as never);
        return {
          data: result.data,
          error: result.error ? { message: result.error.message } : null,
        };
      },
      orchestrate: async (input) => {
        const prompt = input.prompt ?? "";
        if (failingShotId && prompt.includes(failingShotId)) {
          throw new Error(`simulated provider failure for ${failingShotId}`);
        }
        const shotId = prompt.includes("two") ? "S2" : prompt.includes("three") ? "S3" : "S1";
        return {
          url: `https://provider.example/${shotId}.png`,
          provider: "integration-mock",
          endpoint: "integration-mock/image",
          latencyMs: 1,
          costUsd: 0,
        };
      },
      persistUrl: async ({ url }) => ({
        url,
        persisted: false,
        compressed: false,
      }),
    };
  }

  async function renderShot(sessionId: string, shotId: string, deps: RenderDeps) {
    if (!userId) throw new Error("integration user was not created");
    return renderAgentShotCore(
      { userId, supabase: admin },
      { sessionId, shotId },
      { render: (input: RenderInput) => reserveOrchestrateRecord(input, deps) },
    );
  }

  it("commits every reservation for a multi-shot Agent session", async () => {
    if (!HAS_SUPABASE) {
      return;
    }
    const sessionId = await createSession();
    const deps = makeRenderDeps();

    await renderShot(sessionId, "S1", deps);
    await renderShot(sessionId, "S2", deps);

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("credits, credits_reserved")
      .eq("user_id", userId!)
      .single();
    if (profileError || !profile) throw new Error(`read committed profile: ${profileError?.message ?? "no profile"}`);

    const { data: generations, error: generationError } = await admin
      .from("generations")
      .select("agent_shot_id, status, credits_cost")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    if (generationError) throw new Error(`read committed generations: ${generationError.message}`);

    expect(profile.credits).toBe(98);
    expect(profile.credits_reserved).toBe(0);
    expect(generations).toHaveLength(2);
    expect(generations?.map((row) => [row.agent_shot_id, row.status])).toEqual([
      ["S1", "succeeded"],
      ["S2", "succeeded"],
    ]);
    expect(generations?.every((row) => row.credits_cost === 1)).toBe(true);
  });

  it("releases only a failed shot while committing the successful shots", async () => {
    if (!HAS_SUPABASE) {
      return;
    }
    const { error: resetError } = await admin
      .from("profiles")
      .update({ credits: 100, credits_reserved: 0 })
      .eq("user_id", userId!);
    if (resetError) throw new Error(`reset integration credits: ${resetError.message}`);

    const sessionId = await createSession();
    const deps = makeRenderDeps("S2");

    await renderShot(sessionId, "S1", deps);
    await expect(renderShot(sessionId, "S2", deps)).rejects.toThrow("simulated provider failure for S2");
    await renderShot(sessionId, "S3", deps);

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("credits, credits_reserved")
      .eq("user_id", userId!)
      .single();
    if (profileError || !profile) throw new Error(`read released profile: ${profileError?.message ?? "no profile"}`);

    const { data: generations, error: generationError } = await admin
      .from("generations")
      .select("agent_shot_id, status")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    if (generationError) throw new Error(`read released generations: ${generationError.message}`);

    expect(profile.credits).toBe(98);
    expect(profile.credits_reserved).toBe(0);
    expect(generations).toHaveLength(2);
    expect(generations?.map((row) => [row.agent_shot_id, row.status])).toEqual([
      ["S1", "succeeded"],
      ["S3", "succeeded"],
    ]);
  });
});