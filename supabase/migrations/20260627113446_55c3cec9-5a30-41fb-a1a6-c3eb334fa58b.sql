
-- Indexes to speed up Reports detail and audit log filtering
CREATE INDEX IF NOT EXISTS inventory_items_user_data_vendita_idx
  ON public.inventory_items (user_id, data_vendita DESC);
CREATE INDEX IF NOT EXISTS inventory_items_user_data_acquisto_idx
  ON public.inventory_items (user_id, data_acquisto DESC);
CREATE INDEX IF NOT EXISTS inventory_items_user_piattaforma_idx
  ON public.inventory_items (user_id, piattaforma_vendita);
CREATE INDEX IF NOT EXISTS inventory_items_user_categoria_idx
  ON public.inventory_items (user_id, categoria_prodotto);
CREATE INDEX IF NOT EXISTS inventory_items_user_mese_vendita_idx
  ON public.inventory_items (user_id, mese_vendita);

CREATE INDEX IF NOT EXISTS inventory_audit_log_user_action_idx
  ON public.inventory_audit_log (user_id, action, created_at DESC);
CREATE INDEX IF NOT EXISTS inventory_audit_log_item_created_idx
  ON public.inventory_audit_log (inventory_item_id, created_at DESC);
