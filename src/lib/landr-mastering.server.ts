// LANDR AI Mastering integration.
// API docs: https://api.landr.com (openapi v3 spec in attached_assets/)
// Requires LANDR_MASTERING_API_KEY environment variable.

const LANDR_BASE = "https://api.landr.com";

function getKey(): string {
  const key = process.env.LANDR_MASTERING_API_KEY;
  if (!key) throw new Error("LANDR_MASTERING_API_KEY is not configured");
  return key;
}

export type MasterLoudness = "low" | "medium" | "high";
export type MasterStyle = "balanced" | "warm" | "open" | "punchy" | "clean";
export type MasterFormat = "mp3" | "wav" | "aiff" | "flac" | "cd";

export type MasterRequest = {
  /** Public URL of the audio file to master (MP3, WAV, AIFF, FLAC) */
  inputUri: string;
  loudness?: MasterLoudness;
  style?: MasterStyle;
  format?: MasterFormat;
};

export type MasterStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "expired";

export type MasterResult = {
  id: string;
  statusUrl: string;
};

export type MasterStatusResult = {
  id: string;
  status: MasterStatus;
  /** Download URL — present only when status === "completed" */
  downloadUrl?: string;
  errorMessage?: string;
};

/** Submit a single track for AI mastering. Returns a job ID + poll URL. */
export async function submitMaster(req: MasterRequest): Promise<MasterResult> {
  const key = getKey();
  const body = {
    inputUri: req.inputUri,
    loudness: req.loudness ?? "medium",
    style: req.style ?? "balanced",
    format: req.format ?? "mp3",
  };

  const res = await fetch(`${LANDR_BASE}/mastering/v1/master/single`, {
    method: "POST",
    headers: {
      "x-landr-mastering-api-key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "Unknown error");
    throw new Error(`LANDR mastering submit failed (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { id: string; statusUrl: string };
  return { id: data.id, statusUrl: data.statusUrl };
}

/** Poll the status of a previously submitted master job. */
export async function getMasterStatus(id: string): Promise<MasterStatusResult> {
  const key = getKey();
  const res = await fetch(`${LANDR_BASE}/mastering/v1/master/single/${id}/status`, {
    headers: { "x-landr-mastering-api-key": key },
  });

  if (res.status === 404) {
    return { id, status: "expired", errorMessage: "Master job not found or expired" };
  }
  if (!res.ok) {
    const errText = await res.text().catch(() => "Unknown error");
    throw new Error(`LANDR status check failed (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as {
    id: string;
    status: MasterStatus;
    downloadUrl?: string;
    errorMessage?: string;
  };

  return {
    id: data.id,
    status: data.status,
    downloadUrl: data.downloadUrl,
    errorMessage: data.errorMessage,
  };
}

/** Whether the LANDR API key is configured. */
export function isLandrConfigured(): boolean {
  return !!process.env.LANDR_MASTERING_API_KEY;
}
