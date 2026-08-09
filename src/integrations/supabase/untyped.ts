// Boundary cast for tables/columns that exist on the live DB but are missing
// from the generated Supabase types (types are refreshed separately from
// migrations). Use `supabaseAdmin as unknown as UntypedDb` at the boundary
// instead of scattering `as any` casts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- deliberate escape hatch for stale generated types; the single sanctioned `any` boundary
export type UntypedDb = { from: (table: string) => any };
