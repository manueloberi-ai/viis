CREATE UNIQUE INDEX IF NOT EXISTS inventory_template_fields_inventory_item_id_unique
ON public.inventory_template_fields (inventory_item_id)
WHERE inventory_item_id IS NOT NULL;