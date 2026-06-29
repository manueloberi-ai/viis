
-- contacts
DROP POLICY IF EXISTS "Users manage own contacts" ON public.contacts;
CREATE POLICY "Users manage own contacts" ON public.contacts
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- inventory_items
DROP POLICY IF EXISTS "users manage own items" ON public.inventory_items;
CREATE POLICY "users manage own items" ON public.inventory_items
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- platform_accounts
DROP POLICY IF EXISTS "users manage own platform accounts" ON public.platform_accounts;
CREATE POLICY "users manage own platform accounts" ON public.platform_accounts
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- profiles: split policy + prevent user-driven plan changes
DROP POLICY IF EXISTS "users manage own profile" ON public.profiles;

CREATE POLICY "users read own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "users insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "users update own profile metadata" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND plan IS NOT DISTINCT FROM (SELECT p.plan FROM public.profiles p WHERE p.id = auth.uid())
  );

CREATE POLICY "users delete own profile" ON public.profiles
  FOR DELETE TO authenticated
  USING (auth.uid() = id);
