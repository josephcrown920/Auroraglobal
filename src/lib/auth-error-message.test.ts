import { describe, expect, test } from "bun:test";
import { classifyAuthError, describeAuthError } from "./auth-error-message";

describe("classifyAuthError", () => {
  test("tags the failure kind so the form can offer the right next step", () => {
    expect(classifyAuthError(new Error("Invalid login credentials"), "x").kind).toBe("invalid_credentials");
    expect(classifyAuthError(new TypeError("Failed to fetch"), "x").kind).toBe("network");
    expect(classifyAuthError(new Error("Email not confirmed"), "x").kind).toBe("email_not_confirmed");
    expect(classifyAuthError(new Error("User already registered"), "x").kind).toBe("already_registered");
    expect(classifyAuthError(new Error("Request rate limit reached"), "x").kind).toBe("rate_limited");
    expect(classifyAuthError(new Error("provider is not enabled"), "x").kind).toBe("provider_disabled");
    expect(classifyAuthError(new Error("Missing Supabase environment"), "x").kind).toBe("unavailable");
    expect(classifyAuthError(new Error("Signups not allowed"), "x").kind).toBe("unknown");
    expect(classifyAuthError(undefined, "Sign-in failed")).toEqual({ kind: "unknown", message: "Sign-in failed" });
  });

  test("message matches describeAuthError exactly for every kind", () => {
    for (const raw of ["Invalid login credentials", "Failed to fetch", "Email not confirmed", "whatever else"]) {
      const err = new Error(raw);
      expect(classifyAuthError(err, "x").message).toBe(describeAuthError(err, "x"));
    }
  });
});

describe("describeAuthError", () => {
  test("maps Supabase's bad-credentials string to an actionable sentence", () => {
    expect(describeAuthError(new Error("Invalid login credentials"), "Sign-in failed")).toMatch(
      /incorrect email or password/i,
    );
  });

  test("explains network failures instead of echoing 'Failed to fetch'", () => {
    for (const raw of ["Failed to fetch", "Load failed", "NetworkError when attempting to fetch resource.", "fetch failed"]) {
      const out = describeAuthError(new TypeError(raw), "Sign-in failed");
      expect(out).toMatch(/can't reach the sign-in service/i);
      expect(out).not.toContain(raw);
    }
  });

  test("covers unconfirmed email, duplicate accounts, rate limits and disabled providers", () => {
    expect(describeAuthError(new Error("Email not confirmed"), "x")).toMatch(/confirm your email/i);
    expect(describeAuthError(new Error("User already registered"), "x")).toMatch(/already exists/i);
    expect(describeAuthError(new Error("Request rate limit reached"), "x")).toMatch(/too many attempts/i);
    expect(describeAuthError(new Error("Unsupported provider: provider is not enabled"), "x")).toMatch(
      /isn't available right now/i,
    );
  });

  test("keeps unknown server messages verbatim so misconfiguration stays visible", () => {
    expect(describeAuthError(new Error("Signups not allowed for this instance"), "x")).toBe(
      "Signups not allowed for this instance",
    );
  });

  test("falls back when there is no message at all", () => {
    expect(describeAuthError(undefined, "Sign-in failed")).toBe("Sign-in failed");
    expect(describeAuthError({}, "Sign-in failed")).toBe("Sign-in failed");
    expect(describeAuthError("", "Sign-in failed")).toBe("Sign-in failed");
  });

  test("reads message-shaped plain objects and OAuth error_description payloads", () => {
    expect(describeAuthError({ message: "Invalid login credentials" }, "x")).toMatch(/incorrect email/i);
    expect(describeAuthError({ error_description: "access_denied by user" }, "x")).toBe("access_denied by user");
  });
});
