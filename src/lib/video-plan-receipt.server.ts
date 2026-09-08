import { createHmac, timingSafeEqual } from "node:crypto";
import type { VideoPlan } from "./video-agent-skills";
import { PlanReceiptSchema, VideoPlanSchema, type PlanReceipt } from "./video-agent-skills";

const RECEIPT_VERSION = "1" as const;
const RECEIPT_TTL_MS = 10 * 60_000;
const MAX_PLAN_BYTES = 50_000;
const MAX_CLOCK_SKEW_MS = 30_000;

type ReceiptFailure =
  | "invalid-receipt"
  | "invalid-plan"
  | "plan-too-large"
  | "expired"
  | "invalid-expiry"
  | "bad-signature"
  | "server-misconfigured";

export type PlanReceiptVerification =
  | { valid: true; version: "1"; expiresAt: string }
  | { valid: false; reason: ReceiptFailure };

function canonicalize(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Plan contains a non-finite number");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, child]) => child !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${canonicalize(child)}`).join(",")}}`;
  }
  throw new Error("Plan contains an unsupported value");
}

function unsignedPlan(plan: unknown): unknown {
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) return plan;
  const { receipt: _receipt, ...unsigned } = plan as Record<string, unknown>;
  return unsigned;
}

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("Plan receipt signing is not configured");
  return value;
}

function signingPayload(plan: unknown, userId: string, expiresAt: string): string {
  return canonicalize({
    expires_at: expiresAt,
    plan: unsignedPlan(plan),
    user_id: userId,
    version: RECEIPT_VERSION,
  });
}

function parsePlanBlob(planBlob: unknown): { raw?: unknown; reason?: ReceiptFailure } {
  try {
    const raw =
      typeof planBlob === "string"
        ? planBlob.length <= MAX_PLAN_BYTES
          ? JSON.parse(planBlob)
          : undefined
        : planBlob;
    if (raw === undefined) return { reason: "plan-too-large" };
    const canonical = canonicalize(unsignedPlan(raw));
    if (Buffer.byteLength(canonical, "utf8") > MAX_PLAN_BYTES) return { reason: "plan-too-large" };
    if (!VideoPlanSchema.safeParse(raw).success) return { reason: "invalid-plan" };
    return { raw };
  } catch {
    return { reason: "invalid-plan" };
  }
}

export function createPlanReceipt(
  plan: VideoPlan,
  userId: string,
  nowMs = Date.now(),
): PlanReceipt {
  const parsed = parsePlanBlob(plan);
  if (!parsed.raw) throw new Error(parsed.reason === "plan-too-large" ? "Plan is too large to sign" : "Plan is invalid");
  const expiresAt = new Date(nowMs + RECEIPT_TTL_MS).toISOString();
  const signature = createHmac("sha256", secret())
    .update(signingPayload(parsed.raw, userId, expiresAt))
    .digest("base64url");
  return { version: RECEIPT_VERSION, expires_at: expiresAt, signature };
}

/**
 * Verifies integrity and authenticated ownership of the exact canonical plan.
 * Callers must supply the current authenticated userId, never a client claim.
 */
export function verifyPlanReceipt(
  planBlob: unknown,
  receiptInput: unknown,
  userId: string,
  nowMs = Date.now(),
): PlanReceiptVerification {
  const receipt = PlanReceiptSchema.safeParse(receiptInput);
  if (!receipt.success) return { valid: false, reason: "invalid-receipt" };
  const parsed = parsePlanBlob(planBlob);
  if (!parsed.raw) return { valid: false, reason: parsed.reason ?? "invalid-plan" };

  const expiresMs = Date.parse(receipt.data.expires_at);
  if (
    !Number.isFinite(expiresMs) ||
    expiresMs > nowMs + RECEIPT_TTL_MS + MAX_CLOCK_SKEW_MS
  ) {
    return { valid: false, reason: "invalid-expiry" };
  }
  if (expiresMs <= nowMs) return { valid: false, reason: "expired" };

  let expected: Buffer;
  try {
    expected = createHmac("sha256", secret())
      .update(signingPayload(parsed.raw, userId, receipt.data.expires_at))
      .digest();
  } catch {
    return { valid: false, reason: "server-misconfigured" };
  }

  let supplied: Buffer;
  try {
    supplied = Buffer.from(receipt.data.signature, "base64url");
  } catch {
    return { valid: false, reason: "invalid-receipt" };
  }
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return { valid: false, reason: "bad-signature" };
  }
  return { valid: true, version: "1", expiresAt: receipt.data.expires_at };
}