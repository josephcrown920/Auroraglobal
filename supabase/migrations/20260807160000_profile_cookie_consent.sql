-- Add cookie_consent column to profiles so authenticated users' consent
-- choice is synced across devices. NULL = no server-side preference stored
-- yet (banner should fall back to localStorage). The value matches the
-- ConsentStatus type: 'accepted' | 'declined'.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cookie_consent TEXT CHECK (cookie_consent IN ('accepted', 'declined'));
