-- ============================================================================
-- Full RLS behaviour tests (requires a connection that can SET ROLE authenticated,
-- i.e. the Supabase superuser / SUPABASE_DB_URL). Runs in a transaction and
-- ROLLBACKs everything, so it is safe against any environment.
--
-- Covers: profiles, contacts, inventory_items, platform_accounts, ads.
-- Verifies users can only read/insert/update/delete their own rows, that
-- WITH CHECK blocks spoofed user_id on writes, and that the `plan` column on
-- profiles is not self-mutable (column-level revoke).
-- ============================================================================

\set ON_ERROR_STOP on
BEGIN;

\set userA '11111111-1111-1111-1111-111111111111'
\set userB '22222222-2222-2222-2222-222222222222'

INSERT INTO public.profiles (id, email, full_name)
VALUES (:'userA'::uuid, 'rls-a@test.local', 'A'),
       (:'userB'::uuid, 'rls-b@test.local', 'B')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.contacts (user_id, persona) VALUES
  (:'userA'::uuid, 'A'), (:'userB'::uuid, 'B');
INSERT INTO public.inventory_items (user_id, codice_articolo) VALUES
  (:'userA'::uuid, 'A-SKU'), (:'userB'::uuid, 'B-SKU');
INSERT INTO public.platform_accounts (user_id, platform, username) VALUES
  (:'userA'::uuid, 'vinted', 'A'), (:'userB'::uuid, 'vinted', 'B');

CREATE OR REPLACE FUNCTION pg_temp.assume(uid uuid) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', uid::text, 'role', 'authenticated')::text, true);
END $$;

CREATE OR REPLACE FUNCTION pg_temp.expect(label text, actual int, expected int)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF actual = expected THEN RAISE NOTICE 'PASS  % (got %)', label, actual;
  ELSE RAISE EXCEPTION 'FAIL  %: expected %, got %', label, expected, actual; END IF;
END $$;

-- ── Visibility: user A sees only own rows ──────────────────────────────────
SELECT pg_temp.assume(:'userA'::uuid);
DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM public.profiles
    WHERE id <> '11111111-1111-1111-1111-111111111111';
  PERFORM pg_temp.expect('profiles: A cannot read others', n, 0);
  SELECT count(*) INTO n FROM public.contacts
    WHERE user_id <> '11111111-1111-1111-1111-111111111111';
  PERFORM pg_temp.expect('contacts: A cannot read others', n, 0);
  SELECT count(*) INTO n FROM public.inventory_items
    WHERE user_id <> '11111111-1111-1111-1111-111111111111';
  PERFORM pg_temp.expect('inventory_items: A cannot read others', n, 0);
  SELECT count(*) INTO n FROM public.platform_accounts
    WHERE user_id <> '11111111-1111-1111-1111-111111111111';
  PERFORM pg_temp.expect('platform_accounts: A cannot read others', n, 0);
END $$;

-- ── Writes: A can INSERT own rows on inventory_items + platform_accounts ──
DO $$ DECLARE n int; BEGIN
  WITH i AS (INSERT INTO public.inventory_items (user_id, codice_articolo)
             VALUES ('11111111-1111-1111-1111-111111111111', 'A-SKU-2')
             RETURNING 1)
  SELECT count(*) INTO n FROM i;
  PERFORM pg_temp.expect('inventory_items: A inserts own row', n, 1);

  WITH i AS (INSERT INTO public.platform_accounts (user_id, platform, username)
             VALUES ('11111111-1111-1111-1111-111111111111', 'ebay', 'A')
             RETURNING 1)
  SELECT count(*) INTO n FROM i;
  PERFORM pg_temp.expect('platform_accounts: A inserts own row', n, 1);
END $$;

-- ── WITH CHECK blocks A from inserting a row spoofed as B ─────────────────
DO $$ BEGIN
  BEGIN
    INSERT INTO public.inventory_items (user_id, codice_articolo)
    VALUES ('22222222-2222-2222-2222-222222222222', 'SPOOF');
    RAISE EXCEPTION 'FAIL  inventory_items: A inserted row owned by B';
  EXCEPTION WHEN insufficient_privilege OR sqlstate '42501' THEN
    RAISE NOTICE 'PASS  inventory_items: WITH CHECK blocks spoofed user_id';
  END;
  BEGIN
    INSERT INTO public.platform_accounts (user_id, platform, username)
    VALUES ('22222222-2222-2222-2222-222222222222', 'subito', 'SPOOF');
    RAISE EXCEPTION 'FAIL  platform_accounts: A inserted row owned by B';
  EXCEPTION WHEN insufficient_privilege OR sqlstate '42501' THEN
    RAISE NOTICE 'PASS  platform_accounts: WITH CHECK blocks spoofed user_id';
  END;
END $$;

-- ── A can UPDATE own rows; cannot touch B's ───────────────────────────────
DO $$ DECLARE n int; BEGIN
  WITH u AS (UPDATE public.inventory_items SET codice_articolo='A-OK'
              WHERE user_id='11111111-1111-1111-1111-111111111111' RETURNING 1)
  SELECT count(*) INTO n FROM u;
  IF n < 1 THEN RAISE EXCEPTION 'FAIL  inventory_items: A could not update own row'; END IF;
  RAISE NOTICE 'PASS  inventory_items: A updates own rows (got %)', n;

  WITH u AS (UPDATE public.inventory_items SET codice_articolo='HACK'
              WHERE user_id='22222222-2222-2222-2222-222222222222' RETURNING 1)
  SELECT count(*) INTO n FROM u;
  PERFORM pg_temp.expect('inventory_items: A cannot update B', n, 0);

  WITH u AS (UPDATE public.platform_accounts SET username='A-OK'
              WHERE user_id='11111111-1111-1111-1111-111111111111' RETURNING 1)
  SELECT count(*) INTO n FROM u;
  IF n < 1 THEN RAISE EXCEPTION 'FAIL  platform_accounts: A could not update own row'; END IF;
  RAISE NOTICE 'PASS  platform_accounts: A updates own rows (got %)', n;

  WITH u AS (UPDATE public.platform_accounts SET username='HACK'
              WHERE user_id='22222222-2222-2222-2222-222222222222' RETURNING 1)
  SELECT count(*) INTO n FROM u;
  PERFORM pg_temp.expect('platform_accounts: A cannot update B', n, 0);

  WITH u AS (UPDATE public.contacts SET note='x'
              WHERE user_id='22222222-2222-2222-2222-222222222222' RETURNING 1)
  SELECT count(*) INTO n FROM u;
  PERFORM pg_temp.expect('contacts: A cannot update B', n, 0);

  WITH u AS (UPDATE public.profiles SET full_name='x'
              WHERE id='22222222-2222-2222-2222-222222222222' RETURNING 1)
  SELECT count(*) INTO n FROM u;
  PERFORM pg_temp.expect('profiles: A cannot update B', n, 0);
END $$;

-- ── A cannot reassign own row to B (WITH CHECK on UPDATE) ─────────────────
DO $$ BEGIN
  BEGIN
    UPDATE public.inventory_items
       SET user_id='22222222-2222-2222-2222-222222222222'
     WHERE user_id='11111111-1111-1111-1111-111111111111';
    RAISE EXCEPTION 'FAIL  inventory_items: A reassigned own row to B';
  EXCEPTION WHEN insufficient_privilege OR sqlstate '42501' THEN
    RAISE NOTICE 'PASS  inventory_items: UPDATE WITH CHECK blocks user_id reassignment';
  END;
  BEGIN
    UPDATE public.platform_accounts
       SET user_id='22222222-2222-2222-2222-222222222222'
     WHERE user_id='11111111-1111-1111-1111-111111111111';
    RAISE EXCEPTION 'FAIL  platform_accounts: A reassigned own row to B';
  EXCEPTION WHEN insufficient_privilege OR sqlstate '42501' THEN
    RAISE NOTICE 'PASS  platform_accounts: UPDATE WITH CHECK blocks user_id reassignment';
  END;
END $$;

-- ── A can update own profile metadata ─────────────────────────────────────
DO $$ DECLARE n int; BEGIN
  WITH u AS (UPDATE public.profiles SET full_name='A2'
              WHERE id='11111111-1111-1111-1111-111111111111' RETURNING 1)
  SELECT count(*) INTO n FROM u;
  PERFORM pg_temp.expect('profiles: A updates own metadata', n, 1);
END $$;

-- ── A cannot self-mutate plan (column-level revoke) ───────────────────────
DO $$ BEGIN
  BEGIN
    UPDATE public.profiles SET plan='pro_flipper'
     WHERE id='11111111-1111-1111-1111-111111111111';
    RAISE EXCEPTION 'FAIL  profiles: A self-upgraded plan';
  EXCEPTION WHEN insufficient_privilege OR check_violation OR sqlstate '42501' THEN
    RAISE NOTICE 'PASS  profiles: A cannot self-mutate plan';
  END;
END $$;

-- ── A cannot DELETE B ─────────────────────────────────────────────────────
DO $$ DECLARE n int; BEGIN
  WITH d AS (DELETE FROM public.contacts
              WHERE user_id='22222222-2222-2222-2222-222222222222' RETURNING 1)
  SELECT count(*) INTO n FROM d;
  PERFORM pg_temp.expect('contacts: A cannot delete B', n, 0);
  WITH d AS (DELETE FROM public.inventory_items
              WHERE user_id='22222222-2222-2222-2222-222222222222' RETURNING 1)
  SELECT count(*) INTO n FROM d;
  PERFORM pg_temp.expect('inventory_items: A cannot delete B', n, 0);
  WITH d AS (DELETE FROM public.platform_accounts
              WHERE user_id='22222222-2222-2222-2222-222222222222' RETURNING 1)
  SELECT count(*) INTO n FROM d;
  PERFORM pg_temp.expect('platform_accounts: A cannot delete B', n, 0);
END $$;

-- ── A cannot INSERT a contact owned by B (WITH CHECK violation) ───────────
DO $$ BEGIN
  BEGIN
    INSERT INTO public.contacts (user_id, persona)
    VALUES ('22222222-2222-2222-2222-222222222222', 'spoof');
    RAISE EXCEPTION 'FAIL  contacts: A inserted row owned by B';
  EXCEPTION WHEN insufficient_privilege OR sqlstate '42501' THEN
    RAISE NOTICE 'PASS  contacts: A cannot insert row owned by B';
  END;
END $$;

-- ── Anonymous (anon role) sees nothing ────────────────────────────────────
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM public.profiles;
  PERFORM pg_temp.expect('profiles: anon read blocked', n, 0);
  SELECT count(*) INTO n FROM public.contacts;
  PERFORM pg_temp.expect('contacts: anon read blocked', n, 0);
  SELECT count(*) INTO n FROM public.inventory_items;
  PERFORM pg_temp.expect('inventory_items: anon read blocked', n, 0);
  SELECT count(*) INTO n FROM public.platform_accounts;
  PERFORM pg_temp.expect('platform_accounts: anon read blocked', n, 0);
END $$;

ROLLBACK;
