export function safeAuthReturnPath(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.startsWith("/")) {
    return undefined;
  }

  let decoded = value;
  try {
    // Browsers and routers can preserve encoded delimiters in search values.
    // Decode repeatedly so `%5C` and double-encoded variants are rejected too.
    for (let index = 0; index < 4; index += 1) {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    }
  } catch {
    return undefined;
  }

  if (decoded.includes("\\")) return undefined;

  // Resolve against a fixed local origin so protocol-relative or otherwise
  // malformed values cannot be mistaken for an internal router path.
  const parsed = new URL(decoded, "https://aurora.local");
  return parsed.origin === "https://aurora.local"
    ? `${parsed.pathname}${parsed.search}${parsed.hash}`
    : undefined;
}