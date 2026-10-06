import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { isAllowedOrigin, getRP } from "./webauthn-origins";

const ENV_KEYS = ["SITE_URL", "REPLIT_DOMAINS", "REPLIT_DEV_DOMAIN", "NODE_ENV"] as const;
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("getRP", () => {
  it("defaults to the production domain", () => {
    expect(getRP()).toEqual({
      rpName: "Aurora Performance Studio",
      rpID: "auroraperformancestudio.com",
      origin: "https://auroraperformancestudio.com",
    });
  });

  it("respects SITE_URL", () => {
    process.env.SITE_URL = "https://example.com/";
    expect(getRP().rpID).toBe("example.com");
  });
});

describe("isAllowedOrigin", () => {
  it("allows the canonical production origin", () => {
    expect(isAllowedOrigin("https://auroraperformancestudio.com")).toBe(true);
  });

  it("rejects foreign replit.app / replit.dev / repl.co origins", () => {
    expect(isAllowedOrigin("https://evil.replit.app")).toBe(false);
    expect(isAllowedOrigin("https://evil.replit.dev")).toBe(false);
    expect(isAllowedOrigin("https://evil.repl.co")).toBe(false);
  });

  it("allows the deployment's own REPLIT_DOMAINS entries", () => {
    process.env.REPLIT_DOMAINS = "aurora-prod.replit.app,auroraperformancestudio.com";
    expect(isAllowedOrigin("https://aurora-prod.replit.app")).toBe(true);
    expect(isAllowedOrigin("https://other-app.replit.app")).toBe(false);
  });

  it("allows the dev preview domain from REPLIT_DEV_DOMAIN", () => {
    process.env.REPLIT_DEV_DOMAIN = "my-repl.picard.replit.dev";
    expect(isAllowedOrigin("https://my-repl.picard.replit.dev")).toBe(true);
    expect(isAllowedOrigin("https://someone-else.picard.replit.dev")).toBe(false);
  });

  it("allows localhost only outside production", () => {
    process.env.NODE_ENV = "development";
    expect(isAllowedOrigin("http://localhost:8080")).toBe(true);
    expect(isAllowedOrigin("http://127.0.0.1:8080")).toBe(true);
    process.env.NODE_ENV = "production";
    expect(isAllowedOrigin("http://localhost:8080")).toBe(false);
  });

  it("rejects insecure http on non-localhost hosts", () => {
    process.env.REPLIT_DEV_DOMAIN = "my-repl.picard.replit.dev";
    expect(isAllowedOrigin("http://my-repl.picard.replit.dev")).toBe(false);
  });

  it("rejects garbage and non-http(s) schemes", () => {
    expect(isAllowedOrigin("not-a-url")).toBe(false);
    expect(isAllowedOrigin("file:///etc/passwd")).toBe(false);
    expect(isAllowedOrigin("chrome-extension://abc")).toBe(false);
  });
});
