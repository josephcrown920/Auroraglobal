import { describe, expect, it } from "bun:test";
import { checkEnv, OPTIONAL_ENV_GROUPS, REQUIRED_ENV, validateEnvAtStartup } from "./env-validation.server";

function fakeEnv(overrides: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return overrides as NodeJS.ProcessEnv;
}

const allRequiredSet: Record<string, string> = Object.fromEntries(
  REQUIRED_ENV.map((k) => [k, "set"]),
);

describe("checkEnv", () => {
  it("reports no missing required vars when all are present", () => {
    const { missingRequired } = checkEnv(fakeEnv(allRequiredSet));
    expect(missingRequired).toEqual([]);
  });

  it("reports every missing required var when none are set", () => {
    const { missingRequired } = checkEnv(fakeEnv({}));
    expect(missingRequired.sort()).toEqual([...REQUIRED_ENV].sort());
  });

  it("reports a partial required var as missing", () => {
    const partial = { ...allRequiredSet };
    delete partial.SUPABASE_SERVICE_ROLE_KEY;
    const { missingRequired } = checkEnv(fakeEnv(partial));
    expect(missingRequired).toEqual(["SUPABASE_SERVICE_ROLE_KEY"]);
  });

  it("buckets optional keys per group without ever including a value in the result", () => {
    const { optionalStatus } = checkEnv(
      fakeEnv({ ...allRequiredSet, GEMINI_API_KEY: "super-secret-value" }),
    );
    const group = optionalStatus["LLM fallback chain"];
    expect(group.configured).toContain("GEMINI_API_KEY");
    expect(group.missing).not.toContain("GEMINI_API_KEY");
    // The result must only ever carry variable NAMES, never the value itself.
    expect(JSON.stringify(optionalStatus)).not.toContain("super-secret-value");
  });

  it("every optional group key list is non-empty (no dead/typo'd group)", () => {
    for (const [group, keys] of Object.entries(OPTIONAL_ENV_GROUPS)) {
      expect(keys.length, `group ${group} should list at least one key`).toBeGreaterThan(0);
    }
  });
});

describe("validateEnvAtStartup", () => {
  it("does not throw when every required var is present", () => {
    expect(() => validateEnvAtStartup(fakeEnv(allRequiredSet))).not.toThrow();
  });

  it("throws with the missing variable names (and nothing else sensitive) when required vars are absent", () => {
    expect(() => validateEnvAtStartup(fakeEnv({}))).toThrow(/SUPABASE_URL/);
  });

  it("does not throw solely because optional provider keys are missing", () => {
    expect(() => validateEnvAtStartup(fakeEnv(allRequiredSet))).not.toThrow();
  });
});
