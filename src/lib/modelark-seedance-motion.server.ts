import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ARK_DEFAULT_BASE = "https://ark.ap-southeast.bytepluses.com";
const MODEL_IDS = {
  "seedance-2.0-fast": "dreamina-seedance-2-0-fast-260128",
  "seedance-2.0": "dreamina-seedance-2-0-260128",
  "seedance-2.5": "dreamina-seedance-2-5-260628",
} as const;

type ModelKey = keyof typeof MODEL_IDS;

type MotionRequest = {
  modelKey: ModelKey;
  subjectImageUrl: string;
  motionVideoUrl: string;
  prompt: string;
  duration: number;
  resolution: "480p" | "720p" | "1080p";
  cameraMovement?: string | null;
};

type ArkTask = {
  id?: string;
  status?: string;
  content?: { video_url?: string };
  error?: { message?: string } | string | null;
};

function arkBaseUrl(): string {
  const raw = (process.env.ARK_BASE_URL || ARK_DEFAULT_BASE).replace(/\/+$/, "");
  return raw.endsWith("/api/v3") ? raw : `${raw}/api/v3`;
}

function arkHeaders(): Record<string, string> {
  const key = process.env.ARK_API_KEY || process.env.BYTEPLUS_API_KEY;
  if (!key) throw new Error("ModelArk is not configured: ARK_API_KEY is missing");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
  };
}

async function signStudioUrl(url: string): Promise<string> {
  const marker = "/storage/v1/object/public/studio/";
  const index = url.indexOf(marker);
  if (index === -1) return url;

  const path = decodeURIComponent(url.slice(index + marker.length).split("?")[0]);
  const { data, error } = await supabaseAdmin.storage
    .from("studio")
    .createSignedUrl(path, 60 * 60);
  return error || !data?.signedUrl ? url : data.signedUrl;
}

function addCameraDirection(prompt: string, cameraMovement?: string | null): string {
  if (!cameraMovement || cameraMovement === "static") return prompt;
  const hints: Record<string, string> = {
    push_in: "confident cinematic push-in toward the subject",
    pull_out: "graceful cinematic pull-out revealing the environment",
    orbit_cw: "cinematic clockwise orbit around the subject",
    orbit_ccw: "cinematic counter-clockwise orbit around the subject",
    pan_left: "smooth cinematic pan to the left",
    pan_right: "smooth cinematic pan to the right",
    tilt_up: "smooth cinematic tilt upward",
    tilt_down: "smooth cinematic tilt downward",
    zoom_in: "slow smooth zoom toward the subject",
    zoom_out: "slow smooth zoom away from the subject",
    handheld: "controlled natural handheld camera movement",
  };
  const hint = hints[cameraMovement];
  return hint ? `${prompt.replace(/\s+$/, "")}. ${hint}.` : prompt;
}

function modelId(modelKey: ModelKey): string {
  if (modelKey === "seedance-2.0-fast") {
    return process.env.ARK_VIDEO_FAST_MODEL || MODEL_IDS[modelKey];
  }
  if (modelKey === "seedance-2.0") {
    return process.env.ARK_VIDEO_MODEL || MODEL_IDS[modelKey];
  }
  return process.env.ARK_VIDEO_25_MODEL || MODEL_IDS[modelKey];
}

export async function generateModelArkMotion(input: MotionRequest): Promise<{
  videoUrl: string;
  provider: "modelark";
  endpoint: string;
  latencyMs: number;
  costUsd: number;
}> {
  const started = Date.now();
  const imageUrl = await signStudioUrl(input.subjectImageUrl);
  const videoUrl = await signStudioUrl(input.motionVideoUrl);
  const model = modelId(input.modelKey);
  const usesReferenceImage = true;

  const content: Array<Record<string, unknown>> = [
    {
      type: "image_url",
      role: usesReferenceImage ? "reference_image" : "first_frame",
      image_url: { url: imageUrl },
    },
    {
      type: "video_url",
      role: "reference_video",
      video_url: { url: videoUrl },
    },
    {
      type: "text",
      text: addCameraDirection(input.prompt, input.cameraMovement),
    },
  ];

  const resolution = input.modelKey === "seedance-2.0-fast" && input.resolution === "1080p"
    ? "720p"
    : input.resolution;

  const body: Record<string, unknown> = {
    model,
    content,
    resolution,
    duration: input.modelKey === "seedance-2.5"
      ? Math.max(4, Math.min(30, Math.round(input.duration)))
      : Math.max(4, Math.min(15, Math.round(input.duration))),
    camera_fixed: input.cameraMovement === "static",
  };

  const create = await fetch(`${arkBaseUrl()}/contents/generations/tasks`, {
    method: "POST",
    headers: arkHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  if (!create.ok) {
    throw new Error(`ModelArk create failed (${create.status}): ${(await create.text()).slice(0, 500)}`);
  }

  const created = await create.json() as { id?: string; task_id?: string; data?: { id?: string } };
  const taskId = created.id ?? created.task_id ?? created.data?.id;
  if (!taskId) throw new Error("ModelArk returned no video task ID");

  const deadline = Date.now() + 10 * 60_000;
  let delayMs = 3000;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    delayMs = Math.min(delayMs + 1000, 7000);

    const poll = await fetch(
      `${arkBaseUrl()}/contents/generations/tasks/${encodeURIComponent(taskId)}`,
      { headers: arkHeaders(), signal: AbortSignal.timeout(30_000) },
    );

    if (!poll.ok) {
      throw new Error(`ModelArk poll failed (${poll.status}): ${(await poll.text()).slice(0, 500)}`);
    }

    const task = await poll.json() as ArkTask;
    const status = task.status?.toLowerCase();

    if (status === "succeeded" || status === "completed") {
      const url = task.content?.video_url;
      if (!url) throw new Error("ModelArk completed without a video URL");
      return {
        videoUrl: url,
        provider: "modelark",
        endpoint: `modelark:${model}`,
        latencyMs: Date.now() - started,
        costUsd: 0,
      };
    }

    if (["failed", "expired", "cancelled", "canceled"].includes(status ?? "")) {
      const error = typeof task.error === "string" ? task.error : task.error?.message;
      throw new Error(`ModelArk ${status}: ${error ?? "unknown error"}`);
    }
  }

  throw new Error("ModelArk motion generation timed out after 10 minutes");
}
