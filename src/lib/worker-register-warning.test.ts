import { describe, expect, test } from "bun:test";
import {
  REGISTER_DISABLED_ERROR,
  shouldShowRegisterSecretWarning,
} from "./worker-register-warning";

describe("shouldShowRegisterSecretWarning", () => {
  test("warns when secret is unset even with ZERO registration attempts", () => {
    // The case operators most need: misconfiguration visible before any
    // worker ever calls /api/public/workers/register.
    expect(shouldShowRegisterSecretWarning(false, [])).toBe(true);
  });

  test("warns when secret is unset regardless of successful past attempts", () => {
    expect(shouldShowRegisterSecretWarning(false, [{ ok: true }])).toBe(true);
  });

  test("no warning when secret is configured and no disabled-error attempts", () => {
    expect(shouldShowRegisterSecretWarning(true, [])).toBe(false);
    expect(
      shouldShowRegisterSecretWarning(true, [
        { ok: false, error: "invalid payload" },
        { ok: true },
      ]),
    ).toBe(false);
  });

  test("still warns from historical audit rows with the exact disabled error", () => {
    expect(
      shouldShowRegisterSecretWarning(true, [{ ok: false, error: REGISTER_DISABLED_ERROR }]),
    ).toBe(true);
  });

  test("undefined flag (stale server fn) falls back to audit rows only", () => {
    expect(shouldShowRegisterSecretWarning(undefined, [])).toBe(false);
    expect(
      shouldShowRegisterSecretWarning(undefined, [{ ok: false, error: REGISTER_DISABLED_ERROR }]),
    ).toBe(true);
  });
});
