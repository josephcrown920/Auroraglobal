import { describe, expect, it } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..", "..");

describe("grant_credits RPC signature", () => {
  it("removes the ambiguous legacy overload", () => {
    const migration = readFileSync(
      join(root, "supabase/migrations/20260905163000_drop_legacy_grant_credits_overload.sql"),
      "utf8",
    );

    expect(migration).toContain(
      "drop function if exists public.grant_credits(uuid, integer, text, uuid);",
    );
  });

  it("all TypeScript callers explicitly select the actor-aware overload", () => {
    const libDir = join(root, "src/lib");
    const callers = readdirSync(libDir)
      .filter((name) => /\.(?:ts|tsx)$/.test(name) && !name.endsWith(".test.ts"))
      .map((name) => ({ name, source: readFileSync(join(libDir, name), "utf8") }))
      .filter(({ source }) => source.includes('.rpc("grant_credits"'));

    expect(callers.length).toBeGreaterThan(0);
    for (const { name, source } of callers) {
      const calls = source.split('.rpc("grant_credits"').slice(1);
      for (const call of calls) {
        const args = call.slice(0, call.indexOf("});") + 3);
        expect(args, `${name} must pass _actor to disambiguate the RPC`).toContain(
          "_actor:",
        );
      }
    }
  });
});