
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.auto_complete_past_activities()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE public.contacts
     SET stato_attivita = 'svolto',
         updated_at = now()
   WHERE stato_attivita = 'in_programma'
     AND data IS NOT NULL
     AND data < CURRENT_DATE;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- (Re)schedule the hourly job
DO $$
BEGIN
  PERFORM cron.unschedule('auto-complete-past-activities');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'auto-complete-past-activities',
  '5 * * * *',
  $cron$ SELECT public.auto_complete_past_activities(); $cron$
);
