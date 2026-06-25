ALTER TABLE public.inventory_items
  RENAME COLUMN nome TO nome_oggetto;

ALTER TABLE public.inventory_items
  RENAME COLUMN stato TO stato_prodotto;

ALTER TABLE public.inventory_items
  RENAME COLUMN piattaforma TO piattaforma_vendita;

ALTER TABLE public.inventory_items
  RENAME COLUMN costo_spedizione TO costo_spedizione_valore;

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS posizione_inventario text,
  ADD COLUMN IF NOT EXISTS fonte_acquisto text,
  ADD COLUMN IF NOT EXISTS categoria_prodotto text,
  ADD COLUMN IF NOT EXISTS data_vendita date,
  ADD COLUMN IF NOT EXISTS prezzo_vendita_valore numeric,
  ADD COLUMN IF NOT EXISTS spedizione text,
  ADD COLUMN IF NOT EXISTS costo_spedizione numeric,
  ADD COLUMN IF NOT EXISTS destinazione text,
  ADD COLUMN IF NOT EXISTS tasse numeric,
  ADD COLUMN IF NOT EXISTS profitto numeric,
  ADD COLUMN IF NOT EXISTS margine_profitto numeric,
  ADD COLUMN IF NOT EXISTS mese_acquisto text,
  ADD COLUMN IF NOT EXISTS mese_vendita text,
  ADD COLUMN IF NOT EXISTS ricavi_netti numeric,
  ADD COLUMN IF NOT EXISTS soldi_persi numeric,
  ADD COLUMN IF NOT EXISTS campi_spuntati jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.inventory_items
SET
  categoria_prodotto = COALESCE(categoria_prodotto, categoria),
  prezzo_vendita_valore = COALESCE(prezzo_vendita_valore, prezzo_vendita),
  costo_spedizione = COALESCE(costo_spedizione, costo_spedizione_valore),
  campi_spuntati = jsonb_strip_nulls(jsonb_build_object(
    'stato_prodotto', stato_prodotto,
    'nome_oggetto', nome_oggetto,
    'categoria_prodotto', COALESCE(categoria_prodotto, categoria),
    'data_vendita', data_vendita,
    'prezzo_vendita', COALESCE(prezzo_vendita_valore, prezzo_vendita),
    'spedizione', spedizione,
    'costo_spedizione', COALESCE(costo_spedizione, costo_spedizione_valore),
    'destinazione', destinazione,
    'tasse', tasse,
    'mese_vendita', mese_vendita
  ))
WHERE TRUE;

ALTER TABLE public.inventory_items
  ALTER COLUMN nome_oggetto DROP NOT NULL,
  ALTER COLUMN nome_oggetto SET DEFAULT NULL,
  ALTER COLUMN stato_prodotto SET DEFAULT NULL,
  ALTER COLUMN costo_acquisto DROP NOT NULL,
  ALTER COLUMN costo_acquisto DROP DEFAULT,
  ALTER COLUMN fee_piattaforma DROP DEFAULT;

CREATE TABLE IF NOT EXISTS public.inventory_template_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  inventory_item_id uuid REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  stato_prodotto text,
  nome_oggetto text,
  categoria_prodotto text,
  data_vendita date,
  prezzo_vendita numeric,
  spedizione text,
  costo_spedizione numeric,
  destinazione text,
  tasse numeric,
  mese_vendita text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_template_fields TO authenticated;
GRANT ALL ON public.inventory_template_fields TO service_role;
ALTER TABLE public.inventory_template_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own template fields"
ON public.inventory_template_fields
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER inventory_template_fields_touch_updated_at
BEFORE UPDATE ON public.inventory_template_fields
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();