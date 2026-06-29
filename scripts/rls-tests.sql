-- ============================================================================
-- RLS regression tests
-- Verifies users can only read/update their own rows on:
--   profiles, contacts, inventory_items, platform_accounts
-- And that the `plan` column on profiles cannot be self-mutated.
--
-- Strategy: simulate two authenticated users by setting role to
-- `authenticated` and `request.jwt.claims` so `auth.uid()` returns each
-- user's id. All work happens inside a transaction and is rolled back.
-- ============================================================================

\set ON_ERROR_STOP on
\timing off
BEGIN;

-- Stable UUIDs for the simulated users
\set userA '11111111-1111-1111-1111-111111111111'
\set userB '22222222-2222-2222-2222-222222222222'

-- Seed two auth.users rows so FKs and triggers behave like prod.
-- We use service-role (current session) for setup, then switch to
-- the `authenticated` role to exercise RLS.
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
VALUES
  (:'userA'::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
   'authenticated', 'rls-test-a@example.com', '',
   now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  (:'userB'::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
   'authenticated', 'rls-test-b@example.com', '',
   now(), now(), now(), '{}'::jsonb, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- handle_new_user() trigger should have created profiles; ensure they exist
INSERT INTO public.profiles (id, email, full_name)
VALUES (:'userA'::uuid, 'rls-test-a@example.com', 'A'),
       (:'userB'::uuid, 'rls-test-b@example.com', 'B')
ON CONFLICT (id) DO NOTHING;

-- Insert one row per user in every protected table (as service role / postgres).
INSERT INTO public.contacts (user_id, persona) VALUES
  (:'userA'::uuid, 'A-contact'),
  (:'userB'::uuid, 'B-contact');

INSERT INTO public.inventory_items (user_id, codice_articolo) VALUES
  (:'userA'::uuid, 'A-SKU'),
  (:'userB'::uuid, 'B-SKU');

INSERT INTO public.platform_accounts (user_id, platform, username) VALUES
  (:'userA'::uuid, 'vinted', 'A-user'),
  (:'userB'::uuid, 'vinted', 'B-user');

-- Helper: switch identity
CREATE OR REPLACE FUNCTION pg_temp.assume(uid uuid) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims',
                     json_build_object('sub', uid::text, 'role', 'authenticated')::text,
                     true);
END $$;

-- Helper: assert and report
CREATE OR REPLACE FUNCTION pg_temp.expect(label text, actual int, expected int)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF actual = expected THEN
    RAISE NOTICE 'PASS  % (got %)', label, actual;
  ELSE
    RAISE EXCEPTION 'FAIL  %: expected %, got %', label, expected, actual;
  END IF;
END $$;

-- ============================================================================
-- As user A
-- ============================================================================
SELECT pg_temp.assume(:'userA'::uuid);

DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM public.profiles;
  PERFORM pg_temp.expect('profiles: A sees only own row', n, 1);

  SELECT count(*) INTO n FROM public.contacts;
  PERFORM pg_temp.expect('contacts: A sees only own row', n, 1);

  SELECT count(*) INTO n FROM public.inventory_items;
  PERFORM pg_temp.expect('inventory_items: A sees only own row', n, 1);

  SELECT count(*) INTO n FROM public.platform_accounts;
  PERFORM pg_temp.expect('platform_accounts: A sees only own row', n, 1);
END $$;

-- A cannot UPDATE B's rows (row not visible → 0 affected, not an error)
DO $$ DECLARE n int; BEGIN
  WITH u AS (UPDATE public.contacts SET note = 'hacked'
              WHERE user_id = '22222222-2222-2222-2222-222222222222' RETURNING 1)
  SELECT count(*) INTO n FROM u;
  PERFORM pg_temp.expect('contacts: A cannot update B', n, 0);

  WITH u AS (UPDATE public.inventory_items SET codice_articolo = 'hacked'
              WHERE user_id = '22222222-2222-2222-2222-222222222222' RETURNING 1)
  SELECT count(*) INTO n FROM u;
  PERFORM pg_temp.expect('inventory_items: A cannot update B', n, 0);

  WITH u AS (UPDATE public.platform_accounts SET username = 'hacked'
              WHERE user_id = '22222222-2222-2222-2222-222222222222' RETURNING 1)
  SELECT count(*) INTO n FROM u;
  PERFORM pg_temp.expect('platform_accounts: A cannot update B', n, 0);

  WITH u AS (UPDATE public.profiles SET full_name = 'hacked'
              WHERE id = '22222222-2222-2222-2222-222222222222' RETURNING 1)
  SELECT count(*) INTO n FROM u;
  PERFORM pg_temp.expect('profiles: A cannot update B', n, 0);
END $$;

-- A CAN update own non-plan profile field
DO $$ DECLARE n int; BEGIN
  WITH u AS (UPDATE public.profiles SET full_name = 'A2'
              WHERE id = '11111111-1111-1111-1111-111111111111' RETURNING 1)
  SELECT count(*) INTO n FROM u;
  PERFORM pg_temp.expect('profiles: A updates own metadata', n, 1);
END $$;

-- A CANNOT update own `plan` field (policy WITH CHECK blocks it)
DO $$ BEGIN
  BEGIN
    UPDATE public.profiles SET plan = 'pro_flipper'
     WHERE id = '11111111-1111-1111-1111-111111111111';
    -- If we got here, the WITH CHECK didn't fire – fail.
    RAISE EXCEPTION 'FAIL  profiles: A self-upgraded plan (RLS bypass)';
  EXCEPTION
    WHEN check_violation OR insufficient_privilege OR sqlstate '42501' THEN
      RAISE NOTICE 'PASS  profiles: A cannot self-mutate plan (blocked: %)', SQLERRM;
    WHEN OTHERS THEN
      -- new-row-violates-rls comes back as sqlstate 42501; double-check
      IF SQLSTATE IN ('42501') THEN
        RAISE NOTICE 'PASS  profiles: A cannot self-mutate plan';
      ELSE
        RAISE;
      END IF;
  END;
END $$;

-- A cannot DELETE B's rows
DO $$ DECLARE n int; BEGIN
  WITH d AS (DELETE FROM public.contacts
              WHERE user_id = '22222222-2222-2222-2222-222222222222' RETURNING 1)
  SELECT count(*) INTO n FROM d;
  PERFORM pg_temp.expect('contacts: A cannot delete B', n, 0);
END $$;

-- A cannot INSERT a row owned by B
DO $$ BEGIN
  BEGIN
    INSERT INTO public.contacts (user_id, persona)
    VALUES ('22222222-2222-2222-2222-222222222222', 'spoof');
    RAISE EXCEPTION 'FAIL  contacts: A inserted row owned by B';
  EXCEPTION WHEN insufficient_privilege OR sqlstate '42501' THEN
    RAISE NOTICE 'PASS  contacts: A cannot insert row owned by B';
  END;
END $$;

-- ============================================================================
-- Policy shape: every protected policy must target the `authenticated` role,
-- not `public`. Guards against regressions of the recently fixed findings.
-- ============================================================================
RESET ROLE;
DO $$ DECLARE bad int; BEGIN
  SELECT count(*) INTO bad
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename IN ('profiles','contacts','inventory_items','platform_accounts')
     AND 'public' = ANY(roles);
  PERFORM pg_temp.expect('policies: no public-role policies on protected tables', bad, 0);
END $$;

ROLLBACK;
