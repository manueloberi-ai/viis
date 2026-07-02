CREATE OR REPLACE FUNCTION public.validate_inventory_dates()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.data_acquisto IS NOT NULL
     AND NEW.data_vendita IS NOT NULL
     AND NEW.data_acquisto > NEW.data_vendita THEN
    RAISE EXCEPTION
      'La data di acquisto (%) non puo'' essere successiva alla data di vendita (%).',
      NEW.data_acquisto, NEW.data_vendita
      USING ERRCODE = 'VIIS1',
            HINT = 'Correggi data_acquisto o data_vendita e riprova.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_items_validate_dates ON public.inventory_items;
CREATE TRIGGER trg_inventory_items_validate_dates
BEFORE INSERT OR UPDATE OF data_acquisto, data_vendita
ON public.inventory_items
FOR EACH ROW
EXECUTE FUNCTION public.validate_inventory_dates();