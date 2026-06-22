
-- 1. Profiles: restrict updatable columns
DROP POLICY IF EXISTS "profile self update" ON public.profiles;
CREATE POLICY "profile self update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND credits IS NOT DISTINCT FROM (SELECT p.credits FROM public.profiles p WHERE p.user_id = auth.uid())
    AND plan IS NOT DISTINCT FROM (SELECT p.plan FROM public.profiles p WHERE p.user_id = auth.uid())
    AND lifetime_credits_purchased IS NOT DISTINCT FROM (SELECT p.lifetime_credits_purchased FROM public.profiles p WHERE p.user_id = auth.uid())
  );

-- 2. Affiliates: prevent commission/earnings escalation
DROP POLICY IF EXISTS "aff self update" ON public.affiliates;
CREATE POLICY "aff self update" ON public.affiliates
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND commission_pct IS NOT DISTINCT FROM (SELECT a.commission_pct FROM public.affiliates a WHERE a.user_id = auth.uid())
    AND total_earned_usd IS NOT DISTINCT FROM (SELECT a.total_earned_usd FROM public.affiliates a WHERE a.user_id = auth.uid())
    AND code IS NOT DISTINCT FROM (SELECT a.code FROM public.affiliates a WHERE a.user_id = auth.uid())
  );

-- 3. Affiliate events: validate code exists; user_id must match caller (or be null for anon clicks)
DROP POLICY IF EXISTS "aff events insert anyone" ON public.affiliate_events;
CREATE POLICY "aff events insert validated" ON public.affiliate_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    kind IN ('click')
    AND amount_usd IS NULL OR amount_usd = 0
    AND (user_id IS NULL OR user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.affiliates a WHERE a.code = affiliate_events.code)
  );

-- 4. Events: prevent forged user_id
DROP POLICY IF EXISTS "anyone can insert events" ON public.events;
CREATE POLICY "anyone can insert events" ON public.events
  FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- 5. Workflows: split policy so only owners can delete/update/insert
DROP POLICY IF EXISTS "wf self all" ON public.workflows;
CREATE POLICY "wf select own or public" ON public.workflows
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_public = true);
CREATE POLICY "wf insert own" ON public.workflows
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wf update own" ON public.workflows
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wf delete own" ON public.workflows
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 6. Gift cards: drop broad authenticated read; redemption uses supabaseAdmin server-side
DROP POLICY IF EXISTS "lookup gift cards" ON public.gift_cards;
-- admin manage policy remains; service_role bypasses RLS

-- 7. Remove hardcoded admin email from signup handler
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (user_id, email, credits)
  values (new.id, new.email, 5)
  on conflict (user_id) do nothing;

  insert into public.credit_ledger (user_id, delta, reason)
  values (new.id, 5, 'signup_bonus');
  return new;
end;
$function$;

-- 8. Lock down SECURITY DEFINER credit functions: only service_role may call
REVOKE EXECUTE ON FUNCTION public.grant_credits(uuid, integer, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.deduct_credits(uuid, integer, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_credits(uuid, integer, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.deduct_credits(uuid, integer, text, uuid) TO service_role;
