export function hasBackendEnv() {
  return Boolean(
    import.meta.env.VITE_SUPABASE_URL &&
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  );
}
