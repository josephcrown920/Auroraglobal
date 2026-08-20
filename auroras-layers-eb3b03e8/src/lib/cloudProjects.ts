import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { LayerProject } from "@/lib/projects";

function dataUrlToBlob(dataUrl: string) {
  const [header, encoded] = dataUrl.split(",");
  if (!header || !encoded) throw new Error("Invalid project image");
  const type = header.match(/data:(.*?);base64/)?.[1] ?? "image/png";
  const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
  return new Blob([bytes], { type });
}

async function uploadImage(userId: string, projectId: string, filename: string, dataUrl?: string) {
  if (!dataUrl) return null;
  const path = `${userId}/${projectId}/${filename}`;
  const { error } = await supabase.storage
    .from("aurora-projects")
    .upload(path, dataUrlToBlob(dataUrl), { upsert: true, contentType: "image/png" });
  if (error) throw error;
  return path;
}

export async function saveCloudProject(
  project: LayerProject,
  settings: { brainModel: string; videoModel: string; identityLock: boolean; characterReference?: string },
) {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return false;

  const sourcePath = await uploadImage(user.id, project.id, "source.png", project.sourceUrl);
  const characterPath = await uploadImage(
    user.id,
    project.id,
    "character-reference.png",
    settings.characterReference,
  );
  const uploadedLayers = await Promise.all(
    project.layers.map(async (layer, index) => ({
      id: layer.id,
      prompt: layer.prompt,
      path: await uploadImage(user.id, project.id, `layer-${String(index + 1).padStart(2, "0")}.png`, layer.dataUrl),
    })),
  );
  const previewPath = uploadedLayers.at(-1)?.path ?? sourcePath;
  const { error } = await supabase.from("aurora_projects").upsert({
    id: project.id,
    user_id: user.id,
    name: project.name,
    prompt: project.prompt,
    image_model: project.model,
    video_model: settings.videoModel,
    brain_model: settings.brainModel,
    identity_lock: settings.identityLock,
    character_reference_path: characterPath,
    source_path: sourcePath,
    preview_path: previewPath,
    layers: uploadedLayers as unknown as Json,
  });
  if (error) throw error;
  return true;
}