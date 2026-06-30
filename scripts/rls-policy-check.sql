-- ============================================================================
-- RLS policy-shape guardrail (lightweight; SELECT-only)
-- CI guardrail covering ALL user-data tables (profiles, contacts,
-- inventory_items, inventory_template_fields, inventory_audit_log,
-- platform_accounts, ads) plus the previously fixed findings:
--   plan_writable_by_user, platform_accts_public, contacts_public_read,
--   inventory_items_public_role, profiles_public_read, profiles_plan_field_user_writable
--
-- Runnable with any role that can read pg_catalog (no SET ROLE required).
-- ============================================================================

\set ON_ERROR_STOP on

-- Tables that must be locked down to the row owner.
-- (inventory_audit_log is owner-read-only — no INSERT/UPDATE/DELETE from clients.)
-- 1. No table in public may carry a policy attached to the `public` role.
DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(format('%I.%I → %I', schemaname, tablename, policyname), ', ')
    INTO bad
    FROM pg_policies
   WHERE schemaname = 'public'
     AND 'public' = ANY(roles);
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'RLS regression: public-role policies present: %', bad;
  END IF;
  RAISE NOTICE 'PASS  no public-role policies on any public-schema table';
END $$;

-- 2. RLS must be enabled on every user-data table.
DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(c.relname, ', ')
    INTO bad
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname IN ('profiles','contacts','inventory_items',
                       'inventory_template_fields','inventory_audit_log',
                       'platform_accounts','ads')
     AND c.relrowsecurity = false;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'RLS regression: RLS disabled on: %', bad;
  END IF;
  RAISE NOTICE 'PASS  RLS enabled on all protected tables';
END $$;

-- 3. Every protected table must have at least one auth.uid()-scoped SELECT/ALL policy.
DO $$
DECLARE bad text;
BEGIN
  WITH required AS (
    SELECT unnest(ARRAY['profiles','contacts','inventory_items',
                        'inventory_template_fields','inventory_audit_log',
                        'platform_accounts','ads']) AS t
  ), ok AS (
    SELECT DISTINCT tablename FROM pg_policies
     WHERE schemaname = 'public'
       AND cmd IN ('SELECT','ALL')
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

-- 4. Every write-capable protected table must enforce auth.uid() in WITH CHECK.
DO $$
DECLARE bad text;
BEGIN
  WITH required AS (
    SELECT unnest(ARRAY['profiles','contacts','inventory_items',
                        'inventory_template_fields','platform_accounts','ads']) AS t
  ), ok AS (
    SELECT DISTINCT tablename FROM pg_policies
     WHERE schemaname = 'public'
       AND cmd IN ('INSERT','UPDATE','ALL')
       AND with_check ILIKE '%auth.uid()%'
  )
  SELECT string_agg(t, ', ') INTO bad
    FROM required r
   WHERE r.t NOT IN (SELECT tablename FROM ok);
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'RLS regression: missing auth.uid() WITH CHECK on writes for: %', bad;
  END IF;
  RAISE NOTICE 'PASS  auth.uid() WITH CHECK enforced on writes';
END $$;

-- 5. profiles.plan must not be writable by authenticated (column-level grant).
DO $$
DECLARE has_grant boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.column_privileges
     WHERE grantee IN ('authenticated','anon','PUBLIC')
       AND table_schema = 'public' AND table_name = 'profiles'
       AND column_name = 'plan' AND privilege_type IN ('UPDATE','INSERT')
  ) INTO has_grant;
  IF has_grant THEN
    RAISE EXCEPTION 'RLS regression: profiles.plan is writable by authenticated/anon';
  END IF;
  RAISE NOTICE 'PASS  profiles.plan is not user-writable (column-level revoke)';
END $$;
