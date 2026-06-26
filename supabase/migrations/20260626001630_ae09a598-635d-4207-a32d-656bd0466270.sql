
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS titoli_piattaforma jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS descrizioni_piattaforma jsonb NOT NULL DEFAULT '{}'::jsonb;
