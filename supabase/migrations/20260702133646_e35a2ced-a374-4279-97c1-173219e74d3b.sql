ALTER TABLE public.inventory_items
  ADD CONSTRAINT inventory_items_data_acquisto_le_vendita
  CHECK (data_acquisto IS NULL OR data_vendita IS NULL OR data_acquisto <= data_vendita)
  NOT VALID;