type SentryContext = {
  source: string;
  requestUrl?: string;
};

function asError(error: unknown): { name: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { name: "UnknownError", message: String(error) };
}

function sentryEndpoint(dsn: string): { endpoint: string; publicKey: string; projectId: string } | null {
  try {
    const parsed = new URL(dsn);
    const projectId = parsed.pathname.split("/").filter(Boolean).at(-1);
    if (!parsed.username || !projectId) return null;
    return {
      endpoint: `${parsed.protocol}//${parsed.host}/api/${projectId}/envelope/`,
      publicKey: decodeURIComponent(parsed.username),
      projectId,
    };
  } catch {
    return null;
  }
}

export function reportServerException(error: unknown, context: SentryContext): void {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return;
  const target = sentryEndpoint(dsn);
  if (!target) {
    console.error("[sentry] invalid SENTRY_DSN; exception was not reported");
    return;
  }

  const normalized = asError(error);
  const eventId = crypto.randomUUID().replaceAll("-", "");
  const event = {
    event_id: eventId,
    timestamp: Math.floor(Date.now() / 1000),
    platform: "javascript",
    level: "error",
    server_name: "aurora",
    tags: { source: context.source },
    extra: context.requestUrl ? { request_url: context.requestUrl } : undefined,
    exception: {
      values: [
        {
          type: normalized.name,
          value: normalized.message,
          stacktrace: normalized.stack
            ? { frames: [{ filename: "server", function: context.source, lineno: 0, colno: 0 }] }
            : undefined,
        },
      ],
    },
  };
  const header = {
    event_id: eventId,
    sent_at: new Date().toISOString(),
    dsn: `https://${target.publicKey}@${new URL(dsn).host}/${target.projectId}`,
  };
  const item = { type: "event", length: JSON.stringify(event).length };
  const body = `${JSON.stringify(header)}\n${JSON.stringify(item)}\n${JSON.stringify(event)}`;

  void fetch(target.endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-sentry-envelope" },
    body,
  }).catch((reportError) => {
    console.error("[sentry] report failed:", reportError instanceof Error ? reportError.message : reportError);
  });
}