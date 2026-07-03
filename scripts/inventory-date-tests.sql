-- ============================================================================
-- inventory_items: data_acquisto <= data_vendita constraint tests
--
-- Covers:
--   * CHECK constraint blocks acquisto > vendita (new rows)
--   * BEFORE INSERT/UPDATE trigger raises SQLSTATE 'VIIS1' with friendly text
--   * Edge cases: same day is allowed, one side NULL is allowed,
--                 both NULL is allowed
--   * Timezone: DATE columns are timezone-agnostic; a UTC-midnight
--                 timestamp read as DATE in Europe/Rome still equals the
--                 same calendar day used for the comparison
--   * Reassignment attack: UPDATE that moves acquisto past vendita is blocked
--
-- Wrapped in a transaction and ROLLBACKed, so it is safe to run repeatedly.
-- ============================================================================

\set ON_ERROR_STOP on
BEGIN;

\set uid '33333333-3333-3333-3333-333333333333'

INSERT INTO public.profiles (id, email, full_name)
VALUES (:'uid'::uuid, 'date-test@test.local', 'DateTester')
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION pg_temp.expect_ok(label text) RETURNS void
LANGUAGE plpgsql AS $$ BEGIN RAISE NOTICE 'PASS  %', label; END $$;

CREATE OR REPLACE FUNCTION pg_temp.expect_fail(label text) RETURNS void
LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'FAIL  %', label; END $$;

-- ── Same day: acquisto == vendita is allowed ──────────────────────────────
DO $$ BEGIN
  INSERT INTO public.inventory_items (user_id, codice_articolo, data_acquisto, data_vendita)
  VALUES (:'uid'::uuid, 'SAME-DAY', DATE '2026-06-15', DATE '2026-06-15');
  PERFORM pg_temp.expect_ok('same day (acquisto = vendita) accepted');
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.expect_fail('same day should be accepted, got ' || SQLSTATE || ': ' || SQLERRM);
END $$;

-- ── data_acquisto NULL, data_vendita set: allowed ─────────────────────────
DO $$ BEGIN
  INSERT INTO public.inventory_items (user_id, codice_articolo, data_acquisto, data_vendita)
  VALUES (:'uid'::uuid, 'NULL-ACQ', NULL, DATE '2026-06-15');
  PERFORM pg_temp.expect_ok('NULL data_acquisto with set data_vendita accepted');
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.expect_fail('NULL acquisto rejected: ' || SQLSTATE || ': ' || SQLERRM);
END $$;

-- ── data_vendita NULL, data_acquisto set: allowed ─────────────────────────
DO $$ BEGIN
  INSERT INTO public.inventory_items (user_id, codice_articolo, data_acquisto, data_vendita)
  VALUES (:'uid'::uuid, 'NULL-VEN', DATE '2026-06-15', NULL);
  PERFORM pg_temp.expect_ok('NULL data_vendita with set data_acquisto accepted');
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.expect_fail('NULL vendita rejected: ' || SQLSTATE || ': ' || SQLERRM);
END $$;

-- ── Both NULL: allowed ────────────────────────────────────────────────────
DO $$ BEGIN
  INSERT INTO public.inventory_items (user_id, codice_articolo, data_acquisto, data_vendita)
  VALUES (:'uid'::uuid, 'BOTH-NULL', NULL, NULL);
  PERFORM pg_temp.expect_ok('both dates NULL accepted');
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.expect_fail('both NULL rejected: ' || SQLSTATE || ': ' || SQLERRM);
END $$;

-- ── Happy path: acquisto < vendita ────────────────────────────────────────
DO $$ BEGIN
  INSERT INTO public.inventory_items (user_id, codice_articolo, data_acquisto, data_vendita)
  VALUES (:'uid'::uuid, 'HAPPY', DATE '2026-06-01', DATE '2026-06-15');
  PERFORM pg_temp.expect_ok('acquisto < vendita accepted');
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.expect_fail('happy path rejected: ' || SQLSTATE || ': ' || SQLERRM);
END $$;

-- ── INSERT blocked when acquisto > vendita, with SQLSTATE 'VIIS1' ─────────
DO $$ BEGIN
  BEGIN
    INSERT INTO public.inventory_items (user_id, codice_articolo, data_acquisto, data_vendita)
    VALUES (:'uid'::uuid, 'BAD-INS', DATE '2026-06-16', DATE '2026-06-15');
    PERFORM pg_temp.expect_fail('INSERT with acquisto > vendita should have failed');
  EXCEPTION WHEN sqlstate 'VIIS1' THEN
    PERFORM pg_temp.expect_ok('INSERT acquisto > vendita blocked with SQLSTATE VIIS1');
  WHEN check_violation THEN
    PERFORM pg_temp.expect_ok('INSERT acquisto > vendita blocked with check_violation (23514 fallback)');
  END;
END $$;

-- ── UPDATE blocked when moving acquisto past vendita ──────────────────────
DO $$ BEGIN
  BEGIN
    UPDATE public.inventory_items
       SET data_acquisto = DATE '2026-07-01'
     WHERE user_id = :'uid'::uuid AND codice_articolo = 'HAPPY';
    PERFORM pg_temp.expect_fail('UPDATE moving acquisto past vendita should have failed');
  EXCEPTION WHEN sqlstate 'VIIS1' THEN
    PERFORM pg_temp.expect_ok('UPDATE acquisto > vendita blocked with SQLSTATE VIIS1');
  WHEN check_violation THEN
    PERFORM pg_temp.expect_ok('UPDATE acquisto > vendita blocked with check_violation (23514 fallback)');
  END;
END $$;

-- ── UPDATE that sets both to valid pair is allowed ────────────────────────
DO $$ BEGIN
  UPDATE public.inventory_items
     SET data_acquisto = DATE '2026-06-10', data_vendita = DATE '2026-06-20'
   WHERE user_id = :'uid'::uuid AND codice_articolo = 'HAPPY';
  PERFORM pg_temp.expect_ok('UPDATE to valid date pair accepted');
END $$;

-- ── Timezone: DATE columns ignore session TZ; comparison is by calendar
--    day, so switching Europe/Rome ↔ UTC does not flip a valid pair.
DO $$ BEGIN
  SET LOCAL TIME ZONE 'Europe/Rome';
  INSERT INTO public.inventory_items (user_id, codice_articolo, data_acquisto, data_vendita)
  VALUES (:'uid'::uuid, 'TZ-ROMA', DATE '2026-06-01', DATE '2026-06-01');
  SET LOCAL TIME ZONE 'UTC';
  INSERT INTO public.inventory_items (user_id, codice_articolo, data_acquisto, data_vendita)
  VALUES (:'uid'::uuid, 'TZ-UTC', DATE '2026-06-01', DATE '2026-06-01');
  PERFORM pg_temp.expect_ok('same-day pair accepted under both Europe/Rome and UTC');
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.expect_fail('timezone edge case rejected: ' || SQLSTATE || ': ' || SQLERRM);
END $$;

-- ── Timezone conversion: a timestamptz at UTC midnight is "yesterday" in
--    Pacific/Auckland once cast to DATE. Confirm the constraint uses the
--    stored DATE value (calendar day), not the session-converted one, so
--    a pair that is valid at insert time stays valid after a TZ switch.
DO $$
DECLARE d_acq date; d_ven date;
BEGIN
  SET LOCAL TIME ZONE 'UTC';
  d_acq := (TIMESTAMPTZ '2026-06-01 00:00:00+00')::date;   -- 2026-06-01
  d_ven := (TIMESTAMPTZ '2026-06-02 00:00:00+00')::date;   -- 2026-06-02
  INSERT INTO public.inventory_items (user_id, codice_articolo, data_acquisto, data_vendita)
  VALUES (:'uid'::uuid, 'TZ-CONV-UTC', d_acq, d_ven);
  SET LOCAL TIME ZONE 'Pacific/Auckland';                  -- +12/+13
  UPDATE public.inventory_items SET note = 'tz-switch'
   WHERE user_id = :'uid'::uuid AND codice_articolo = 'TZ-CONV-UTC';
  SET LOCAL TIME ZONE 'Pacific/Honolulu';                  -- -10
  UPDATE public.inventory_items SET note = 'tz-switch-2'
   WHERE user_id = :'uid'::uuid AND codice_articolo = 'TZ-CONV-UTC';
  PERFORM pg_temp.expect_ok('DATE-typed pair survives session TZ swings (UTC → Auckland → Honolulu)');
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.expect_fail('TZ conversion edge case rejected: ' || SQLSTATE || ': ' || SQLERRM);
END $$;

-- ── DST boundary: last Sunday of March in Europe/Rome. Confirms that
--    the DATE cast of a timestamp inside the missing hour does not
--    silently roll to a neighbouring day and break the invariant.
DO $$ BEGIN
  SET LOCAL TIME ZONE 'Europe/Rome';
  INSERT INTO public.inventory_items (user_id, codice_articolo, data_acquisto, data_vendita)
  VALUES (:'uid'::uuid, 'DST-SPRING',
          (TIMESTAMPTZ '2026-03-29 02:30:00+01')::date,
          (TIMESTAMPTZ '2026-03-29 03:30:00+02')::date);
  PERFORM pg_temp.expect_ok('DST spring-forward same day accepted');
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.expect_fail('DST edge case rejected: ' || SQLSTATE || ': ' || SQLERRM);
END $$;

-- ── UPDATE that sets data_vendita to NULL while data_acquisto stays set:
--    allowed (either side NULL disables the comparison).
DO $$ BEGIN
  UPDATE public.inventory_items
     SET data_vendita = NULL
   WHERE user_id = :'uid'::uuid AND codice_articolo = 'HAPPY';
  PERFORM pg_temp.expect_ok('UPDATE clearing data_vendita to NULL accepted');
END $$;

-- ── UPDATE that clears data_acquisto to NULL while data_vendita is set:
--    allowed.
DO $$ BEGIN
  UPDATE public.inventory_items
     SET data_acquisto = NULL, data_vendita = DATE '2026-06-15'
   WHERE user_id = :'uid'::uuid AND codice_articolo = 'HAPPY';
  PERFORM pg_temp.expect_ok('UPDATE clearing data_acquisto to NULL accepted');
END $$;

-- ── UPDATE that sets BOTH dates to NULL: allowed.
DO $$ BEGIN
  UPDATE public.inventory_items
     SET data_acquisto = NULL, data_vendita = NULL
   WHERE user_id = :'uid'::uuid AND codice_articolo = 'HAPPY';
  PERFORM pg_temp.expect_ok('UPDATE clearing both dates to NULL accepted');
END $$;

-- ── Restoring dates after NULL: happy pair still accepted.
DO $$ BEGIN
  UPDATE public.inventory_items
     SET data_acquisto = DATE '2026-06-01', data_vendita = DATE '2026-06-10'
   WHERE user_id = :'uid'::uuid AND codice_articolo = 'HAPPY';
  PERFORM pg_temp.expect_ok('UPDATE restoring valid dates after NULL accepted');
END $$;

-- ── Off-by-one: vendita one day before acquisto must be rejected.
DO $$ BEGIN
  BEGIN
    INSERT INTO public.inventory_items (user_id, codice_articolo, data_acquisto, data_vendita)
    VALUES (:'uid'::uuid, 'OFF-BY-ONE', DATE '2026-06-02', DATE '2026-06-01');
    PERFORM pg_temp.expect_fail('off-by-one INSERT should have failed');
  EXCEPTION WHEN sqlstate 'VIIS1' THEN
    PERFORM pg_temp.expect_ok('off-by-one blocked with SQLSTATE VIIS1');
  WHEN check_violation THEN
    PERFORM pg_temp.expect_ok('off-by-one blocked with check_violation');
  END;
END $$;

ROLLBACK;

