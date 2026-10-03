-- Human Reference Router: provider-specific identity metadata.
-- The asset ID is opaque provider metadata; it is never a raw face URL.
alter table public.souls
  add column if not exists modelark_identity_asset_id text,
  add column if not exists modelark_verified_at timestamptz,
  add column if not exists identity_authorized_at timestamptz;

create index if not exists idx_souls_modelark_identity_asset
  on public.souls(modelark_identity_asset_id)
  where modelark_identity_asset_id is not null;
