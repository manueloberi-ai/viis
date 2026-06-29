-- ============================================================================
-- RLS policy-shape guardrail (lightweight; SELECT-only)
-- Used in CI to prevent regressions of these fixed findings:
--   plan_writable_by_user, platform_accts_public, contacts_public_read,
--   inventory_items_public_role, profiles_public_read
--
-- Runnable with any role that can read pg_catalog (no SET ROLE required).
-- ============================================================================

\set ON_ERROR_STOP on

-- 1. No protected table may carry a policy attached to the `public` role.
DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(format('%I.%I → %I', schemaname, tablename, policyname), ', ')
    INTO bad
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename IN ('profiles','contacts','inventory_items','platform_accounts')
     AND 'public' = ANY(roles);
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'RLS regression: public-role policies present: %', bad;
  END IF;
  RAISE NOTICE 'PASS  no public-role policies on protected tables';
END $$;

-- 2. RLS must be enabled on every protected table.
DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(c.relname, ', ')
    INTO bad
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname IN ('profiles','contacts','inventory_items','platform_accounts')
     AND c.relrowsecurity = false;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'RLS regression: RLS disabled on: %', bad;
  END IF;
  RAISE NOTICE 'PASS  RLS enabled on all protected tables';
END $$;

-- 3. Every protected table must have at least one SELECT policy scoped to auth.uid().
DO $$
DECLARE bad text;
BEGIN
  WITH required AS (
    SELECT unnest(ARRAY['profiles','contacts','inventory_items','platform_accounts']) AS t
  ), ok AS (
    SELECT DISTINCT tablename FROM pg_policies
     WHERE schemaname = 'public'
       AND (cmd IN ('SELECT','ALL'))
       AND qual ILIKE '%auth.uid()%'
  )
  SELECT string_agg(t, ', ') INTO bad
    FROM required r
   WHERE r.t NOT IN (SELECT tablename FROM ok);
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'RLS regression: missing auth.uid()-scoped read policy on: %', bad;
  END IF;
  RAISE NOTICE 'PASS  auth.uid()-scoped read policies present';
END $$;

-- 4. profiles UPDATE policy must reference `plan` in WITH CHECK so users
--    cannot self-mutate the subscription tier.
DO $$
DECLARE found boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'profiles'
       AND cmd = 'UPDATE'
       AND with_check ILIKE '%plan%'
  ) INTO found;
  IF NOT found THEN
    RAISE EXCEPTION 'RLS regression: profiles UPDATE policy no longer pins `plan` in WITH CHECK';
  END IF;
  RAISE NOTICE 'PASS  profiles.plan is non-self-mutable';
END $$;
