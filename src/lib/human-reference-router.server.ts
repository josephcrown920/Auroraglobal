/**
 * Central human-reference routing policy.
 *
 * Aurora never attempts to defeat a provider's real-person restriction.
 * Seedance/ModelArk human-reference motion requires an approved ModelArk/LAS
 * identity asset. Other providers can use their own supported identity route.
 */
import { modelArkAssetUri, seedanceReferenceMessage } from "./seedance-reference-policy";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type HumanReferenceRoute = {
  provider: "modelark" | "native";
  referenceUri: string;
  authorized: boolean;
  reason: string;
};

export function routeHumanReference(input: {
  provider: "modelark" | "native";
  sourceUrl?: string | null;
  modelarkIdentityAssetId?: string | null;
  humanReference: boolean;
}): HumanReferenceRoute {
  if (!input.humanReference) {
    if (!input.sourceUrl) throw new Error("Reference media is required");
    return { provider: input.provider, referenceUri: input.sourceUrl, authorized: true, reason: "Non-human reference" };
  }
  if (input.provider === "modelark") {
    const assetId = input.modelarkIdentityAssetId?.trim();
    if (!assetId) throw new Error(seedanceReferenceMessage());
    return {
      provider: "modelark",
      referenceUri: modelArkAssetUri(assetId),
      authorized: true,
      reason: "Approved ModelArk/LAS identity asset supplied",
    };
  }
  if (!input.sourceUrl) throw new Error("Authorized human reference media is required");
  return { provider: "native", referenceUri: input.sourceUrl, authorized: true, reason: "Provider-specific human-reference route" };
}

export function isSeedanceModel(model?: string | null): boolean {
  const value = model?.trim().toLowerCase() ?? "";
  return value.includes("seedance") || value.includes("dreamina-seedance");
}


export async function resolveAuthorizedModelArkAsset(input: {
  userId: string;
  soulId?: string | null;
  directAssetId?: string | null;
}): Promise<string> {
  if (input.soulId) {
    const { data, error } = await supabaseAdmin
      .from("souls" as never)
      .select("id, user_id, status, modelark_identity_asset_id, modelark_verified_at" as never)
      .eq("id" as never, input.soulId)
      .eq("user_id" as never, input.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const row = data as {
      id: string;
      user_id: string;
      status: string;
      modelark_identity_asset_id: string | null;
      modelark_verified_at: string | null;
    } | null;
    if (!row || row.status !== "ready" || !row.modelark_identity_asset_id || !row.modelark_verified_at) {
      throw new Error(seedanceReferenceMessage());
    }
    return row.modelark_identity_asset_id;
  }

  const direct = input.directAssetId?.trim();
  if (!direct) throw new Error(seedanceReferenceMessage());
  return direct;
}
