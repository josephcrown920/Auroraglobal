/**
 * Seedance/ModelArk reference policy.
 *
 * ModelArk may reject direct real-person face media in Seedance reference slots.
 * Aurora must never attempt to bypass that policy. When a user has an approved
 * ModelArk/LAS identity asset, pass its asset:// identifier instead of a raw
 * Supabase URL. If no approved asset exists, the caller must route the request
 * through Aurora's identity onboarding or another provider/workflow.
 */

export function modelArkAssetUri(assetId: string): string {
  const id = assetId.trim();
  if (!id || id.includes("://") || /[\s"'<>]/.test(id)) {
    throw new Error("Invalid ModelArk identity asset ID");
  }
  return `asset://${id}`;
}

export function isModelArkAssetUri(value: string): boolean {
  return /^asset:\/\/[^\s"'<>]+$/.test(value.trim());
}

export function seedanceReferenceMessage(): string {
  return "This Seedance workflow requires an authorized ModelArk/LAS identity asset for a real-person reference. Verify the performer or choose a provider/workflow that supports this reference.";
}
